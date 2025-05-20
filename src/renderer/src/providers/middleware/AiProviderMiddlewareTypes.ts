import { Assistant, MCPTool, Model } from '@renderer/types'
import { Chunk, ErrorChunk } from '@renderer/types/chunk'
import { Message } from '@renderer/types/newMessage'

import { CompletionsParams, OnFilterMessagesFunction } from '../AiProvider'

/**
 * Defines the structure for the onChunk callback function.
 * This function is called with data chunks during a streaming operation.
 */
export type OnChunkFunction = (chunk: Chunk | ErrorChunk) => void

/**
 * Represents the 'next' function in the middleware chain for completions.
 * It takes the current context and calls the next middleware or the original provider logic.
 */
export type NextCompletionsFunction = (context: AiProviderMiddlewareCompletionsContext) => Promise<any> // The return type might need to be standardized based on what completions resolves to.

/**
 * Defines the structure for the completion context object that is passed through the middleware chain.
 * This context holds all necessary data and callbacks for a completions call.
 */
export interface AiProviderMiddlewareCompletionsContext {
  originalParams: CompletionsParams // The initial params as passed to the provider's completions method
  assistant: Assistant // The assistant (from originalParams.assistant)
  model: Model // Resolved model (derived, not directly from originalParams)
  messages: Message[] // Current state of messages (from originalParams.messages, potentially modified by middlewares)
  mcpTools?: MCPTool[] // Current state of MCP tools (from originalParams.mcpTools, potentially modified)
  onChunk: OnChunkFunction // Current onChunk callback (potentially wrapped)
  onFilterMessages: OnFilterMessagesFunction // Current onFilterMessages callback (potentially wrapped)
  providerId?: string // ID of the provider being wrapped
  // ... any other state or resolved values added by the middleware system or specific middlewares
}

// Represents the actual function that executes a tool and returns its response
// MCPCallToolResponse is from @renderer/types - ensure it's imported if not already
// For now, assuming it's available or will be imported where this type is used.
export type NextToolExecutionFunction = (toolCallData: any) => Promise<any> // Replace 'any' with MCPToolResponse and MCPCallToolResponse

/**
 * Base interface for all middlewares, can include common properties like an ID.
 */
interface BaseMiddleware {
  id?: string // Optional identifier for the middleware
}

/**
 * Defines the interface for an AI Provider Middleware.
 * Middlewares can hook into different stages of the completions lifecycle.
 */
export interface AiProviderMiddleware extends BaseMiddleware {
  /**
   * Transforms the input parameters for a completions call.
   * This hook can directly modify the passed-in context.
   * @param context The current completions context, which can be modified by this hook.
   */
  transformCompletionsInput?: (context: AiProviderMiddlewareCompletionsContext) => Promise<void>

  /**
   * Wraps the core completions logic.
   * Allows executing code before and after the main operation, and controls the call to 'next'.
   * @param context The current completions context.
   * @param next The function to call to proceed to the next middleware or the original provider logic.
   */
  wrapCompletions?: (context: AiProviderMiddlewareCompletionsContext, next: NextCompletionsFunction) => Promise<any> // The return type should align with what NextCompletionsFunction returns.

  /**
   * Wraps the onChunk callback to intercept or transform data chunks from a streaming response.
   * @param onChunk The original onChunk function.
   * @param context The current completions context.
   * @returns A new onChunk function that wraps the original.
   */
  wrapOnChunk?: (onChunk: OnChunkFunction, context: AiProviderMiddlewareCompletionsContext) => OnChunkFunction

  /**
   * Finalizes the SDK-specific request parameters right before they are sent to the AI provider's SDK.
   * @param sdkRequestParams The provider-specific request parameters (e.g., OpenAI.Chat.Completions.ChatCompletionCreateParams).
   * @param context The current completions context.
   * @returns A Promise resolving to the (potentially modified) SDK-specific request parameters.
   */
  finalizeSdkRequestParams?: (sdkRequestParams: any, context: AiProviderMiddlewareCompletionsContext) => Promise<any>

  // Placeholder for wrapToolExecution if we add it later
  // wrapToolExecution?: (
  //   toolCallData: any, // Replace with MCPToolResponse
  //   context: AiProviderMiddlewareCompletionsContext,
  //   next: NextToolExecutionFunction
  // ) => Promise<any>; // Replace with MCPCallToolResponse
}

export type { Chunk as OnChunkArg } from '@renderer/types/chunk'
