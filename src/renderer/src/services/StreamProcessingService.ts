import type { GenerateImageResponse, MCPToolResponse, WebSearchResponse } from '@renderer/types'
import type { Chunk } from '@renderer/types/chunk'

// Define the structure for the callbacks that the StreamProcessor will invoke
export interface StreamProcessorCallbacks {
  // Text content chunk received
  onTextChunk?: (text: string) => void
  // Full text content received
  onTextComplete?: (text: string) => void
  // Thinking/reasoning content chunk received (e.g., from Claude)
  onThinkingChunk?: (text: string) => void
  // A tool call response chunk (from MCP)
  onToolCallComplete?: (toolResponse: MCPToolResponse) => void
  // Citation data received (e.g., from Perplexity, OpenRouter)
  onWebSearch?: (webSearch: WebSearchResponse) => void
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
  return (chunk: Chunk) => {
    try {
      // 1. Handle the manual final signal first
      if (chunk?.type === 'block_complete') {
        callbacks.onComplete?.('success')
        return
      }

      // 2. Process the actual ChunkCallbackData
      const data = chunk // Cast after checking for 'final'
      console.log('createStreamProcessor', data)
      // Invoke callbacks based on the fields present in the chunk data
      if (data.type === 'text.delta' && callbacks.onTextChunk) {
        callbacks.onTextChunk(data.text)
      }
      if (data.type === 'text.complete' && callbacks.onTextComplete) {
        callbacks.onTextComplete(data.text)
      }
      if (data.type === 'thinking.delta' && callbacks.onThinkingChunk) {
        callbacks.onThinkingChunk(data.text)
      }
      if (data.type === 'mcp_tool_response' && data.responses.length > 0 && callbacks.onToolCallComplete) {
        // TODO 目前tool只有mcp,也可以将web search等其他tool整合进来
        data.responses.forEach((toolResp) => callbacks.onToolCallComplete!(toolResp))
      }

      if (data.type === 'web_search' && callbacks.onWebSearch) {
        callbacks.onWebSearch(data.web_search)
      }

      // Note: Usage and Metrics are usually handled at the end or accumulated differently,
      // so direct callbacks might not be the best fit here. They are often part of the final message state.
    } catch (error) {
      console.error('Error processing stream chunk:', error)
      callbacks.onError?.(error)
    }
  }
}
