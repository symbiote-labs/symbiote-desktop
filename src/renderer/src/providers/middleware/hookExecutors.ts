// Assuming this is where CompletionsParams is
import BaseProvider from '../AiProvider/BaseProvider' // Corrected import
// import { CompletionsParams } from '../AiProvider'; // Not directly used here, CompletionsContext handles originalParams
import {
  AiProviderMiddleware,
  AiProviderMiddlewareBaseContext,
  AiProviderMiddlewareCompletionsContext,
  NextExecutionFunction,
  OnChunkFunction
  // FinalizeSdkParamsNextFunction, // Not used directly in these core pipeline funcs yet
} from './AiProviderMiddlewareTypes'
import { createCompletionsContext } from './contexts/completionsContext' // Corrected import path case
import { capitalize } from './utils' // Adjust path

// Renamed from original plan to avoid conflict if createInitialContext is also used elsewhere.
export function establishContext(
  originalCallArgs: any[],
  methodName: string,
  providerId: string | undefined,
  receiver: any // The proxy receiver
): AiProviderMiddlewareBaseContext {
  const firstArg = originalCallArgs.length > 0 ? originalCallArgs[0] : undefined
  if (firstArg && firstArg._isMiddlewareContext === true) {
    return { ...firstArg, _providerProxy: receiver }
  } else {
    // This is the function that actually creates a NEW context from scratch
    return createNewInitialContext(methodName, originalCallArgs, providerId, receiver)
  }
}

// This function is responsible for creating a brand new context.
// It's called by establishContext when no prior context is passed.
function createNewInitialContext(
  methodName: string,
  originalArgs: any[],
  providerId?: string,
  _providerProxy?: any
): AiProviderMiddlewareBaseContext {
  const baseContextData: AiProviderMiddlewareBaseContext = {
    _isMiddlewareContext: true, // Mark as a middleware-managed context
    methodName,
    originalArgs,
    // params: originalArgs[0], // Removed as per our discussion for a more generic base context
    providerId,
    _providerProxy
  }

  if (methodName === 'completions' && typeof createCompletionsContext === 'function') {
    // createCompletionsContext should be adapted to take AiProviderMiddlewareBaseContext
    // and derive its specific needs (like 'params' if it keeps it) from originalArgs.
    return createCompletionsContext(baseContextData)
  }
  return baseContextData
}

export async function executePrepareHook(
  currentCtx: AiProviderMiddlewareBaseContext,
  middleware: AiProviderMiddleware,
  methodName: string
): Promise<AiProviderMiddlewareBaseContext> {
  const prepareHookName = `prepare${capitalize(methodName)}Context` as keyof AiProviderMiddleware
  if (typeof middleware[prepareHookName] === 'function') {
    try {
      const hookFn = middleware[prepareHookName] as (
        context: AiProviderMiddlewareBaseContext // Generic, specific context handled by hook itself if needed
      ) => Promise<AiProviderMiddlewareBaseContext> | AiProviderMiddlewareBaseContext

      const actualCtxToSend =
        methodName === 'completions' ? (currentCtx as AiProviderMiddlewareCompletionsContext) : currentCtx

      const transformedCtx = await hookFn.call(middleware, actualCtxToSend)
      return transformedCtx || currentCtx // Ensure a context is always returned
    } catch (error) {
      console.error(`Error in ${middleware.name || 'middleware'}.${String(prepareHookName)}:`, error)
      throw error
    }
  }
  return currentCtx
}

export async function executeWrapCallbackHook( // Primarily for completions and onChunk
  currentCompletionsCtx: AiProviderMiddlewareCompletionsContext,
  middleware: AiProviderMiddleware,
  methodName: string // Keeping methodName for potential future generic callback wrapping
): Promise<void> {
  // Modifies context by side effect
  if (methodName !== 'completions') {
    // Currently, only 'completions' has a defined wrapCallbackHook for 'onChunk'
    return
  }

  const wrapCallbackHookName = `wrapCompletionsOnChunkCallback` as keyof AiProviderMiddleware // Hardcoded for now

  if (typeof middleware[wrapCallbackHookName] === 'function') {
    if (typeof currentCompletionsCtx.onChunk === 'function') {
      try {
        const callbackHookFn = middleware[wrapCallbackHookName] as (
          onChunk: OnChunkFunction,
          context: AiProviderMiddlewareCompletionsContext
        ) => OnChunkFunction
        currentCompletionsCtx.onChunk = callbackHookFn.call(
          middleware,
          currentCompletionsCtx.onChunk,
          currentCompletionsCtx
        )
      } catch (error) {
        console.error(`Error in ${middleware.name || 'middleware'}.${String(wrapCallbackHookName)}:`, error)
        throw error
      }
    } else {
      // It's a design choice whether to warn loudly if onChunk is missing when a hook expects it.
      // console.warn(`${middleware.name || 'middleware'} wants to wrap onChunk for ${methodName}, but onChunk is not a function.`);
    }
  }
}

export async function executeAroundHookOrProceed(
  currentCtx: AiProviderMiddlewareBaseContext,
  middleware: AiProviderMiddleware,
  methodName: string,
  originalMethodFromTarget: (context: AiProviderMiddlewareBaseContext) => Promise<any>, // Expects context
  targetForOriginalMethod: BaseProvider // The 'this' for the originalMethodFromTarget
): Promise<any> {
  const next: NextExecutionFunction = async (contextForNextCall?: AiProviderMiddlewareBaseContext): Promise<any> => {
    const effectiveCtx = contextForNextCall || currentCtx
    if (typeof originalMethodFromTarget !== 'function') {
      throw new Error(`Internal error: originalMethodFromTarget for ${methodName} is not a function.`)
    }
    // originalMethodFromTarget is the next middleware's SANE method or the base provider's SANE method.
    // It *MUST* accept a context object as its first (and ideally only) argument.
    return originalMethodFromTarget.call(targetForOriginalMethod, effectiveCtx)
  }

  const aroundHookName = `around${capitalize(methodName)}Execution` as keyof AiProviderMiddleware
  if (typeof middleware[aroundHookName] === 'function') {
    const aroundHookFn = middleware[aroundHookName] as (
      context: AiProviderMiddlewareBaseContext, // Or specific like AiProviderMiddlewareCompletionsContext
      next: NextExecutionFunction
    ) => Promise<any>

    const actualCtxToSend =
      methodName === 'completions' ? (currentCtx as AiProviderMiddlewareCompletionsContext) : currentCtx
    return aroundHookFn.call(middleware, actualCtxToSend, next)
  } else {
    return next(currentCtx) // No around hook, just proceed
  }
}
