import { Assistant, MCPTool, Model } from '@renderer/types'
import { Message } from '@renderer/types/newMessage'

import { CompletionsParams } from '../../AiProvider'
import {
  AiProviderMiddlewareBaseContext,
  AiProviderMiddlewareCompletionsContext,
  OnChunkFunction,
  OnFilterMessagesFunction
} from '../AiProviderMiddlewareTypes'

export function createCompletionsContext(
  baseContextData: AiProviderMiddlewareBaseContext
): AiProviderMiddlewareCompletionsContext {
  const currentParams = baseContextData.params as CompletionsParams | undefined

  const model: Model = currentParams?.assistant?.model ?? currentParams?.assistant?.defaultModel
  const messages: Message[] = currentParams?.messages
  const assistant: Assistant = currentParams?.assistant
  const mcpTools: MCPTool[] = currentParams?.mcpTools
  const onChunkFromParams: OnChunkFunction | undefined = currentParams?.onChunk
  const onFilterMessagesFromParams: OnFilterMessagesFunction | undefined = currentParams?.onFilterMessages

  const completionsContext: AiProviderMiddlewareCompletionsContext = {
    ...baseContextData,
    methodName: 'completions',
    originalParams: currentParams,
    params: currentParams, // Keep params field consistent with AiProviderMiddlewareCompletionsContext
    model: model,
    messages: messages,
    assistant: assistant,
    mcpTools: mcpTools,
    // onChunk and onFilterMessages are required in AiProviderMiddlewareCompletionsContext.
    // This casting is safe if currentParams is valid and conforms to CompletionsParams definition.
    onChunk: onChunkFromParams as OnChunkFunction,
    onFilterMessages: onFilterMessagesFromParams as OnFilterMessagesFunction
  }
  return completionsContext
}
