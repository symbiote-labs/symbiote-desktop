import type { CompletionsParams } from '../AiProvider' // For createCompletionsContext typing
import type BaseProvider from '../AiProvider/BaseProvider'
import {
  AiProviderMiddlewareBaseContext,
  AiProviderMiddlewareCompletionsContext,
  CompletionsMiddleware,
  MIDDLEWARE_CONTEXT_SYMBOL,
  MiddlewareAPI,
  ProviderMethodMiddleware
} from './AiProviderMiddlewareTypes'

/**
 * Creates the initial context for a method call, populating method-specific fields.
 */
function createInitialCallContext<
  TContext extends AiProviderMiddlewareBaseContext,
  TCallArgs extends any[] // The actual arguments array from the proxy/method call
>(
  methodName: string,
  originalCallArgs: TCallArgs, // Renamed from originalArgs to avoid confusion with context.originalArgs
  providerId: string | undefined,
  providerInstance: BaseProvider,
  // Factory to create specific context from base and the *original call arguments array*
  specificContextFactory?: (base: AiProviderMiddlewareBaseContext, callArgs: TCallArgs) => TContext
): TContext {
  const baseContext: AiProviderMiddlewareBaseContext = {
    [MIDDLEWARE_CONTEXT_SYMBOL]: true,
    methodName,
    originalArgs: originalCallArgs, // Store the full original arguments array in the context
    providerId,
    _providerInstance: providerInstance
  }

  if (specificContextFactory) {
    return specificContextFactory(baseContext, originalCallArgs)
  }
  return baseContext as TContext // Fallback to base context if no specific factory
}

/**
 * Composes an array of functions from right to left.
 * compose(f, g, h) is (...args) => f(g(h(...args))).
 * Each function in funcs is expected to take the result of the next function
 * (or the initial value for the rightmost function) as its argument.
 */
function compose(...funcs: Array<(...args: any[]) => any>): (...args: any[]) => any {
  if (funcs.length === 0) {
    // If no functions to compose, return a function that returns its first argument, or undefined if no args.
    return (...args: any[]) => (args.length > 0 ? args[0] : undefined)
  }
  if (funcs.length === 1) {
    return funcs[0]
  }
  return funcs.reduce(
    (a, b) =>
      (...args: any[]) =>
        a(b(...args))
  )
}

/**
 * Applies an array of Redux-style middlewares to a generic provider method.
 * This version keeps args as an array throughout the middleware chain.
 */
export function applyMiddlewaresToMethod<
  TArgs extends any[] = any[], // Original method's arguments array type
  TResult = any,
  TContext extends AiProviderMiddlewareBaseContext = AiProviderMiddlewareBaseContext
>(
  originalProviderInstance: BaseProvider,
  methodName: string,
  originalMethod: (...args: TArgs) => Promise<TResult>,
  middlewares: ProviderMethodMiddleware[], // Expects generic middlewares
  specificContextFactory?: (base: AiProviderMiddlewareBaseContext, callArgs: TArgs) => TContext
): (...args: TArgs) => Promise<TResult> {
  // Returns a function matching original method signature
  return async function enhancedMethod(...methodCallArgs: TArgs): Promise<TResult> {
    const ctx = createInitialCallContext<TContext, TArgs>(
      methodName,
      methodCallArgs, // Pass the actual call arguments array
      originalProviderInstance.getProviderInfo?.()?.id,
      originalProviderInstance,
      specificContextFactory
    )

    const api: MiddlewareAPI<TContext, TArgs> = {
      getContext: () => ctx,
      getOriginalArgs: () => methodCallArgs, // API provides the original arguments array
      getProviderId: () => originalProviderInstance.getProviderInfo?.()?.id,
      getProviderInstance: () => originalProviderInstance
    }

    const finalDispatch = async (
      currentContext: TContext,
      currentArgs: TArgs // Generic final dispatch expects args array
    ): Promise<TResult> => {
      return originalMethod.apply(originalProviderInstance, currentArgs)
    }

    const chain = middlewares.map((middleware) => middleware(api as MiddlewareAPI<any, any>)) // Cast API if TContext/TArgs mismatch general ProviderMethodMiddleware
    const composedMiddlewareLogic = compose(...chain)
    const enhancedDispatch = composedMiddlewareLogic(finalDispatch)

    return enhancedDispatch(methodCallArgs) // Pass context and original args array
  }
}

/**
 * Applies an array of CompletionsMiddleware to the completions method.
 * This version adapts for CompletionsMiddleware expecting a single `params` object.
 */
export function applyCompletionsMiddlewares(
  originalProviderInstance: BaseProvider,
  originalCompletionsMethod: (params: CompletionsParams) => Promise<void>,
  middlewares: CompletionsMiddleware[]
): (params: CompletionsParams) => Promise<void> {
  // Returns a function matching original method signature

  const methodName = 'completions'

  // Factory to create AiProviderMiddlewareCompletionsContext
  const completionsContextFactory = (
    base: AiProviderMiddlewareBaseContext,
    callArgs: [CompletionsParams] // Expects an array with one CompletionsParams object
  ): AiProviderMiddlewareCompletionsContext => {
    const params = callArgs[0]
    return {
      ...base,
      methodName: 'completions',
      assistant: params.assistant,
      model: params.assistant.model ?? params.assistant.defaultModel,
      messages: params.messages,
      mcpTools: params.mcpTools,
      onChunk: params.onChunk,
      onFilterMessages: params.onFilterMessages
    }
  }

  return async function enhancedCompletionsMethod(params: CompletionsParams): Promise<void> {
    // originalCallArgs for context creation is [params]
    const originalCallArgs: [CompletionsParams] = [params]

    const ctx = createInitialCallContext<AiProviderMiddlewareCompletionsContext, [CompletionsParams]>(
      methodName,
      originalCallArgs,
      originalProviderInstance.getProviderInfo?.()?.id,
      originalProviderInstance,
      completionsContextFactory
    )

    const api: MiddlewareAPI<AiProviderMiddlewareCompletionsContext, [CompletionsParams]> = {
      getContext: () => ctx,
      getOriginalArgs: () => originalCallArgs, // API provides [CompletionsParams]
      getProviderId: () => originalProviderInstance.getProviderInfo?.()?.id,
      getProviderInstance: () => originalProviderInstance
    }

    // finalDispatch for CompletionsMiddleware: expects (context, params) not (context, args_array)
    const finalDispatch = async (
      _context: AiProviderMiddlewareCompletionsContext, // Context passed through
      currentParams: CompletionsParams // Directly takes params
    ): Promise<void> => {
      // Call original method with original `this` and the params object
      return originalCompletionsMethod.call(originalProviderInstance, currentParams)
    }

    const chain = middlewares.map((middleware) => middleware(api))
    const composedMiddlewareLogic = compose(...chain)

    // enhancedDispatch is (context, params) => Promise<void>
    const enhancedDispatch = composedMiddlewareLogic(finalDispatch)

    // Execute with context and the single params object
    return enhancedDispatch(ctx, params)
  }
}
