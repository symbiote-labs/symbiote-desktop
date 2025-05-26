import { Chunk, ChunkType, TextCompleteChunk } from '@renderer/types/chunk'
import { isEmpty } from 'lodash'
import OpenAI from 'openai'

import type { CompletionsOpenAIResult, CompletionsParams } from '../../AiProvider'
import { AiProviderMiddlewareCompletionsContext, CompletionsMiddleware } from '../middlewareTypes'

const MIDDLEWARE_NAME = 'TextChunkMiddleware'

export const TextChunkMiddleware: CompletionsMiddleware =
  () => (next) => async (context: AiProviderMiddlewareCompletionsContext, params: CompletionsParams) => {
    const resultFromUpstream = await next(context, params)

    console.log(
      `[${MIDDLEWARE_NAME}] Received result from upstream. Stream is: ${resultFromUpstream.stream ? 'present' : 'absent'}`
    )

    // We expect resultFromUpstream.stream to be either:
    // - ReadableStream<OpenAI.Chat.Completions.ChatCompletionChunk> (from StreamAdapterMiddleware)
    // - ReadableStream<Chunk | OpenAI.Chat.Completions.ChatCompletionChunk> (from ThinkChunkMiddleware)
    if (resultFromUpstream.stream && resultFromUpstream.stream instanceof ReadableStream) {
      // Cast to the mixed stream type to handle both cases
      const mixedStream = resultFromUpstream.stream as ReadableStream<
        Chunk | OpenAI.Chat.Completions.ChatCompletionChunk
      >

      // 使用TransformStream进行流式处理，专注于文本内容
      let accumulatedText = ''

      const standardChunkStream = mixedStream.pipeThrough(
        new TransformStream<Chunk | OpenAI.Chat.Completions.ChatCompletionChunk, Chunk>({
          transform(item, controller) {
            // Check if this is already a Chunk (from ThinkChunkMiddleware)
            if ('type' in item && typeof item.type === 'string') {
              // This is already a Chunk, pass it through
              const chunk = item as Chunk
              controller.enqueue(chunk)
              return
            }

            // This is a ChatCompletionChunk, convert it to standard Chunk format
            const sdkChunk = item as OpenAI.Chat.Completions.ChatCompletionChunk
            const choice = sdkChunk.choices?.[0]
            if (!choice) return

            const delta = choice.delta

            // 只处理文本内容，工具调用由 McpToolChunkMiddleware 处理
            if (delta?.content) {
              accumulatedText += delta.content
              controller.enqueue({ type: ChunkType.TEXT_DELTA, text: delta.content })
            }

            // 在流结束时发送完整文本
            if (!isEmpty(choice.finish_reason)) {
              if (accumulatedText) {
                const textCompleteChunk: TextCompleteChunk = {
                  type: ChunkType.TEXT_COMPLETE,
                  text: accumulatedText
                }
                controller.enqueue(textCompleteChunk)
              }
            }
          }
        })
      )

      const adaptedResult: CompletionsOpenAIResult = {
        ...resultFromUpstream,
        stream: standardChunkStream
      }
      console.log(
        `[${MIDDLEWARE_NAME}] Converted mixed stream to standard Chunks using TransformStream.`,
        adaptedResult
      )
      return adaptedResult
    } else {
      console.log(`[${MIDDLEWARE_NAME}] No stream to process or not a ReadableStream. Returning original result.`)
      return resultFromUpstream
    }
  }
