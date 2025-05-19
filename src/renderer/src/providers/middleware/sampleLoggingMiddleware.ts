import {
  AiProviderMiddleware,
  AiProviderMiddlewareCompletionsContext,
  NextCompletionsFunction,
  OnChunkArg
} from './AiProviderMiddlewareTypes'

// Helper to get message content safely for logging
const getMessageContentForLogging = (message: any): string => {
  if (typeof message.content === 'string') {
    return message.content
  }
  // Assuming Message structure from @renderer/types/newMessage might have blocks
  if (
    Array.isArray(message.blocks) &&
    message.blocks.length > 0 &&
    message.blocks[0] &&
    typeof message.blocks[0].content === 'string'
  ) {
    return message.blocks[0].content.substring(0, 50) + (message.blocks[0].content.length > 50 ? '...' : '')
  }
  if (typeof message.text === 'string') {
    // Fallback for a simple .text property
    return message.text
  }
  if (message.role && typeof message.role === 'string') {
    // Log role if content is complex
    return `[Message Role: ${message.role}, Content structure not directly loggable]`
  }
  return '[Unable to display message content]'
}

export const loggingMiddleware: AiProviderMiddleware = {
  id: 'sample-logging-middleware',

  transformCompletionsParams: async (context: AiProviderMiddlewareCompletionsContext) => {
    console.log(
      `[LoggingMiddleware (${context.assistant.id}-${context.model.id})] transformCompletionsParams. Messages:`,
      context.messages.map(getMessageContentForLogging) // Use helper for safer logging
    )
    // Example: Add a prefix to user messages if you wanted to modify params
    // const newMessages = context.messages.map(msg => {
    //   if (msg.role === 'user') {
    //     return { ...msg, content: `[Logged] ${msg.content}` };
    //   }
    //   return msg;
    // });
    // return { ...context, messages: newMessages };
    return context // No actual modification in this example
  },

  wrapOnChunk: (originalOnChunk, context: AiProviderMiddlewareCompletionsContext) => {
    console.log(`[LoggingMiddleware (${context.assistant.id}-${context.model.id})] wrapOnChunk setup.`)
    return (chunk: OnChunkArg) => {
      console.log(
        `[LoggingMiddleware (${context.assistant.id}-${context.model.id})] onChunk: type=${chunk.type}`,
        chunk
      )

      // Example: Filter out certain chunk types if needed (not recommended to swallow without reason)
      // if (chunk.type === ChunkType.THINKING) {
      //   console.log(`[LoggingMiddleware (${context.assistant.id}-${context.model.id})] Skipping THINKING chunk.`);
      //   return;
      // }

      originalOnChunk(chunk) // IMPORTANT: Always call the original onChunk
    }
  },

  wrapCompletions: async (context: AiProviderMiddlewareCompletionsContext, next: NextCompletionsFunction) => {
    console.log(
      `[LoggingMiddleware (${context.assistant.id}-${context.model.id})] wrapCompletions: BEFORE next(). Messages:`,
      context.messages.map(getMessageContentForLogging) // Use helper for safer logging
    )

    const startTime = Date.now()

    try {
      await next(context) // Call the next middleware in the chain or the original provider's completions
      const duration = Date.now() - startTime
      console.log(
        `[LoggingMiddleware (${context.assistant.id}-${context.model.id})] wrapCompletions: AFTER next() (SUCCESS). Duration: ${duration}ms`
      )
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(
        `[LoggingMiddleware (${context.assistant.id}-${context.model.id})] wrapCompletions: AFTER next() (ERROR). Duration: ${duration}ms`,
        error
      )
      throw error // Re-throw the error to allow higher-level error handlers to catch it
    }
  }
}
