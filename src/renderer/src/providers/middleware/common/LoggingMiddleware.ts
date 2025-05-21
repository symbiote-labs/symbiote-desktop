import { Chunk, ErrorChunk } from '@renderer/types/chunk'

import {
  AiProviderMiddleware,
  AiProviderMiddlewareCompletionsContext,
  FinalizeSdkParamsNextFunction,
  NextExecutionFunction,
  OnChunkFunction
} from '../AiProviderMiddlewareTypes'

// Helper to get message content safely for logging
const getMessageContentForLogging = (message: any): string => {
  if (!message) return '[Null/Undefined Message]'
  if (typeof message.content === 'string') {
    return message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '')
  }
  if (
    Array.isArray(message.blocks) &&
    message.blocks.length > 0 &&
    message.blocks[0] &&
    typeof message.blocks[0].content === 'string'
  ) {
    return message.blocks[0].content.substring(0, 50) + (message.blocks[0].content.length > 50 ? '...' : '')
  }
  if (typeof message.text === 'string') {
    return message.text.substring(0, 100) + (message.text.length > 100 ? '...' : '')
  }
  if (message.role && typeof message.role === 'string') {
    return `[Message Role: ${message.role}`
  }
  return '[Unable to display message content]'
}

export const loggingMiddleware: AiProviderMiddleware = {
  name: 'LoggingMiddleware',

  prepareCompletionsContext: async (context: AiProviderMiddlewareCompletionsContext) => {
    const assistantId = context.assistant?.id || 'unknown-assistant'
    const modelId = context.model?.id || 'unknown-model'
    console.log(
      `[${loggingMiddleware.name} (${assistantId}-${modelId})] prepareCompletionsContext. Messages:`,
      context.messages?.map(getMessageContentForLogging) || '[No Messages]'
    )
    return context
  },

  wrapCompletionsOnChunkCallback: (
    originalOnChunk: OnChunkFunction,
    context: AiProviderMiddlewareCompletionsContext
  ) => {
    const assistantId = context.assistant?.id || 'unknown-assistant'
    const modelId = context.model?.id || 'unknown-model'
    console.log(`[${loggingMiddleware.name} (${assistantId}-${modelId})] wrapCompletionsOnChunkCallback setup.`)
    return (chunk: Chunk | ErrorChunk) => {
      console.log(`[${loggingMiddleware.name} (${assistantId}-${modelId})] onChunk: type=${chunk.type}`, chunk)
      originalOnChunk(chunk)
    }
  },

  aroundCompletionsExecution: async (context: AiProviderMiddlewareCompletionsContext, next: NextExecutionFunction) => {
    const assistantId = context.assistant?.id || 'unknown-assistant'
    const modelId = context.model?.id || 'unknown-model'
    console.log(
      `[${loggingMiddleware.name} (${assistantId}-${modelId})] aroundCompletionsExecution: BEFORE next(). Messages:`,
      context.messages?.map(getMessageContentForLogging) || '[No Messages]'
    )

    const startTime = Date.now()

    try {
      const result = await next(context)
      const duration = Date.now() - startTime
      console.log(
        `[${loggingMiddleware.name} (${assistantId}-${modelId})] aroundCompletionsExecution: AFTER next() (SUCCESS). Duration: ${duration}ms`
      )
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(
        `[${loggingMiddleware.name} (${assistantId}-${modelId})] aroundCompletionsExecution: AFTER next() (ERROR). Duration: ${duration}ms`,
        error
      )
      throw error
    }
  },

  finalizeCompletionsSdkParams: async (
    sdkParams: any,
    context: AiProviderMiddlewareCompletionsContext,
    next: FinalizeSdkParamsNextFunction
  ) => {
    const assistantId = context.assistant?.id || 'unknown-assistant'
    const modelId = context.model?.id || 'unknown-model'
    console.log(
      `[${loggingMiddleware.name} (${assistantId}-${modelId})] finalizeCompletionsSdkParams: BEFORE next(). SDK Params:`,
      sdkParams
    )
    const resultParams = await next(sdkParams, context)
    console.log(
      `[${loggingMiddleware.name} (${assistantId}-${modelId})] finalizeCompletionsSdkParams: AFTER next(). Final SDK Params:`,
      resultParams
    )
    return resultParams
  }
}
