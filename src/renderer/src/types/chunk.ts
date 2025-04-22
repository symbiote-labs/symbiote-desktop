import { KnowledgeReference, MCPToolResponse, WebSearchResponse } from '@types'

import { Response, ResponseError } from './newMessage'

export interface TextDeltaChunk {
  /**
   * The text content of the chunk
   */
  text: string

  /**
   * The ID of the chunk
   */
  chunk_id?: number

  /**
   * The type of the chunk
   */
  type: 'text.delta'
}

export interface TextCompleteChunk {
  /**
   * The text content of the chunk
   */
  text: string

  /**
   * The ID of the chunk
   */
  chunk_id?: number

  /**
   * The type of the chunk
   */
  type: 'text.complete'
}

export interface AudioDeltaChunk {
  /**
   * A chunk of Base64 encoded audio data
   */
  audio: string

  /**
   * The type of the chunk
   */
  type: 'audio.delta'
}

export interface AudioCompleteChunk {
  /**
   * The type of the chunk
   */
  type: 'audio.complete'
}

export interface ImageDeltaChunk {
  /**
   * A chunk of Base64 encoded image data
   */
  image: string

  /**
   * The type of the chunk
   */
  type: 'image.delta'
}

export interface ImageCompleteChunk {
  /**
   * The type of the chunk
   */
  type: 'image.complete'

  /**
   * The image content of the chunk
   */
  image: { type: 'base64'; images: string[] }
}

export interface ThinkingDeltaChunk {
  /**
   * The text content of the chunk
   */
  text: string

  /**
   * The ID of the chunk
   */
  chunk_id?: number

  /**
   * The type of the chunk
   */
  type: 'thinking.delta'
}

export interface ThinkingCompleteChunk {
  /**
   * The text content of the chunk
   */
  text: string

  /**
   * The ID of the chunk
   */
  chunk_id?: number

  /**
   * The type of the chunk
   */
  type: 'thinking.complete'
}

export interface WebSearchInProgressChunk {
  /**
   * The type of the chunk
   */
  type: 'web_search_in_progress'
}

export interface WebSearchCompleteChunk {
  /**
   * The web search response of the chunk
   */
  web_search: WebSearchResponse

  /**
   * The ID of the chunk
   */
  chunk_id?: number

  /**
   * The type of the chunk
   */
  type: 'web_search_complete'
}

export interface KnowledgeSearchInProgressChunk {
  /**
   * The type of the chunk
   */
  type: 'knowledge_search_in_progress'
}

export interface KnowledgeSearchCompleteChunk {
  /**
   * The knowledge search response of the chunk
   */
  knowledge: KnowledgeReference[]

  /**
   * The type of the chunk
   */
  type: 'knowledge_search_complete'
}

export interface MCPToolResponseChunk {
  /**
   * The tool response of the chunk
   */
  responses: MCPToolResponse[]

  /**
   * The type of the chunk
   */
  type: 'mcp_tool_response'
}

export interface ErrorChunk {
  error: ResponseError

  type: 'error'
}

export interface BlockCreatedChunk {
  /**
   * The response
   */
  response?: Response

  /**
   * The type of the chunk
   */
  type: 'block_created'
}

export interface BlockInProgressChunk {
  /**
   * The type of the chunk
   */
  type: 'block_in_progress'

  /**
   * The response
   */
  response?: Response
}

export interface BlockCompleteChunk {
  /**
   * The full response
   */
  response?: Response

  /**
   * The type of the chunk
   */
  type: 'block_complete'

  /**
   * The error
   */
  error?: ResponseError
}

export type Chunk =
  | BlockCreatedChunk
  | BlockInProgressChunk
  | BlockCompleteChunk
  | TextDeltaChunk
  | TextCompleteChunk
  | AudioDeltaChunk
  | AudioCompleteChunk
  | ImageDeltaChunk
  | ImageCompleteChunk
  | ThinkingDeltaChunk
  | ThinkingCompleteChunk
  | WebSearchInProgressChunk
  | WebSearchCompleteChunk
  | KnowledgeSearchInProgressChunk
  | KnowledgeSearchCompleteChunk
  | MCPToolResponseChunk
  | ErrorChunk
