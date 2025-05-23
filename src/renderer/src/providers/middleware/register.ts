import { AiProviderMiddlewareConfig } from './AiProviderMiddlewareTypes'
import { createCompletionsLoggingMiddleware } from './common/CompletionsLoggingMiddleware'
import { createGenericLoggingMiddleware } from './common/LoggingMiddleware'
import { FinalChunkConsumerAndNotifierMiddleware } from './openai/FinalChunkConsumerAndNotifierMiddleware'
import { OpenAISDKChunkToStandardChunkMiddleware } from './openai/OpenAISDKChunkToStandardChunkMiddleware'
import { StreamAdapterMiddleware } from './openai/StreamAdapterMiddleware'

// Construct AiProviderMiddlewareConfig
// Assuming loggingMiddleware is a ProviderMethodMiddleware. Adjust if it's a CompletionsMiddleware.
const middlewareConfig: AiProviderMiddlewareConfig = {
  // Use the specialized logger for 'completions'. This array expects CompletionsMiddleware.
  completions: [
    createCompletionsLoggingMiddleware(),
    FinalChunkConsumerAndNotifierMiddleware,
    OpenAISDKChunkToStandardChunkMiddleware,
    StreamAdapterMiddleware
  ],

  // Use the generic logger for other methods. These arrays expect ProviderMethodMiddleware.
  methods: {
    translate: [createGenericLoggingMiddleware()],
    summaries: [createGenericLoggingMiddleware()]
    // Example: If you had another method like 'generateText' that needs generic logging:
    // generateText: [createGenericLoggingMiddleware()],

    // IMPORTANT: Based on current index.ts logic, if 'completions' array above is populated,
    // the 'methods.completions' entry below would NOT be used for the 'completions' method.
    // If the 'completions' array above were empty or undefined, then 'methods.completions' would be consulted.
    // If you intend for generic logging to ALSO run for 'completions', the setup is more complex
    // and might require changes in how index.ts composes middlewares from these two properties.
    // For now, this structure assumes distinct middleware sets.
  }
}

export default middlewareConfig
