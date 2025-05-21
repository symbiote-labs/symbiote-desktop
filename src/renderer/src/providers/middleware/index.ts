import BaseProvider from '../AiProvider/BaseProvider'
import {
  AiProviderMiddleware,
  AiProviderMiddlewareBaseContext,
  AiProviderMiddlewareCompletionsContext,
  FinalizeSdkParamsNextFunction
} from './AiProviderMiddlewareTypes'
import { WRAPPED_METHODS } from './contexts'
import {
  establishContext,
  executeAroundHookOrProceed,
  executePrepareHook,
  executeWrapCallbackHook
} from './hookExecutors'
import { createErrorChunk } from './utils'

function isMethodWrappedByMiddleware(propKey: PropertyKey): propKey is string {
  return typeof propKey === 'string' && WRAPPED_METHODS.includes(propKey)
}

/**
 * Wraps a single provider instance with a single middleware using an ES6 Proxy.
 * @param providerToWrap The provider instance to wrap.
 * @param middleware The middleware to apply.
 * @returns A new provider instance wrapped with the middleware.
 */
function doWrapSingleProvider(
  targetProviderOrProxy: BaseProvider,
  middlewareBeingApplied: AiProviderMiddleware
): BaseProvider {
  const proxy = new Proxy(targetProviderOrProxy, {
    get(target, propKey, receiver) {
      const methodName = typeof propKey === 'string' ? propKey : ''

      // Handle 'finalize<MethodName>SdkParams' hooks
      if (methodName.startsWith('finalize') && methodName.endsWith('SdkParams')) {
        const correspondingMethodBase = methodName.substring('finalize'.length, methodName.length - 'SdkParams'.length)
        const hookName = `finalize${correspondingMethodBase}SdkParams` as keyof AiProviderMiddleware

        const originalFinalizeMethod = target[propKey as keyof BaseProvider] as (
          sdkParams: any,
          context: AiProviderMiddlewareBaseContext
        ) => Promise<any> | any

        return async function finalizeWrapper(
          sdkParamsFromOuter: any,
          contextFromOuter: AiProviderMiddlewareBaseContext
        ): Promise<any> {
          const next: FinalizeSdkParamsNextFunction = async (sdkParams, ctx) => {
            if (typeof originalFinalizeMethod === 'function') {
              return originalFinalizeMethod.call(target, sdkParams, ctx)
            }
            return Promise.resolve(sdkParams)
          }

          if (typeof middlewareBeingApplied[hookName] === 'function') {
            const specificHook = middlewareBeingApplied[hookName] as (
              sdkParams: any,
              context: AiProviderMiddlewareBaseContext,
              next: FinalizeSdkParamsNextFunction
            ) => Promise<any> | any
            return specificHook.call(middlewareBeingApplied, sdkParamsFromOuter, contextFromOuter, next)
          } else {
            return next(sdkParamsFromOuter, contextFromOuter)
          }
        }
      }

      if (isMethodWrappedByMiddleware(propKey as string)) {
        const originalMethodFromTarget = target[propKey as keyof BaseProvider] as (
          context: AiProviderMiddlewareBaseContext
        ) => Promise<any>

        return async function methodWrapper(...originalCallArgs: any[]): Promise<any> {
          let currentProcessingContext: AiProviderMiddlewareBaseContext | undefined

          try {
            currentProcessingContext = establishContext(
              originalCallArgs,
              methodName,
              (target as BaseProvider).getProviderInfo()?.id,
              receiver
            )

            currentProcessingContext = await executePrepareHook(
              currentProcessingContext,
              middlewareBeingApplied,
              methodName
            )

            if (methodName === 'completions' && currentProcessingContext) {
              await executeWrapCallbackHook(
                currentProcessingContext as AiProviderMiddlewareCompletionsContext,
                middlewareBeingApplied,
                methodName
              )
            }

            if (!currentProcessingContext) {
              throw new Error('Middleware context is undefined after prepare hook.')
            }

            return await executeAroundHookOrProceed(
              currentProcessingContext,
              middlewareBeingApplied,
              methodName,
              originalMethodFromTarget,
              target
            )
          } catch (error: any) {
            console.error(`Pipeline error in ${methodName} for ${middlewareBeingApplied.name || 'middleware'}:`, error)
            if (
              methodName === 'completions' &&
              currentProcessingContext &&
              (currentProcessingContext as AiProviderMiddlewareCompletionsContext).onChunk
            ) {
              const completionsCtx = currentProcessingContext as AiProviderMiddlewareCompletionsContext
              if (typeof completionsCtx.onChunk === 'function') {
                completionsCtx.onChunk(createErrorChunk(error))
              }
            }
            throw error
          }
        }
      }

      const val = Reflect.get(target, propKey, receiver)
      if (typeof val === 'function') {
        const func = val as (...args: any[]) => any
        return func.bind(target)
      }
      return val
    }
  })
  return proxy as BaseProvider
}

/**
 * Wraps a provider instance with one or more middlewares.
 * Middlewares are applied in a chained (onion-like) fashion using Proxies.
 * The last middleware in the array becomes the innermost layer.
 * @param providerInstance The provider instance to wrap.
 * @param middlewaresToApply An array of middlewares.
 * @returns The provider instance wrapped with the specified middlewares.
 */
export function wrapProviderWithMiddleware(
  providerInstance: BaseProvider,
  middlewaresToApply: AiProviderMiddleware[]
): BaseProvider {
  if (!middlewaresToApply || middlewaresToApply.length === 0) {
    return providerInstance
  }

  let wrappedProvider = providerInstance
  for (let i = middlewaresToApply.length - 1; i >= 0; i--) {
    const middleware = middlewaresToApply[i]
    if (middleware) {
      wrappedProvider = doWrapSingleProvider(wrappedProvider, middleware)
    }
  }
  return wrappedProvider
}
