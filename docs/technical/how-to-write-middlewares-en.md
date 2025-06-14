# How to Write Middleware for AI Providers

This document aims to guide developers on how to create and integrate custom middleware for our AI Provider framework. Middleware provides a powerful and flexible way to enhance, modify, or observe the invocation process of Provider methods, such as logging, caching, request/response transformation, error handling, etc.

## Architecture Overview

Our middleware architecture borrows from Redux's three-stage design and combines JavaScript Proxy to dynamically apply middleware to Provider methods.

- **Proxy**: Intercepts calls to Provider methods and routes them to the middleware chain.
- **Middleware Chain**: A series of middleware functions executed in sequence. Each middleware can handle requests/responses, then pass control to the next middleware in the chain, or terminate the chain early in some cases.
- **Context**: An object passed between middleware that carries information about the current call (such as method name, original parameters, Provider instance, and middleware-specific data).

## Types of Middleware

Currently, two main types of middleware are supported, which share similar structures but target different scenarios:

1.  **`CompletionsMiddleware`**: Specifically designed for the `completions` method. This is the most commonly used middleware type as it allows fine-grained control over the core chat/text generation functionality of AI models.
2.  **`ProviderMethodMiddleware`**: General-purpose middleware that can be applied to any other method on the Provider (e.g., `translate`, `summarize`, etc., if these methods are also wrapped through the middleware system).

## Writing a `CompletionsMiddleware`

The basic signature (TypeScript type) of `CompletionsMiddleware` is as follows:

```typescript
import { AiProviderMiddlewareCompletionsContext, CompletionsParams, MiddlewareAPI } from './AiProviderMiddlewareTypes' // 假设类型定义文件路径

export type CompletionsMiddleware = (
  api: MiddlewareAPI<AiProviderMiddlewareCompletionsContext, [CompletionsParams]>
) => (
  next: (context: AiProviderMiddlewareCompletionsContext, params: CompletionsParams) => Promise<any> // next 返回 Promise<any> 代表原始SDK响应或下游中间件的结果
) => (context: AiProviderMiddlewareCompletionsContext, params: CompletionsParams) => Promise<void> // 最内层函数通常返回 Promise<void>，因为结果通过 onChunk 或 context 副作用传递
```

Let's break down this three-stage structure:

1.  **First layer function `(api) => { ... }`**:

    - Receives an `api` object.
    - The `api` object provides the following methods:
      - `api.getContext()`: Gets the current call's context object (`AiProviderMiddlewareCompletionsContext`).
      - `api.getOriginalArgs()`: Gets the original parameter array passed to the `completions` method (i.e., `[CompletionsParams]`).
      - `api.getProviderId()`: Gets the current Provider's ID.
      - `api.getProviderInstance()`: Gets the original Provider instance.
    - This function is typically used for one-time setup or retrieving required services/configurations. It returns the second layer function.

