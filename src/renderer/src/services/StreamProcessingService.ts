import type { GroundingMetadata } from '@google/genai'
import type { ChunkCallbackData } from '@renderer/providers/AiProvider'
import { GenerateImageResponse, MCPToolResponse } from '@renderer/types'
import type OpenAI from 'openai'

// Define the structure for the callbacks that the StreamProcessor will invoke
export interface StreamProcessorCallbacks {
  // Text content chunk received
  onTextChunk?: (text: string) => void
  // Thinking/reasoning content chunk received (e.g., from Claude)
  onThinkingChunk?: (text: string) => void
  // A tool call response chunk (from MCP)
  onToolCallComplete?: (toolResponse: MCPToolResponse) => void
  // Citation data received (e.g., from Perplexity, OpenRouter)
  onCitationData?: (citations: string[]) => void
  // Web search results received (Gemini format)
  onWebSearchGrounding?: (groundingMetadata: GroundingMetadata) => void
  // Web search annotations received (OpenAI format)
  onWebSearchAnnotations?: (annotations: OpenAI.Chat.Completions.ChatCompletionMessage.Annotation[]) => void
  // Web search info received (Zhipu, Hunyuan format)
  onWebSearchInfo?: (webSearchData: any[]) => void
  // Image generation chunk received
  onImageGenerated?: (imageData: GenerateImageResponse) => void
  // Called when an error occurs during chunk processing
  onError?: (error: any) => void
  // Called when the entire stream processing is signaled as complete (success or failure)
  onComplete?: (status: 'success' | 'error', finalError?: any) => void
}

// Function to create a stream processor instance
export function createStreamProcessor(callbacks: StreamProcessorCallbacks) {
  // The returned function processes a single chunk or a final signal
  return (
    chunk: ChunkCallbackData | { type: 'final'; status: 'success' | 'error'; error?: any } | null | undefined
  ) => {
    try {
      // 1. Handle the final signal first (for both success and error)
      if (chunk && typeof chunk === 'object' && 'type' in chunk && chunk.type === 'final') {
        // Call onComplete regardless of status, passing both status and error
        callbacks.onComplete?.(chunk.status, chunk.error)
        return
      }

      // 2. Process the actual ChunkCallbackData if it's not a final signal
      // Ensure chunk is not null/undefined and not the 'final' type before proceeding
      if (!chunk || (typeof chunk === 'object' && 'type' in chunk && chunk.type === 'final')) {
        return // Do nothing more if it's null, undefined, or the final signal (already handled)
      }

      // Now, chunk must be ChunkCallbackData
      const data = chunk as ChunkCallbackData
      console.log('createStreamProcessor', data)
      // Invoke callbacks based on the fields present in the chunk data
      if (data.text && callbacks.onTextChunk) {
        callbacks.onTextChunk(data.text)
      }
      if (data.reasoning_content && callbacks.onThinkingChunk) {
        callbacks.onThinkingChunk(data.reasoning_content)
      }
      if (data.mcpToolResponse && data.mcpToolResponse.length > 0 && callbacks.onToolCallComplete) {
        // TODO 目前tool只有mcp,也可以将web search等其他tool整合进来
        data.mcpToolResponse.forEach((toolResp) => callbacks.onToolCallComplete!(toolResp))
      }
      if (data.citations && data.citations.length > 0 && callbacks.onCitationData) {
        callbacks.onCitationData(data.citations)
      }
      if (data.search && callbacks.onWebSearchGrounding) {
        callbacks.onWebSearchGrounding(data.search)
      }
      if (data.annotations && data.annotations.length > 0 && callbacks.onWebSearchAnnotations) {
        callbacks.onWebSearchAnnotations(data.annotations)
      }
      if (data.webSearch && data.webSearch.length > 0 && callbacks.onWebSearchInfo) {
        callbacks.onWebSearchInfo(data.webSearch)
      }
      if (data.generateImage && callbacks.onImageGenerated) {
        callbacks.onImageGenerated(data.generateImage)
      }

      // Note: Usage and Metrics are usually handled at the end or accumulated differently,
      // so direct callbacks might not be the best fit here. They are often part of the final message state.
    } catch (error) {
      console.error('Error processing stream chunk:', error)
      callbacks.onError?.(error)
    }
  }
}
