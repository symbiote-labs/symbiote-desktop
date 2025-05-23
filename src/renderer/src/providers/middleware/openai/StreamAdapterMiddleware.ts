import { Usage } from '@renderer/types' // Assuming Metrics might be part of CompletionsResult
import { Chunk, ChunkType, LLMResponseCompleteChunk } from '@renderer/types/chunk'
import { asyncGeneratorToReadableStream } from '@renderer/utils/stream'
import OpenAI from 'openai'
import type { Stream } from 'openai/streaming'

// Assuming CompletionsResult, RawSdkStream, AdaptedChunkStream are defined and exported appropriately
// (e.g., from AiProvider/index.ts or AiProviderMiddlewareTypes.ts)
// Adjusted import path
import {
  CompletionsMiddleware
  // AiProviderMiddlewareCompletionsContext // Not directly needed if we just pass context through
} from '../AiProviderMiddlewareTypes'

// Adapter function to convert OpenAI SDK stream to Chunk stream
async function* openAIStreamToChunkAdapter(
  sdkStream: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>
): AsyncGenerator<Chunk> {
  for await (const sdkChunk of sdkStream) {
    const choice = sdkChunk.choices?.[0]
    if (!choice) continue

    const delta = choice.delta

    if (delta?.content) {
      yield { type: ChunkType.TEXT_DELTA, text: delta.content }
    }

    if (delta?.tool_calls && delta.tool_calls.length > 0) {
      yield {
        type: ChunkType.MCP_TOOL_IN_PROGRESS,
        responses: delta.tool_calls.map((tc) => ({
          id: tc.id,
          index: tc.index,
          name: tc.function?.name,
          arguments: tc.function?.arguments,
          type: tc.type
        })) as any // Adjust 'as any' if you have a strict type for this Chunk
      }
    }

    if (choice.finish_reason) {
      const usage: Usage | undefined = sdkChunk.usage
        ? {
            completion_tokens: sdkChunk.usage.completion_tokens || 0,
            prompt_tokens: sdkChunk.usage.prompt_tokens || 0,
            total_tokens: sdkChunk.usage.total_tokens || 0
          }
        : undefined

      const completeChunk: LLMResponseCompleteChunk = {
        type: ChunkType.LLM_RESPONSE_COMPLETE,
        response: {
          usage: usage
        }
      }
      yield completeChunk
      break
    }
  }
}

export const StreamAdapterMiddleware: CompletionsMiddleware = () => (next) => async (context, args) => {
  // Get the CompletionsResult from the next middleware/provider.
  // Its `stream` property is expected to be the raw SDK stream.
  const originalResult = await next(context, args)

  console.log('🚀 StreamAdapterMiddleware: Original result received:', originalResult)
  if (
    originalResult.stream &&
    !(originalResult.stream instanceof ReadableStream) && // Check if it's NOT already our target ReadableStream
    typeof (originalResult.stream as any)[Symbol.asyncIterator] === 'function' // Check if it's an async iterable (like OpenAI's stream)
  ) {
    const rawSdkStream = originalResult.stream as Stream<OpenAI.Chat.Completions.ChatCompletionChunk>

    const adaptedChunkStream = asyncGeneratorToReadableStream(openAIStreamToChunkAdapter(rawSdkStream))
    const adaptedResult = {
      ...originalResult,
      stream: adaptedChunkStream // Assert the new stream type
    }
    console.log('🚀 StreamAdapterMiddleware: Adapted result:', adaptedResult)
    return adaptedResult
  } else {
    return originalResult
  }
}
