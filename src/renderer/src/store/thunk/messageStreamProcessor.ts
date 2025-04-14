// This file acts as an intermediary layer between API service calls and Redux Thunks.
// It handles the processing of raw API responses (especially streams)
// and transforms them into application-specific data structures (like MessageBlocks)
// before passing them to the Thunks.

import { fetchChatCompletion } from '@renderer/services/ApiService' // Import the API call function
import type { Assistant, Message, Model } from '@renderer/types' // Assuming Message type is needed
import { type MessageBlock, MessageBlockStatus } from '@renderer/types/newMessageTypes'
import { createErrorBlock, createMainTextBlock } from '@renderer/utils/messageUtils/create' // CORRECTED Import path

// Define status constants for type safety without 'as'
// const STATUS_SUCCESS: MessageBlockStatus = MessageBlockStatus.SUCCESS // Use enum member - COMMENTED as unused
const STATUS_STREAMING: MessageBlockStatus = MessageBlockStatus.STREAMING // Use enum member
// const STATUS_ERROR: MessageBlockStatus = MessageBlockStatus.ERROR // Use enum member - Commented out as unused for now

interface ProcessChatCompletionOptions {
  // Parameters needed by fetchChatCompletion
  message: Message // The initial assistant message stub
  messages: any[] // Formatted history for API
  assistant: Assistant
  model?: Model // Optional model override?
  topicId: string // Needed for context, maybe not directly for API call

  // Callbacks to pass processed data back to the Thunk
  onResponse: (data: {
    block?: MessageBlock // A new block that was created
    update?: { id: string; changes: Partial<MessageBlock> } // Changes to an existing block
    blockId?: string // ID of the block created/updated (for reference in Thunk)
    isFinal?: boolean // Stream end signal
    finalStatus?: Message['status'] // Final status for the message
    error?: any // Error details if stream ended with error
  }) => void
  onError: (error: any) => void
  // onStart is implicitly handled by the Thunk creating the initial stub
}

export async function processChatCompletionStream(options: ProcessChatCompletionOptions): Promise<void> {
  const { message: assistantMessage, messages, assistant, /* model, topicId, */ onResponse, onError } = options

  let accumulatedContent = '' // Accumulate text content
  let mainTextBlockId: string | null = null // Track the ID of the main text block

  try {
    await fetchChatCompletion({
      message: assistantMessage as any, // TEMP CAST until fetchChatCompletion is refactored
      messages: messages,
      assistant: assistant,
      // model: model, // Pass model if provided
      onResponse: async (streamData) => {
        // --- Process Stream Data (Moved from Thunk) ---
        const { contentChunk, blockType, blockData, isFinal, errorData } = parseStreamData(streamData)

        let newBlock: MessageBlock | null = null
        let updatePayload: { id: string; changes: Partial<MessageBlock> } | null = null
        let blockIdForThunk: string | undefined = undefined
        let finalStatusForThunk: Message['status'] | undefined = undefined

        if (blockType === 'main_text' || contentChunk) {
          accumulatedContent += contentChunk || ''
          if (!mainTextBlockId) {
            // Create main text block on first chunk
            newBlock = createMainTextBlock(assistantMessage.id, accumulatedContent, {
              status: STATUS_STREAMING // Use constant
            })
            mainTextBlockId = newBlock!.id
            blockIdForThunk = mainTextBlockId
            // Don't add to finalAssistantBlocks here, Thunk will handle state
            // Immediately notify Thunk about the new block and its ID reference
            onResponse({ block: newBlock!, blockId: blockIdForThunk })
          } else {
            // Prepare update for existing main text block
            updatePayload = {
              id: mainTextBlockId,
              changes: { content: accumulatedContent, status: STATUS_STREAMING } // Use constant
            }
            blockIdForThunk = mainTextBlockId
            onResponse({ update: updatePayload, blockId: blockIdForThunk })
          }
        } else if (blockType && blockData) {
          // TODO: Handle other block types (Tool, Image, Code, etc.)
          // Create specific blocks based on blockType and blockData
          // Example:
          // if (blockType === 'tool_call') { newBlock = createToolBlock(...) }
          // Remember to call onResponse({ block: newBlock, blockId: newBlock.id })
        }

        // Handle final status and errors from stream
        if (isFinal) {
          finalStatusForThunk = errorData ? 'error' : 'success' // Use string literals for Message status
          if (errorData) {
            const errorBlock = createErrorBlock(assistantMessage.id, errorData)
            // Notify Thunk about the error block
            onResponse({
              block: errorBlock!,
              blockId: errorBlock.id,
              isFinal: true,
              finalStatus: finalStatusForThunk,
              error: errorData
            })
          } else if (mainTextBlockId) {
            // Mark the last text block as success if stream ended successfully
            updatePayload = {
              id: mainTextBlockId,
              changes: {
                status: finalStatusForThunk === 'success' ? MessageBlockStatus.SUCCESS : MessageBlockStatus.ERROR
              }
            }
            blockIdForThunk = mainTextBlockId
            onResponse({
              update: updatePayload,
              blockId: blockIdForThunk,
              isFinal: true,
              finalStatus: finalStatusForThunk
            })
          } else {
            // Stream ended without error, but no main text block (or other block) was processed?
            onResponse({ isFinal: true, finalStatus: finalStatusForThunk })
          }
        }
        // --- End Process Stream Data ---
      }, // End internal onResponse
      onError: onError // Pass through onError
    })
  } catch (error) {
    // Catch errors during the fetchChatCompletion setup or if it throws directly
    console.error('Error setting up or during chat completion call:', error)
    onError(error) // Forward error to the Thunk
  }
}

// Stream data parser (Moved from Thunk)
function parseStreamData(streamData: any): {
  status?: Message['status']
  contentChunk?: string
  blockType?: MessageBlock['type']
  blockData?: any
  isFinal?: boolean
  errorData?: any
} {
  // TODO: Implement actual parsing logic based on API stream format
  console.log('Parsing stream data (TODO in processor):', streamData)
  // Example placeholder logic:
  if (typeof streamData === 'string') {
    return { contentChunk: streamData }
  }
  if (streamData.done) {
    return { isFinal: true, status: streamData.error ? 'error' : 'success', errorData: streamData.error }
  }
  if (streamData.type && streamData.data) {
    return { blockType: streamData.type, blockData: streamData.data }
  }
  return {}
}
