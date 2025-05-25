import {
  isReasoningModel,
  isSupportedReasoningEffortModel,
  isSupportedThinkingTokenModel
} from '@renderer/config/models'
import { extractReasoningMiddleware } from '@renderer/middlewares/extractReasoningMiddleware'
import { Model } from '@renderer/types'
import { Chunk, ChunkType, ThinkingCompleteChunk, ThinkingDeltaChunk } from '@renderer/types/chunk'
import { asyncGeneratorToReadableStream } from '@renderer/utils/stream'
import { isEmpty } from 'lodash'
import OpenAI from 'openai'

import type { CompletionsOpenAIResult, CompletionsParams } from '../../AiProvider'
import { AiProviderMiddlewareCompletionsContext, CompletionsMiddleware } from '../middlewareTypes'

const MIDDLEWARE_NAME = 'ThinkChunkMiddleware'

/**
 * 处理思考内容的中间件
 * 职责：
 * 1. 从OpenAI SDK chunks中提取reasoning内容
 * 2. 将reasoning内容转换为标准的THINKING_DELTA和THINKING_COMPLETE chunks
 * 3. 清理SDK chunks中的reasoning字段
 * 4. 输出混合流：Chunk（thinking相关）+ ChatCompletionChunk（清理后的SDK chunks）
 * 5. 不直接调用onChunk，由FinalChunkConsumerAndNotifierMiddleware负责消费
 * 6. 使用TransformStream实现真正的流式处理
 */

// 定义OpenAI流chunk的类型，与原实现保持一致
export type OpenAIStreamChunk =
  | { type: 'reasoning' | 'text-delta'; textDelta: string; originalChunk: OpenAI.Chat.Completions.ChatCompletionChunk }
  | { type: 'tool-calls'; delta: any; originalChunk: OpenAI.Chat.Completions.ChatCompletionChunk }
  | { type: 'finish'; finishReason: any; usage: any; delta: any; chunk: any }

// 获取适当的reasoning标签配置
function getAppropriateTag(model: Model) {
  const reasoningTags = [
    { openingTag: '<think>', closingTag: '</think>', separator: '\n' },
    { openingTag: '###Thinking', closingTag: '###Response', separator: '\n' }
  ]
  if (model.id.includes('qwen3')) return reasoningTags[0]
  return reasoningTags[0]
}

// 检查是否启用reasoning
function isReasoningEnabled(model: Model, assistant: any): boolean {
  // 与原实现保持一致的reasoning启用逻辑
  return (
    ((isSupportedThinkingTokenModel(model) || isSupportedReasoningEffortModel(model)) &&
      assistant.settings?.reasoning_effort !== undefined) ||
    (isReasoningModel(model) && (!isSupportedThinkingTokenModel(model) || !isSupportedReasoningEffortModel(model)))
  )
}

