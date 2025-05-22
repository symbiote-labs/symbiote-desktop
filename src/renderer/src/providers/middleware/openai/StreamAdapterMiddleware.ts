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
  sdkStream: OpenAI.Chat.Completions.ChatCompletion & {
    _request_id?: string | null
  } & Stream<OpenAI.Chat.Completions.ChatCompletionChunk>
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

export const StreamAdapterMiddleware: CompletionsMiddleware = (_) => (next) => async (context, args) => {
  // Get the CompletionsResult from the next middleware/provider.
  // Its `stream` property is expected to be the raw SDK stream.
  const originalResult = await next(context, args)

  // Ensure the stream from the original result is indeed a RawSdkStream.
  // This check might be more robust depending on how RawSdkStream is typed
  // or if there's a flag in CompletionsResult.
  if (
    originalResult.stream &&
    typeof (originalResult.stream as any).getReader === 'function' &&
    !(originalResult.stream instanceof ReadableStream)
  ) {
    const rawSdkStream = originalResult.stream

    // Adapt the raw SDK stream to our application's Chunk stream
    const adaptedChunkStream = asyncGeneratorToReadableStream(openAIStreamToChunkAdapter(rawSdkStream))

    // Return a new CompletionsResult with the adapted stream
    // and carry over other properties from the original result (like finalUsage, finalMetrics if they exist)
    const adaptedResult = {
      ...originalResult,
      stream: adaptedChunkStream // Assert the new stream type
    }
    return adaptedResult
  } else {
    // If the stream is not in the expected raw format (e.g., it's already adapted or not a stream),
    // or if there's no stream (which shouldn't happen if provider guarantees it for streaming calls),
    // then return the original result. This case needs careful consideration based on type definitions.
    // This implies that `originalResult.stream` was already an `AdaptedChunkStream` or `CompletionsResult` was for non-streaming.
    // console.warn("StreamAdapterMiddleware: Stream from 'next()' was not in the expected RawSdkStream format, was missing, or was already a ReadableStream.");
    return originalResult // Return as is, assuming it's already a valid CompletionsResult for downstream
  }
}
