import { getDefaultModel } from '@renderer/services/AssistantService'
import { Model } from '@renderer/types'
import { ChunkType, ErrorChunk } from '@renderer/types/chunk'
import { ResponseError } from '@renderer/types/newMessage'

import { CompletionsParams } from '../AiProvider'
import BaseProvider from '../AiProvider/BaseProvider'
import {
  AiProviderMiddleware,
  AiProviderMiddlewareCompletionsContext,
  NextCompletionsFunction
} from './AiProviderMiddlewareTypes'

export const wrapProviderWithMiddleware = (
  providerInstance: BaseProvider,
  middlewareInput: AiProviderMiddleware | AiProviderMiddleware[]
): BaseProvider => {
  const middlewares = Array.isArray(middlewareInput) ? middlewareInput : [middlewareInput]

  const finalWrappedProvider = middlewares.reduceRight((currentWrappedProvider, middleware) => {
    return doWrapSingleProvider(currentWrappedProvider, middleware)
  }, providerInstance)

  return finalWrappedProvider
}

const createErrorChunk = (message: string, code?: string | number): ErrorChunk => {
  const errorPayload: ResponseError = { message }
  if (code !== undefined) {
    errorPayload.code = code
  }
  return {
    type: ChunkType.ERROR,
    error: errorPayload
  }
}

const doWrapSingleProvider = (providerToWrap: BaseProvider, middleware: AiProviderMiddleware): BaseProvider => {
  const handler: ProxyHandler<BaseProvider> = {
    get: (target, prop, receiver) => {
      if (prop === 'completions') {
        return async (params: CompletionsParams): Promise<void> => {
          const assistant = params.assistant
          if (!assistant) {
            // TODO: onChunk Error 是否要这样使用有待商榷,因为内部错误不应该直达用户
            params.onChunk(createErrorChunk('Assistant is not available in params.'))
            return
          }
          const model: Model | null = assistant.model || getDefaultModel()
          if (!model) {
            params.onChunk(createErrorChunk('Model is not available in assistant settings or default.'))
            return
          }

          let completionCtx: AiProviderMiddlewareCompletionsContext = {
            params,
            assistant,
            model,
            messages: params.messages,
            mcpTools: params.mcpTools,
            onChunk: params.onChunk,
            onFilterMessages: params.onFilterMessages
          }

          if (middleware.transformCompletionsParams) {
            try {
              completionCtx = await middleware.transformCompletionsParams(completionCtx)
            } catch (e: any) {
              console.error(`Error in middleware '${middleware.id || 'anonymous'}' (transformCompletionsParams):`, e)
              ;(completionCtx.onChunk || params.onChunk)(
                createErrorChunk(
                  `Middleware (${middleware.id || 'anonymous'}) failed during param transformation: ${e.message}`
                )
              )
              return
            }
          }

          if (middleware.wrapOnChunk) {
            try {
              const contextForWrapOnChunk = { ...completionCtx }
              completionCtx.onChunk = middleware.wrapOnChunk(
                completionCtx.onChunk,
                Object.freeze(contextForWrapOnChunk)
              )
            } catch (e: any) {
              console.error(`Error in middleware '${middleware.id || 'anonymous'}' (wrapOnChunk setup):`, e)
              ;(completionCtx.onChunk || params.onChunk)(
                createErrorChunk(
                  `Middleware (${middleware.id || 'anonymous'}) failed during onChunk wrapping: ${e.message}`
                )
              )
              return
            }
          }

          const next: NextCompletionsFunction = async (nextContext) => {
            const originalCompletionsFn = Reflect.get(target, prop, receiver) as (p: CompletionsParams) => Promise<void>
            return originalCompletionsFn.call(target, {
              messages: nextContext.messages,
              assistant: nextContext.assistant,
              mcpTools: nextContext.mcpTools,
              onChunk: nextContext.onChunk,
              onFilterMessages: nextContext.onFilterMessages
            })
          }

          if (middleware.wrapCompletions) {
            try {
              return await middleware.wrapCompletions(completionCtx, next)
            } catch (e: any) {
              console.error(
                `Error in middleware '${middleware.id || 'anonymous'}' (wrapCompletions or from next()):`,
                e
              )
              throw e
            }
          } else {
            return next(completionCtx)
          }
        }
      }

      return Reflect.get(target, prop, receiver)
    }
  }

  return new Proxy(providerToWrap, handler)
}
