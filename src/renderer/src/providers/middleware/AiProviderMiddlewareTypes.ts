import { Assistant, MCPTool, Model } from '@renderer/types' // 从 @renderer/types 导入
import { Chunk } from '@renderer/types/chunk' // 从 @renderer/types/chunk 导入 Chunk 联合类型
import { Message } from '@renderer/types/newMessage'

import { CompletionsParams } from '../AiProvider' // 确保 '.' 正确指向 index.ts 或 CompletionsParams 定义的地方

// --- Chunk: 直接使用从 chunk.ts 导入的 Chunk 联合类型 ---

// --- AiProviderMiddlewareCompletionsContext ---
export interface AiProviderMiddlewareCompletionsContext {
  params: CompletionsParams // 原始或已转换的参数
  assistant: Assistant
  model: Model // 在包装器中确保这个字段总是被填充
  messages: Message[]
  mcpTools?: MCPTool[]
  onChunk: (chunk: Chunk) => void // 原始或包装过的 onChunk
  onFilterMessages: (messages: Message[]) => void // 原始或包装过的 onFilterMessages
  // 可选: 如果中间件需要访问特定Provider的原始SDK实例或特殊配置
  // providerInstance?: import('./BaseProvider').BaseProvider;
}

// --- NextCompletionsFunction ---
export type NextCompletionsFunction = (context: AiProviderMiddlewareCompletionsContext) => Promise<void>

// --- AiProviderMiddleware Interface ---
export interface AiProviderMiddleware {
  /**
   * 可选的唯一标识符，用于日志、调试或有条件地应用中间件。
   */
  id?: string

  /**
   * 可选方法。
   * 在核心 'completions' 操作之前转换参数或上下文。
   * @param context 当前的上下文，包含原始或先前中间件转换过的参数。
   * @returns 一个 Promise，解析为更新后的上下文。
   */
  transformCompletionsParams?: (
    context: AiProviderMiddlewareCompletionsContext
  ) => Promise<AiProviderMiddlewareCompletionsContext>

  /**
   * 可选方法。
   * 包装核心的 'completions' 操作。
   * 中间件可以在调用 'next' 函数前后执行逻辑，或者完全自定义行为。
   * @param context 当前的上下文。
   * @param next 一个函数，调用它将执行链中的下一个中间件或原始的 'completions' 实现。
   * @returns 一个 Promise，在 'completions' 操作完成时解析。
   */
  wrapCompletions?: (context: AiProviderMiddlewareCompletionsContext, next: NextCompletionsFunction) => Promise<void>

  /**
   * 可选方法。
   * 允许中间件包装原始的 onChunk 回调函数。
   * 这对于在数据块传递给UI或下一层之前修改、记录或过滤数据块非常有用。
   * @param originalOnChunk 上一层（或原始的）onChunk 函数。
   * @param context 提供调用 wrapCompletions 时的上下文，以便 onChunk 包装器可以访问。
   * @returns 一个新的 onChunk 函数，它将替换原始的 onChunk。
   */
  wrapOnChunk?: (
    originalOnChunk: (chunk: Chunk) => void,
    context: Readonly<AiProviderMiddlewareCompletionsContext> // 提供只读上下文，避免在 wrapOnChunk 中意外修改
  ) => (chunk: Chunk) => void
}

export type { Chunk as OnChunkArg } from '@renderer/types/chunk'