2.  **Second layer function `(next) => { ... }`**:

    - Receives a `next` function.
    - The `next` function represents the next link in the middleware chain. Calling `next(context, params)` passes control to the next middleware, or if the current middleware is the last in the chain, it calls the core Provider method logic (e.g., actual SDK call).
    - The `next` function receives the current `context` and `params` (which may have been modified by upstream middleware).
    - **Important**: The return type of `next` is typically `Promise<any>`. For the `completions` method, if `next` calls the actual SDK, it will return the original SDK response (e.g., OpenAI's stream object or JSON object). You need to handle this response.
    - This function returns the third layer (and core) function.

3.  **Third layer function `(context, params) => { ... }`**:
    - This is where the main middleware logic is executed.
    - It receives the current `context` (`AiProviderMiddlewareCompletionsContext`) and `params` (`CompletionsParams`).
    - In this function, you can:
      - **Before calling `next`**:
        - Read or modify `params`. For example, add default parameters, transform message format.
        - Read or modify `context`. For example, set a timestamp for subsequent delay calculation.
        - Perform certain checks, and if conditions are not met, return directly or throw an error without calling `next` (e.g., parameter validation failure).
      - **Call `await next(context, params)`**:
        - This is the key step to pass control to downstream.
        - The return value of `next` is the original SDK response or the result of downstream middleware, which you need to handle accordingly (e.g., if it's a stream, start consuming the stream).
      - **After calling `next`**:
        - Handle the result returned by `next`. For example, if `next` returns a stream, you can start iterating through this stream here and send data chunks via `context.onChunk`.
        - Perform further operations based on changes in `context` or the result of `next`. For example, calculate total duration, log entries.
        - Modify the final result (although for `completions`, results are typically emitted through `onChunk` side effects).

### Example: A Simple Logging Middleware

```typescript
import {
  AiProviderMiddlewareCompletionsContext,
  CompletionsParams,
  MiddlewareAPI,
  OnChunkFunction // 假设 OnChunkFunction 类型被导出
} from './AiProviderMiddlewareTypes' // 调整路径
import { ChunkType } from '@renderer/types' // 调整路径

export const createSimpleLoggingMiddleware = (): CompletionsMiddleware => {
  return (api: MiddlewareAPI<AiProviderMiddlewareCompletionsContext, [CompletionsParams]>) => {
    // console.log(`[LoggingMiddleware] Initialized for provider: ${api.getProviderId()}`);

    return (next: (context: AiProviderMiddlewareCompletionsContext, params: CompletionsParams) => Promise<any>) => {
      return async (context: AiProviderMiddlewareCompletionsContext, params: CompletionsParams): Promise<void> => {
        const startTime = Date.now()
        // 从 context 中获取 onChunk (它最初来自 params.onChunk)
        const onChunk = context.onChunk

        console.log(
          `[LoggingMiddleware] Request for ${context.methodName} with params:`,
          params.messages?.[params.messages.length - 1]?.content
        )

        try {
          // Call the next middleware or core logic
          // `rawSdkResponse` is the raw response from downstream (e.g., OpenAIStream or ChatCompletion object)
          const rawSdkResponse = await next(context, params)

          // This simple example doesn't handle rawSdkResponse, assuming downstream middleware (like StreamingResponseHandler)
          // will handle it and send data through onChunk.
          // If this logging middleware is after StreamingResponseHandler, then the stream has already been processed.
          // If it's before, then it needs to handle rawSdkResponse itself or ensure downstream will handle it.

          const duration = Date.now() - startTime
          console.log(`[LoggingMiddleware] Request for ${context.methodName} completed in ${duration}ms.`)

          // Assuming downstream has already sent all data through onChunk.
          // If this middleware is at the end of the chain and needs to ensure BLOCK_COMPLETE is sent,
          // it might need more complex logic to track when all data has been sent.
        } catch (error) {
          const duration = Date.now() - startTime
          console.error(`[LoggingMiddleware] Request for ${context.methodName} failed after ${duration}ms:`, error)

          // If onChunk is available, try to send an error chunk
          if (onChunk) {
            onChunk({
              type: ChunkType.ERROR,
              error: { message: (error as Error).message, name: (error as Error).name, stack: (error as Error).stack }
            })
            // Consider whether BLOCK_COMPLETE still needs to be sent to end the stream
            onChunk({ type: ChunkType.BLOCK_COMPLETE, response: {} })
          }
          throw error // Re-throw the error so upper-level or global error handlers can catch it
        }
      }
    }
  }
}
```

### Importance of `AiProviderMiddlewareCompletionsContext`

`AiProviderMiddlewareCompletionsContext` is the core for passing state and data between middleware. It typically contains:

- `methodName`: The name of the currently called method (always `'completions'`).
- `originalArgs`: The original parameter array passed to `completions`.
- `providerId`: The Provider's ID.
- `_providerInstance`: The Provider instance.
- `onChunk`: The callback function passed from the original `CompletionsParams`, used for streaming data chunks. **All middleware should send data through `context.onChunk`.**
- `messages`, `model`, `assistant`, `mcpTools`: Common fields extracted from the original `CompletionsParams` for convenient access.
- **Custom fields**: Middleware can add custom fields to the context for use by subsequent middleware. For example, a caching middleware might add `context.cacheHit = true`.

**Key**: When you modify `params` or `context` in middleware, these modifications propagate to downstream middleware (if they are modified before the `next` call).

### Middleware Order

The execution order of middleware is very important. The order in which they are defined in the `AiProviderMiddlewareConfig` array is their execution order.

- Requests first pass through the first middleware, then the second, and so on.
- Responses (or the results of `next` calls) "bubble" back in reverse order.

For example, if the chain is `[AuthMiddleware, CacheMiddleware, LoggingMiddleware]`:

1.  `AuthMiddleware` first executes its "before calling `next`" logic.
2.  Then `CacheMiddleware` executes its "before calling `next`" logic.
3.  Then `LoggingMiddleware` executes its "before calling `next`" logic.
4.  Core SDK call (or end of chain).
5.  `LoggingMiddleware` first receives the result and executes its "after calling `next`" logic.
6.  Then `CacheMiddleware` receives the result (possibly with context modified by LoggingMiddleware) and executes its "after calling `next`" logic (e.g., storing results).
7.  Finally `AuthMiddleware` receives the result and executes its "after calling `next`" logic.

### Registering Middleware

Middleware is registered in `src/renderer/src/providers/middleware/register.ts` (or other similar configuration files).

```typescript
// register.ts
import { AiProviderMiddlewareConfig } from './AiProviderMiddlewareTypes'
import { createSimpleLoggingMiddleware } from './common/SimpleLoggingMiddleware' // Assuming you created this file
import { createCompletionsLoggingMiddleware } from './common/CompletionsLoggingMiddleware' // Existing

const middlewareConfig: AiProviderMiddlewareConfig = {
  completions: [
    createSimpleLoggingMiddleware(), // Your newly added middleware
    createCompletionsLoggingMiddleware() // Existing logging middleware
    // ... Other completions middleware
  ],
  methods: {
    // translate: [createGenericLoggingMiddleware()],
    // ... Other method middleware
  }
}

export default middlewareConfig
```

### Best Practices

1.  **Single Responsibility**: Each middleware should focus on a specific functionality (e.g., logging, caching, transforming specific data).
2.  **Side-effect Free (as much as possible)**: Except for explicit side effects through `context` or `onChunk`, try to avoid modifying global state or creating other hidden side effects.
3.  **Error Handling**:
    - Use `try...catch` within middleware to handle possible errors.
    - Decide whether to handle errors yourself (e.g., sending error chunks through `onChunk`) or re-throw them to upstream.
    - If re-throwing, ensure the error object contains sufficient information.
4.  **Performance Considerations**: Middleware adds overhead to request processing. Avoid executing very time-consuming synchronous operations in middleware. For IO-intensive operations, ensure they are asynchronous.
5.  **Configurability**: Make middleware behavior adjustable through parameters or configuration. For example, a logging middleware can accept a log level parameter.
6.  **Context Management**:
    - Be careful when adding data to `context`. Avoid polluting `context` or adding overly large objects.
    - Be clear about the purpose and lifecycle of fields you add to `context`.
7.  **`next` Calls**:
    - Unless you have a good reason to terminate the request early (e.g., cache hit, authorization failure), **always ensure you call `await next(context, params)`**. Otherwise, downstream middleware and core logic will not execute.
    - Understand the return value of `next` and handle it correctly, especially when it's a stream. You need to be responsible for consuming this stream or passing it to another component/middleware that can consume it.
8.  **Clear Naming**: Give your middleware and the functions they create descriptive names.
9.  **Documentation and Comments**: Add comments to complex middleware logic explaining how it works and its purpose.

### Debugging Tips

- Use `console.log` or debugger at key points in middleware to check the state of `params`, `context`, and the return value of `next`.
- Temporarily simplify the middleware chain, keeping only the middleware you're debugging and the simplest core logic to isolate issues.
- Write unit tests to independently verify the behavior of each middleware.

By following these guidelines, you should be able to effectively create powerful and maintainable middleware for our system. If you have any questions or need further assistance, please consult the team.
