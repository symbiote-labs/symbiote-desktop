import { type Chunk, ChunkType, type ErrorChunk } from '@renderer/types/chunk'

import type { CompletionsOpenAIResult } from '../../AiProvider'
import type { CompletionsMiddleware } from '../middlewareTypes'

const MIDDLEWARE_NAME = 'AbortHandlerMiddleware'

export const AbortHandlerMiddleware: CompletionsMiddleware = () => (next) => async (context, params) => {
  const resultFromUpstream = await next(context, params)

  if (resultFromUpstream.stream && resultFromUpstream.stream instanceof ReadableStream) {
    const originalStream = resultFromUpstream.stream

    // 从 result.controller 获取 abort controller
    const abortController = resultFromUpstream.controller
    const abortSignal = abortController?.signal
    console.log('abortSignal', abortSignal)
    if (!abortSignal) {
      console.log(`[${MIDDLEWARE_NAME}] No abort controller/signal found, returning original stream`)
      return resultFromUpstream
    }

    const error = new DOMException('Request was aborted', 'AbortError')

    // 使用 TransformStream 处理 abort 检测
    const streamWithAbortHandler = (originalStream as ReadableStream<Chunk>).pipeThrough(
      new TransformStream<Chunk, Chunk | ErrorChunk>({
        transform(chunk, controller) {
          // 检查 abort 状态
          if (abortSignal.aborted) {
            console.log(`[${MIDDLEWARE_NAME}] Abort detected, converting to ErrorChunk`)

            // 转换为 ErrorChunk
            // TODO: 也可以手动throw error，更贴合现有的onError处理方式，但是会破坏流转换的统一逻辑，还没想好怎么处理比较好
            const errorChunk: ErrorChunk = {
              type: ChunkType.ERROR,
              error
            }

            controller.enqueue(errorChunk)
            controller.close()
            return
          }

          // 正常传递 chunk
          controller.enqueue(chunk)
        },

        flush(controller) {
          // 在流结束时再次检查 abort 状态
          if (abortSignal!.aborted) {
            console.log(`[${MIDDLEWARE_NAME}] Abort detected at flush, converting to ErrorChunk`)
            // TODO: 也可以手动throw error，更贴合现有的onError处理方式，但是会破坏流转换的统一逻辑，还没想好怎么处理比较好
            const errorChunk: ErrorChunk = {
              type: ChunkType.ERROR,
              error
            }

            controller.enqueue(errorChunk)
          }
        }
      })
    )

    // 添加 abort 事件监听器，用于主动检测 abort
    if (abortSignal) {
      abortSignal.addEventListener(
        'abort',
        () => {
          console.log(`[${MIDDLEWARE_NAME}] Abort event triggered`)
          // TransformStream 会在下次 transform 调用时检测到 aborted 状态
        },
        { once: true }
      )
    }

    const adaptedResult: CompletionsOpenAIResult = {
      ...resultFromUpstream,
      stream: streamWithAbortHandler
    }

    console.log(`[${MIDDLEWARE_NAME}] Set up abort handling with TransformStream`)
    return adaptedResult
  } else {
    console.log(`[${MIDDLEWARE_NAME}] No stream to process or not a ReadableStream. Returning original result.`)
    return resultFromUpstream
  }
}
