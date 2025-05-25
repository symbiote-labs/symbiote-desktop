import { MCPToolResponse, ToolCallResponse } from '@renderer/types'
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

      // 使用TransformStream进行流式处理
      let accumulatedText = ''
      const mcpTools = context.mcpTools

      const standardChunkStream = mixedStream.pipeThrough(
        new TransformStream<Chunk | OpenAI.Chat.Completions.ChatCompletionChunk, Chunk>({
          transform(item, controller) {
            console.log('mixedStream item', item)

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

            if (delta?.content) {
              accumulatedText += delta.content
              controller.enqueue({ type: ChunkType.TEXT_DELTA, text: delta.content })
            }

            if (delta?.tool_calls && delta.tool_calls.length > 0) {
              const toolCallResponses: ToolCallResponse[] = []
              for (const tc of delta.tool_calls) {
                if (!tc.function || !tc.id) continue

                const mcpTool = mcpTools?.find((m) => m.id === tc.function!.name || m.name === tc.function!.name)
                if (!mcpTool) {
                  console.warn(`[${MIDDLEWARE_NAME}] MCPTool not found for function: ${tc.function.name}`)
                  continue
                }

                let parsedArgs: Record<string, unknown> | undefined = undefined
                if (tc.function.arguments) {
                  parsedArgs = JSON.parse(tc.function.arguments)
                }

                // Constructing ToolCallResponse. Status is 'invoking' as a placeholder.
                // This might need semantic review: is it truly 'invoking' at this stage?
                const toolCallResponse: ToolCallResponse = {
                  id: tc.id, // Unique ID for this specific call instance
                  toolCallId: tc.id, // OpenAI's tool_call.id
                  tool: mcpTool,
                  arguments: parsedArgs,
                  status: 'invoking' // Placeholder status
                  // response field would be populated by the actual tool execution result later
                }
                toolCallResponses.push(toolCallResponse)
              }

              if (toolCallResponses.length > 0) {
                controller.enqueue({
                  type: ChunkType.MCP_TOOL_IN_PROGRESS,
                  responses: toolCallResponses as MCPToolResponse[] // Casting because ToolCallResponse is part of MCPToolResponse union
                })
              }
            }

            if (!isEmpty(choice.finish_reason)) {
              if (accumulatedText) {
                const textCompleteChunk: TextCompleteChunk = {
                  type: ChunkType.TEXT_COMPLETE,
                  text: accumulatedText
                }
                controller.enqueue(textCompleteChunk)
              }

              // const llmCompleteChunk: LLMResponseCompleteChunk = {
              //   type: ChunkType.LLM_RESPONSE_COMPLETE,
              //   response: {
              //     usage: finalUsage
              //   }
              // }
              // controller.enqueue(llmCompleteChunk)
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