export const ThinkChunkMiddleware: CompletionsMiddleware =
  () => (next) => async (context: AiProviderMiddlewareCompletionsContext, params: CompletionsParams) => {
    const resultFromUpstream = await next(context, params)

    console.log(
      `[${MIDDLEWARE_NAME}] Received result from upstream. Stream is: ${resultFromUpstream.stream ? 'present' : 'absent'}`
    )

    // 检查是否有流需要处理
    if (resultFromUpstream.stream && resultFromUpstream.stream instanceof ReadableStream) {
      const rawSdkChunkStream = resultFromUpstream.stream as ReadableStream<OpenAI.Chat.Completions.ChatCompletionChunk>
      const model = context.model!
      const assistant = context.assistant!
      const enableReasoning = isReasoningEnabled(model, assistant)

      // 1. 将OpenAI SDK chunks转换为标准化的OpenAIStreamChunk格式
      async function* openAIChunkToTextDelta(
        stream: ReadableStream<OpenAI.Chat.Completions.ChatCompletionChunk>
      ): AsyncGenerator<OpenAIStreamChunk> {
        const reader = stream.getReader()
        try {
          while (true) {
            const { done, value: chunk } = await reader.read()
            if (done) break

            if (!chunk) continue

            const delta = chunk.choices[0]?.delta
            if ((delta as any)?.reasoning_content || (delta as any)?.reasoning) {
              yield {
                type: 'reasoning',
                textDelta: (delta as any).reasoning_content || (delta as any).reasoning,
                originalChunk: chunk
              }
            }
            if (delta?.content) {
              yield { type: 'text-delta', textDelta: delta.content, originalChunk: chunk }
            }
            if (delta?.tool_calls) {
              yield { type: 'tool-calls', delta: delta, originalChunk: chunk }
            }

            const finishReason = chunk.choices[0]?.finish_reason
            if (!isEmpty(finishReason)) {
              yield { type: 'finish', finishReason, usage: chunk.usage, delta, chunk }
              break
            }
          }
        } finally {
          reader.releaseLock()
        }
      }

      // 2. 使用extractReasoningMiddleware处理<think>标签
      const reasoningTag = getAppropriateTag(model)
      const { stream: processedStream } = await extractReasoningMiddleware<OpenAIStreamChunk>({
        openingTag: reasoningTag?.openingTag,
        closingTag: reasoningTag?.closingTag,
        separator: reasoningTag?.separator,
        enableReasoning
      }).wrapStream({
        doStream: async () => ({
          stream: asyncGeneratorToReadableStream(openAIChunkToTextDelta(rawSdkChunkStream))
        })
      })

      // 3. 使用TransformStream处理thinking内容并输出混合流
      let thinkingContent = ''
      let timeFirstTokenMillsec = 0
      let isFirstChunk = true

      const mixedStream = processedStream.pipeThrough(
        new TransformStream<OpenAIStreamChunk, Chunk | OpenAI.Chat.Completions.ChatCompletionChunk>({
          transform(chunk, controller) {
            switch (chunk.type) {
              case 'reasoning': {
                if (timeFirstTokenMillsec === 0) {
                  timeFirstTokenMillsec = Date.now()
                }
                thinkingContent += chunk.textDelta

                // 生成THINKING_DELTA chunk并输出到流
                const thinkingDeltaChunk: ThinkingDeltaChunk = {
                  type: ChunkType.THINKING_DELTA,
                  text: chunk.textDelta,
                  thinking_millsec: Date.now() - timeFirstTokenMillsec
                }
                controller.enqueue(thinkingDeltaChunk)
                // reasoning chunks不传递给下游
                break
              }
              case 'text-delta': {
                // 在第一个text-delta时，如果有thinking内容，输出THINKING_COMPLETE
                if (isFirstChunk) {
                  isFirstChunk = false
                  if (timeFirstTokenMillsec === 0) {
                    timeFirstTokenMillsec = Date.now()
                  } else if (thinkingContent) {
                    const thinkingCompleteChunk: ThinkingCompleteChunk = {
                      type: ChunkType.THINKING_COMPLETE,
                      text: thinkingContent,
                      thinking_millsec: Date.now() - timeFirstTokenMillsec
                    }
                    controller.enqueue(thinkingCompleteChunk)
                  }
                }

                // 重建清理后的SDK chunk用于下游处理
                const originalChunk = chunk.originalChunk
                if (originalChunk && originalChunk.choices) {
                  const reconstructedChunk: OpenAI.Chat.Completions.ChatCompletionChunk = {
                    ...originalChunk,
                    choices: originalChunk.choices.map((choice) => ({
                      ...choice,
                      delta: {
                        ...choice.delta,
                        content: chunk.textDelta,
                        // 确保reasoning字段被清理
                        reasoning_content: undefined,
                        reasoning: undefined
                      }
                    }))
                  }
                  controller.enqueue(reconstructedChunk)
                }
                break
              }
              case 'tool-calls': {
                // 在第一个tool-calls时，如果有thinking内容，输出THINKING_COMPLETE
                if (isFirstChunk) {
                  isFirstChunk = false
                  if (timeFirstTokenMillsec === 0) {
                    timeFirstTokenMillsec = Date.now()
                  } else if (thinkingContent) {
                    const thinkingCompleteChunk: ThinkingCompleteChunk = {
                      type: ChunkType.THINKING_COMPLETE,
                      text: thinkingContent,
                      thinking_millsec: Date.now() - timeFirstTokenMillsec
                    }
                    controller.enqueue(thinkingCompleteChunk)
                  }
                }

                // 重建清理后的SDK chunk用于下游处理
                const originalChunk = chunk.originalChunk
                if (originalChunk && originalChunk.choices) {
                  const reconstructedChunk: OpenAI.Chat.Completions.ChatCompletionChunk = {
                    ...originalChunk,
                    choices: originalChunk.choices.map((choice) => ({
                      ...choice,
                      delta: {
                        ...choice.delta,
                        tool_calls: chunk.delta.tool_calls,
                        // 确保reasoning字段被清理
                        reasoning_content: undefined,
                        reasoning: undefined
                      }
                    }))
                  }
                  controller.enqueue(reconstructedChunk)
                }
                break
              }
              case 'finish': {
                // 在finish时，如果有thinking内容且还没输出THINKING_COMPLETE，输出它
                if (thinkingContent && isFirstChunk) {
                  const thinkingCompleteChunk: ThinkingCompleteChunk = {
                    type: ChunkType.THINKING_COMPLETE,
                    text: thinkingContent,
                    thinking_millsec: Date.now() - timeFirstTokenMillsec
                  }
                  controller.enqueue(thinkingCompleteChunk)
                }

                // 传递finish chunk
                if (chunk.chunk) {
                  controller.enqueue(chunk.chunk)
                }
                break
              }
            }
          }
        })
      )

      const adaptedResult: CompletionsOpenAIResult = {
        ...resultFromUpstream,
        stream: mixedStream
      }

      console.log(`[${MIDDLEWARE_NAME}] Set up thinking content processing with mixed stream output.`)
      return adaptedResult
    } else {
      console.log(`[${MIDDLEWARE_NAME}] No stream to process or not a ReadableStream. Returning original result.`)
      return resultFromUpstream
    }
  }
