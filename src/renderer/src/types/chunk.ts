import { KnowledgeReference, MCPToolResponse, WebSearchResponse } from '@types'

import { Response, ResponseError } from './newMessage'

// Define Enum for Chunk Types
export enum ChunkType {
  TEXT_DELTA = 'text.delta',
  TEXT_COMPLETE = 'text.complete',
  AUDIO_DELTA = 'audio.delta',
  AUDIO_COMPLETE = 'audio.complete',
  IMAGE_DELTA = 'image.delta',
  IMAGE_COMPLETE = 'image.complete',
  THINKING_DELTA = 'thinking.delta',
  THINKING_COMPLETE = 'thinking.complete',
  WEB_SEARCH_IN_PROGRESS = 'web_search_in_progress',
  WEB_SEARCH_COMPLETE = 'web_search_complete',
  KNOWLEDGE_SEARCH_IN_PROGRESS = 'knowledge_search_in_progress',
  KNOWLEDGE_SEARCH_COMPLETE = 'knowledge_search_complete',
  MCP_TOOL_RESPONSE = 'mcp_tool_response',
  ERROR = 'error',
  BLOCK_CREATED = 'block_created',
  BLOCK_IN_PROGRESS = 'block_in_progress',
  BLOCK_COMPLETE = 'block_complete'
}

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
  type: ChunkType.TEXT_DELTA
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
  type: ChunkType.TEXT_COMPLETE
}

export interface AudioDeltaChunk {
  /**
   * A chunk of Base64 encoded audio data
   */
  audio: string

  /**
   * The type of the chunk
   */
  type: ChunkType.AUDIO_DELTA
}

export interface AudioCompleteChunk {
  /**
   * The type of the chunk
   */
  type: ChunkType.AUDIO_COMPLETE
}

export interface ImageDeltaChunk {
  /**
   * A chunk of Base64 encoded image data
   */
  image: string

  /**
   * The type of the chunk
   */
  type: ChunkType.IMAGE_DELTA
}

export interface ImageCompleteChunk {
  /**
   * The type of the chunk
   */
  type: ChunkType.IMAGE_COMPLETE

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
  type: ChunkType.THINKING_DELTA
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
  type: ChunkType.THINKING_COMPLETE
}

export interface WebSearchInProgressChunk {
  /**
   * The type of the chunk
   */
  type: ChunkType.WEB_SEARCH_IN_PROGRESS
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
  type: ChunkType.WEB_SEARCH_COMPLETE
}

export interface KnowledgeSearchInProgressChunk {
  /**
   * The type of the chunk
   */
  type: ChunkType.KNOWLEDGE_SEARCH_IN_PROGRESS
}

export interface KnowledgeSearchCompleteChunk {
  /**
   * The knowledge search response of the chunk
   */
  knowledge: KnowledgeReference[]

  /**
   * The type of the chunk
   */
  type: ChunkType.KNOWLEDGE_SEARCH_COMPLETE
}

export interface MCPToolResponseChunk {
  /**
   * The tool response of the chunk
   */
  responses: MCPToolResponse[]

  /**
   * The type of the chunk
   */
  type: ChunkType.MCP_TOOL_RESPONSE
}

export interface ErrorChunk {
  error: ResponseError

  type: ChunkType.ERROR
}

export interface BlockCreatedChunk {
  /**
   * The response
   */
  response?: Response

  /**
   * The type of the chunk
   */
  type: ChunkType.BLOCK_CREATED
}

export interface BlockInProgressChunk {
  /**
   * The type of the chunk
   */
  type: ChunkType.BLOCK_IN_PROGRESS

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
  type: ChunkType.BLOCK_COMPLETE

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
