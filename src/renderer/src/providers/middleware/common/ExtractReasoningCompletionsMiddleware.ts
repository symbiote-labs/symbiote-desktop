import { Chunk, ChunkType } from '@renderer/types/chunk'

import { CompletionsMiddleware } from '../AiProviderMiddlewareTypes'

// Adapted from the core logic of TextExtractorStream in the original extractReasoningMiddleware.ts
class ReasoningExtractor {
  private buffer: string = ''
  private inThinkingBlock: boolean = false
  private openingTag: string
  private closingTag: string
  private separator: string // Currently unused in this simplified adaptation, but kept for potential future use
  private originalOnChunk: (chunk: Chunk) => void
  private accumulatedThinkingTextSinceLastComplete: string = ''

  constructor(openingTag: string, closingTag: string, separator: string, originalOnChunk: (chunk: Chunk) => void) {
    this.openingTag = openingTag
    this.closingTag = closingTag
    this.separator = separator
    this.originalOnChunk = originalOnChunk
  }

  // Processes an incoming text delta, parses for tags, and calls originalOnChunk
  public processText(textDelta: string): void {
    if (!textDelta) return
    this.buffer += textDelta
    this.parseBuffer()
  }

  // Called when the stream of TEXT_DELTA chunks is about to complete,
  // or when a BLOCK_COMPLETE is received.
  public flush(): void {
    this.parseBuffer(true) // Force processing of any remaining buffer content

    if (this.inThinkingBlock) {
      if (this.buffer) {
        this.originalOnChunk({ type: ChunkType.THINKING_DELTA, text: this.buffer })
        this.accumulatedThinkingTextSinceLastComplete += this.buffer
        this.buffer = ''
      }
      if (this.accumulatedThinkingTextSinceLastComplete) {
        // Only emit if there's content
        this.originalOnChunk({ type: ChunkType.THINKING_COMPLETE, text: this.accumulatedThinkingTextSinceLastComplete })
      }
      this.accumulatedThinkingTextSinceLastComplete = ''
      this.inThinkingBlock = false
    } else if (this.buffer) {
      this.originalOnChunk({ type: ChunkType.TEXT_DELTA, text: this.buffer })
      this.buffer = ''
    }
  }

  private parseBuffer(isFlush: boolean = false): void {
    let position = 0
    while (position < this.buffer.length) {
      if (this.inThinkingBlock) {
        const closeTagIndex = this.buffer.indexOf(this.closingTag, position)
        if (closeTagIndex !== -1) {
          const thinkingPart = this.buffer.substring(position, closeTagIndex)
          if (thinkingPart) {
            this.originalOnChunk({ type: ChunkType.THINKING_DELTA, text: thinkingPart })
            this.accumulatedThinkingTextSinceLastComplete += thinkingPart
          }
          if (this.accumulatedThinkingTextSinceLastComplete) {
            // Only emit if there's content
            this.originalOnChunk({
              type: ChunkType.THINKING_COMPLETE,
              text: this.accumulatedThinkingTextSinceLastComplete
            })
          }
          this.accumulatedThinkingTextSinceLastComplete = ''

          position = closeTagIndex + this.closingTag.length
          if (this.buffer.startsWith(this.separator, position)) {
            position += this.separator.length
          }
          this.inThinkingBlock = false
        } else {
          if (isFlush) {
            const thinkingPart = this.buffer.substring(position)
            if (thinkingPart) {
              this.originalOnChunk({ type: ChunkType.THINKING_DELTA, text: thinkingPart })
              this.accumulatedThinkingTextSinceLastComplete += thinkingPart
            }
            position = this.buffer.length
          } else {
            break
          }
        }
      } else {
        const openTagIndex = this.buffer.indexOf(this.openingTag, position)
        if (openTagIndex !== -1) {
          const textPart = this.buffer.substring(position, openTagIndex)
          if (textPart) {
            this.originalOnChunk({ type: ChunkType.TEXT_DELTA, text: textPart })
          }
          position = openTagIndex + this.openingTag.length
          this.inThinkingBlock = true
          this.accumulatedThinkingTextSinceLastComplete = ''
        } else {
          if (isFlush) {
            const textPart = this.buffer.substring(position)
            if (textPart) {
              this.originalOnChunk({ type: ChunkType.TEXT_DELTA, text: textPart })
            }
            position = this.buffer.length
          } else {
            // If not flushing, and no open tag found, the remaining part of the buffer
            // is unparsed. We should not emit it as TEXT_DELTA yet.
            // It will be processed in the next call or during flush.
            const remaining = this.buffer.substring(position)
            this.buffer = remaining
            return // Exit and wait for more data or flush
          }
        }
      }
    }
    this.buffer = this.buffer.substring(position)
  }
}

export function createExtractReasoningCompletionsMiddleware({
  openingTag,
  closingTag,
  separator,
  enableReasoning
}: {
  openingTag: string
  closingTag: string
  separator: string
  enableReasoning: boolean
}): CompletionsMiddleware {
  if (!enableReasoning) {
    return (_) => (next) => next // Passthrough if not enabled
  }

  return (_) => (next) => async (context, params) => {
    const extractor = new ReasoningExtractor(openingTag, closingTag, separator, params.onChunk)

    const internalOnChunk = (chunk: Chunk) => {
      if (chunk.type === ChunkType.TEXT_DELTA && chunk.text) {
        extractor.processText(chunk.text)
        // The extractor now calls params.onChunk directly with parsed chunks.
        // So, we don't pass the original TEXT_DELTA through here.
      } else if (chunk.type === ChunkType.TEXT_COMPLETE) {
        // If the downstream sends a TEXT_COMPLETE, it might contain final text.
        if (chunk.text) {
          extractor.processText(chunk.text) // Process potential final text
        }
        extractor.flush() // Ensure all buffered content is processed.
        // Pass through the original TEXT_COMPLETE signal, as the extractor
        // handles its own THINKING_COMPLETE and TEXT_DELTA.
        if (params.onChunk) params.onChunk(chunk)
      } else if (chunk.type === ChunkType.BLOCK_COMPLETE) {
        extractor.flush() // Crucial: flush before the block is truly complete.
        if (params.onChunk) params.onChunk(chunk) // Pass through the original BLOCK_COMPLETE.
      } else {
        if (params.onChunk) params.onChunk(chunk) // Pass through other chunk types (TOOL_CALL, ERROR etc.).
      }
    }

    await next(context, { ...params, onChunk: internalOnChunk })

    // A final flush might be considered here, but generally, BLOCK_COMPLETE
    // should be the definitive signal to finalize processing. If `next` guarantees
    // a BLOCK_COMPLETE (or an ERROR chunk), this might be redundant or could
    // even cause issues if `internalOnChunk` for BLOCK_COMPLETE already flushed.
    // Let's rely on the flush within internalOnChunk for BLOCK_COMPLETE.
  }
}
