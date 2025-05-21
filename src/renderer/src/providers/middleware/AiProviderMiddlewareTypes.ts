import { Assistant, MCPTool, Model } from '@renderer/types'
import { Chunk, ErrorChunk } from '@renderer/types/chunk'
import { Message } from '@renderer/types/newMessage'

import { CompletionsParams, OnFilterMessagesFunction } from '../AiProvider'
import type BaseProvider from '../AiProvider/BaseProvider'

/**
 * Symbol to uniquely identify middleware context objects.
 */
export const MIDDLEWARE_CONTEXT_SYMBOL = Symbol.for('AiProviderMiddlewareContext')

/**
 * Defines the structure for the onChunk callback function.
 * This function is called with data chunks during a streaming operation.
 */
export type OnChunkFunction = (chunk: Chunk | ErrorChunk) => void

/**
 * Generic NextFunction type for around*Execution hooks.
 * The context type might be more specific depending on the method.
 */
export type NextExecutionFunction = (ctx?: AiProviderMiddlewareBaseContext) => Promise<any>

/**
 * Defines the base structure for context objects created at the beginning of a wrapped method call.
 */
export interface AiProviderMiddlewareBaseContext {
  [MIDDLEWARE_CONTEXT_SYMBOL]: true // Symbol marker
  methodName: string // The name of the provider method being called
  originalArgs: any[] // The original arguments array passed to the method
  // params?: any; // Deprecating direct params access here, use getOriginalArgs from API or typed context
  providerId?: string // ID of the provider being wrapped
  _providerInstance?: BaseProvider // Reference to the original provider instance.
}

/**
 * Defines the structure for the completion context object.
 */
export interface AiProviderMiddlewareCompletionsContext extends AiProviderMiddlewareBaseContext {
  methodName: 'completions' // Override for specificity
  // originalParams is now accessed via getOriginalArgs and then cast if needed, or via typed context properties
  // Fields derived from originalParams for convenience within completions middlewares
  // These will be populated by a context creation function.
  assistant?: Assistant
  model?: Model
  messages?: Message[]
  mcpTools?: MCPTool[]
  onChunk?: OnChunkFunction
  onFilterMessages?: OnFilterMessagesFunction
}

/**
 * API provided to each middleware, allowing access to call-specific data.
 */
export interface MiddlewareAPI<
  Ctx extends AiProviderMiddlewareBaseContext = AiProviderMiddlewareBaseContext,
  Args extends any[] = any[]
> {
  getContext: () => Ctx
  getOriginalArgs: () => Args
  getProviderId: () => string | undefined
  getProviderInstance: () => BaseProvider
}

/**
 * Generic signature for a middleware applicable to any provider method.
 * Follows the Redux middleware pattern: (api) => (next) => (context, args) => result
 */
export type ProviderMethodMiddleware = (
  api: MiddlewareAPI
) => (next: (context: AiProviderMiddlewareBaseContext, args: any[]) => Promise<any>) => (args: any[]) => Promise<any>

/**
 * Specific middleware type for the 'completions' method.
 * The third layer and its 'next' function now directly accept 'CompletionsParams'.
 */
export type CompletionsMiddleware = (
  api: MiddlewareAPI<AiProviderMiddlewareCompletionsContext, [CompletionsParams]>
) => (
  next: (context: AiProviderMiddlewareCompletionsContext, params: CompletionsParams) => Promise<void>
) => (params: CompletionsParams) => Promise<void>

// BaseMiddleware can still be useful for common middleware properties like id/name
export interface BaseMiddlewareConfig {
  id?: string
  name?: string
}

/**
 * Represents the structure for configuring middlewares for a provider.
 * It maps method names to an array of middlewares for that method.
 */
export interface AiProviderMiddlewareConfig extends BaseMiddlewareConfig {
  // We will have specific middleware arrays per method
  completions?: CompletionsMiddleware[]
  // Example: translate?: TranslateMiddleware[]; // If we had a translate method
  // Generic catch-all for other methods, if needed, can be added later.
}

// Types related to finalize hooks (currently out of scope for this refactoring step)
// export type FinalizeSdkParamsNextFunction = (sdkParams: any, ctx: AiProviderMiddlewareBaseContext) => Promise<any>

// Types for other hooks if we were to map them (currently out of scope)
// export type NextExecutionFunction = (ctx?: AiProviderMiddlewareBaseContext) => Promise<any>
// export type NextToolExecutionFunction = (toolCallData: any) => Promise<any>

export type { Chunk as OnChunkArg } from '@renderer/types/chunk'
export type { OnFilterMessagesFunction } // Keep re-export if used elsewhere directly
