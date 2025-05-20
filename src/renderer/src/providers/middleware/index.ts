import { getDefaultModel } from '@renderer/services/AssistantService'
import { ChunkType, ErrorChunk } from '@renderer/types/chunk'

import { CompletionsParams } from '../AiProvider'
import BaseProvider from '../AiProvider/BaseProvider'
import {
  AiProviderMiddleware,
  AiProviderMiddlewareCompletionsContext,
  NextCompletionsFunction
} from './AiProviderMiddlewareTypes'

/**
 * Creates an ErrorChunk object with a standardized structure.
 * @param error The error object or message.
 * @param chunkType The type of chunk, defaults to ChunkType.ERROR.
 * @returns An ErrorChunk object.
 */
export function createErrorChunk(error: any, chunkType: ChunkType = ChunkType.ERROR): ErrorChunk {
  let errorDetails: Record<string, any> = {}

  if (error instanceof Error) {
    errorDetails = {
      message: error.message,
      name: error.name,
      stack: error.stack
    }
  } else if (typeof error === 'string') {
    errorDetails = { message: error }
  } else if (typeof error === 'object' && error !== null) {
    // Attempt to capture more details from object-based errors
    errorDetails = Object.getOwnPropertyNames(error).reduce(
      (acc, key) => {
        acc[key] = error[key]
        return acc
      },
      {} as Record<string, any>
    )
    if (!errorDetails.message && error.toString && typeof error.toString === 'function') {
      const errMsg = error.toString()
      if (errMsg !== '[object Object]') {
        errorDetails.message = errMsg
      }
    }
  }

  return {
    type: chunkType,
    error: errorDetails
  } as ErrorChunk // Ensure the cast if necessary, though structure should match
}

/**
 * Wraps a single provider instance with a single middleware using an ES6 Proxy.
 * @param providerToWrap The provider instance to wrap.
 * @param middleware The middleware to apply.
 * @returns A new provider instance wrapped with the middleware.
 */
function doWrapSingleProvider(providerToWrap: BaseProvider, middleware: AiProviderMiddleware): BaseProvider {
  const thisProxy = new Proxy(providerToWrap, {
    get(target, prop, receiver) {
      // Intercept 'completions' to apply middleware logic
      if (prop === 'completions') {
        return async (originalCompletionsParams: CompletionsParams) => {
          const assistant = originalCompletionsParams.assistant
          const model = assistant.model || getDefaultModel()

          const completionCtx: AiProviderMiddlewareCompletionsContext = {
            originalParams: { ...originalCompletionsParams },
            assistant,
            model,
            messages: originalCompletionsParams.messages,
            mcpTools: originalCompletionsParams.mcpTools,
            onChunk: originalCompletionsParams.onChunk,
            onFilterMessages: originalCompletionsParams.onFilterMessages,
            // protected provider,只能这么访问
            providerId: target.getProviderInfo().id
          }

          try {
            // 1. Transform input parameters if the middleware defines the hook
            if (middleware.transformCompletionsInput) {
              await middleware.transformCompletionsInput.call(middleware, completionCtx)
              // Hook modifies completionCtx directly
            }

            // 2. Wrap onChunk if the middleware defines the hook
            if (middleware.wrapOnChunk) {
              completionCtx.onChunk = middleware.wrapOnChunk.call(
                middleware,
                completionCtx.onChunk, // Pass the current onChunk (possibly already wrapped)
                completionCtx
              )
            }
          } catch (error) {
            console.error(
              `Error during middleware setup (transformCompletionsInput or wrapOnChunk) for middleware '${middleware.id || 'anonymous'}':`,
              error
            )
            if (completionCtx.onChunk) {
              completionCtx.onChunk(createErrorChunk(error, ChunkType.ERROR))
            }
            // Stop execution for this completions call if setup fails
            return
          }

          // Define the 'next' function for wrapCompletions
          const nextCompletionsFunc: NextCompletionsFunction = async (ctxFromPrevMiddleware) => {
            // Call the target's (original provider or inner middleware) completions method
            // Pass the full context (which might have been modified by transformCompletionsInput)
            return target.completions.call(thisProxy, ctxFromPrevMiddleware) // Use thisProxy as `this` for chained calls
          }

          // 3. Wrap the main completions call if the middleware defines the hook
          if (middleware.wrapCompletions) {
            try {
              return await middleware.wrapCompletions.call(middleware, completionCtx, nextCompletionsFunc)
            } catch (error) {
              // Errors from wrapCompletions (including errors from `await next(...)`)
              // should be re-thrown to be caught by higher-level error handlers (e.g., in messageThunk.ts)
              // The original onChunk in completionCtx might have been called by the provider for earlier errors.
              // If the error happens *within* wrapCompletions before `next` or after `next` returns,
              // and no error chunk has been sent, we might consider sending one here if appropriate.
              // However, the primary design is to let errors from provider logic propagate.
              console.error(`Error during wrapCompletions for middleware '${middleware.id || 'anonymous'}':`, error)
              throw error // Re-throw to allow higher-level handling
            }
          } else {
            // If no wrapCompletions, call the next function directly
            try {
              return await nextCompletionsFunc(completionCtx)
            } catch (error) {
              // This catches errors from the provider if no wrapCompletions is involved at this middleware level.
              console.error(
                `Error during direct call to next completions function (middleware '${middleware.id || 'anonymous'}' has no wrapCompletions):`,
                error
              )
              throw error // Re-throw
            }
          }
        }
      }

      // Expose finalizeSdkRequestParams from the middleware if the provider calls it.
      // The provider's `completions` method will look for `this.finalizeSdkRequestParams`.
      if (prop === 'finalizeSdkRequestParams' && typeof middleware.finalizeSdkRequestParams === 'function') {
        return middleware.finalizeSdkRequestParams.bind(middleware)
        // Note: Chaining for this hook needs to be handled carefully if multiple middlewares define it.
        // The current simple bind only exposes the outermost middleware's hook if provider calls `this.finalizeSdkRequestParams`.
        // A more robust chaining for this specific hook type might be needed if it's a common scenario.
        // For now, this makes it available to the provider if one middleware provides it.
      }

      // Default behavior: access properties or methods from the target object
      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
  return thisProxy as BaseProvider
}

/**
 * Wraps a provider instance with one or more middlewares.
 * Middlewares are applied in a chained (onion-like) fashion.
 * @param providerInstance The provider instance to wrap.
 * @param middlewareInput A single middleware or an array of middlewares.
 * @returns The provider instance wrapped with the specified middlewares.
 */
export function wrapProviderWithMiddleware(
  providerInstance: BaseProvider,
  middlewareInput: AiProviderMiddleware | AiProviderMiddleware[]
): BaseProvider {
  const middlewares = Array.isArray(middlewareInput) ? middlewareInput : [middlewareInput]

  if (middlewares.length === 0) {
    return providerInstance // No middlewares to apply
  }

  // Apply middlewares from right to left (onion-like layers)
  // The last middleware in the array becomes the innermost layer around the original providerInstance.
  return middlewares.reduceRight<BaseProvider>(
    (accProvider, currentMiddleware) => doWrapSingleProvider(accProvider, currentMiddleware),
    providerInstance
  )
}
