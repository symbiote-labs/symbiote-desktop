import db from '@renderer/databases'
import { fetchChatCompletion } from '@renderer/services/ApiService'
import type { Assistant, FileType, Topic } from '@renderer/types'
import { FileTypes } from '@renderer/types' // Import FileTypes enum
import type { Message as NewMessage, MessageBlock } from '@renderer/types/newMessageTypes'
import { MessageBlockStatus } from '@renderer/types/newMessageTypes' // Regular import for enum
import {
  createAssistantMessage, // For creating the initial assistant message stub
  createErrorBlock,
  createFileBlock,
  createImageBlock,
  createMainTextBlock,
  createMessage // Assuming we might need this later for API response handling
} from '@renderer/utils/messageUtils/create'
import { getTopicQueue, waitForTopicQueue } from '@renderer/utils/queue'
import { throttle } from 'lodash'

import type { AppDispatch, RootState } from '../index' // Assuming store index exports these types
import { messageBlocksActions } from '../messageBlock'
import { newMessagesActions } from '../newMessage'

// Define status constants for type safety without 'as'
const STATUS_SUCCESS: MessageBlockStatus = MessageBlockStatus.SUCCESS // Use enum member
const STATUS_STREAMING: MessageBlockStatus = MessageBlockStatus.STREAMING // Use enum member
// const STATUS_ERROR: MessageBlockStatus = MessageBlockStatus.ERROR // Use enum member - Commented out as unused for now

// Helper function to save message reference and its blocks to DB
// (This replaces the old syncMessagesWithDB for single message updates)
const saveMessageAndBlocksToDB = async (message: NewMessage, blocks: MessageBlock[]) => {
  try {
    // 1. Save all blocks for this message
    if (blocks.length > 0) {
      await db.message_blocks.bulkPut(blocks)
    }
    // 2. Get the topic and update its messages array
    const topic = await db.topics.get(message.topicId)
    if (topic) {
      const messageIndex = topic.messages.findIndex((m) => m.id === message.id)
      const updatedMessages = [...topic.messages] // Create a mutable copy

      if (messageIndex !== -1) {
        // Update existing message reference
        updatedMessages[messageIndex] = message
      } else {
        // Add new message reference
        updatedMessages.push(message)
      }
      await db.topics.update(message.topicId, { messages: updatedMessages })
    } else {
      console.error(`[saveMessageAndBlocksToDB] Topic ${message.topicId} not found.`)
      // Handle topic not found case? Maybe log error?
    }
  } catch (error) {
    console.error(`[saveMessageAndBlocksToDB] Failed to save message ${message.id}:`, error)
    // Decide if this error should propagate or be handled locally
  }
}

// Helper function to update a message and its blocks in DB during streaming/updates
const updateExistingMessageAndBlocksInDB = async (
  updatedMessage: Partial<NewMessage> & Pick<NewMessage, 'id' | 'topicId'>,
  updatedBlocks: MessageBlock[] // Blocks to upsert
) => {
  try {
    // 1. Upsert updated blocks
    if (updatedBlocks.length > 0) {
      await db.message_blocks.bulkPut(updatedBlocks)
    }
    // 2. Get the topic and update the specific message reference
    const topic = await db.topics.get(updatedMessage.topicId)
    if (topic) {
      const messageIndex = topic.messages.findIndex((m) => m.id === updatedMessage.id)
      if (messageIndex !== -1) {
        const newMessages = [...topic.messages]
        // Merge updates into the existing message reference
        Object.assign(newMessages[messageIndex], updatedMessage)
        await db.topics.update(updatedMessage.topicId, { messages: newMessages })
      } else {
        console.error(`[updateExistingMsg] Message ${updatedMessage.id} not found in topic ${updatedMessage.topicId}`)
      }
    } else {
      console.error(`[updateExistingMsg] Topic ${updatedMessage.topicId} not found.`)
    }
  } catch (error) {
    console.error(`[updateExistingMsg] Failed to update message ${updatedMessage.id}:`, error)
  }
}

// Throttled handler for streaming updates
const handleStreamUpdate = throttle(
  (
    dispatch: AppDispatch,
    messageId: string,
    topicId: string,
    blockUpdates: MessageBlock[], // Blocks being added/updated
    messageUpdates: Partial<NewMessage> // Updates to the message reference (e.g., status)
  ) => {
    // Dispatch actions to update slices immediately (UI reactivity)
    if (blockUpdates.length > 0) {
      dispatch(messageBlocksActions.upsertManyBlocks(blockUpdates))
    }
    dispatch(newMessagesActions.updateMessage({ topicId, messageId, updates: messageUpdates }))

    // Persist changes to DB (throttled)
    // We pass the full updated message parts and blocks to ensure consistency
    updateExistingMessageAndBlocksInDB({ ...messageUpdates, id: messageId, topicId }, blockUpdates)
  },
  200, // Throttle DB updates to every 200ms during streaming
  { leading: true, trailing: true } // Ensure first and last updates are sent
)

// --- REFACTORED sendMessage Thunk ---
export const sendMessage =
  (
    userInput: {
      content: string
      files?: FileType[] // User attached files
    },
    assistant: Assistant,
    topic: Topic
    // options can be added later if needed (e.g., for specific model mentions)
  ) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    let userMessage: NewMessage | null = null
    const userMessageBlocks: MessageBlock[] = []
    let assistantMessage: NewMessage | null = null
    const topicId = topic.id

    try {
      // 1. Create User Message and Blocks
      userMessage = createMessage('user', topicId, assistant.id, 'text', {
        // We create message first, then blocks associated with its ID
      })

      // a. Main Text Block (if content exists)
      if (userInput.content?.trim()) {
        const textBlock = createMainTextBlock(userMessage.id, userInput.content, {
          status: STATUS_SUCCESS // Use constant
        })
        userMessageBlocks.push(textBlock)
        userMessage.blocks.push(textBlock.id)
      }

      // b. File/Image Blocks (from user input files)
      if (userInput.files?.length) {
        userInput.files.forEach((file) => {
          if (file.type === FileTypes.IMAGE) {
            const imgBlock = createImageBlock(userMessage!.id, { file: file, status: STATUS_SUCCESS }) // Use constant
            userMessageBlocks.push(imgBlock)
            userMessage!.blocks.push(imgBlock.id)
          } else {
            const fileBlock = createFileBlock(userMessage!.id, file, { status: STATUS_SUCCESS }) // Use constant
            userMessageBlocks.push(fileBlock)
            userMessage!.blocks.push(fileBlock.id)
          }
        })
      }

      // c. Check if any blocks were created
      if (userMessage.blocks.length === 0) {
        console.warn('sendMessage: No content or files provided for user message.')
        // Optionally dispatch an error or return early
        return
      }

      // 2. Update State and DB for User Message
      dispatch(newMessagesActions.addMessage({ topicId, message: userMessage }))
      if (userMessageBlocks.length > 0) {
        dispatch(messageBlocksActions.upsertManyBlocks(userMessageBlocks))
      }
      await saveMessageAndBlocksToDB(userMessage, userMessageBlocks) // Save user message immediately

      // 3. Create Initial Assistant Message Stub
      assistantMessage = createAssistantMessage(assistant.id, topic, {
        askId: userMessage.id // Link to user message
        // status: 'sending' // REMOVED: Status should be set via action after creation or is handled internally
        // model: assistant.model // Set model being used
      })

      // 4. Update State and DB for Assistant Message Stub
      dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }))
      // Save assistant message stub (no blocks yet)
      await saveMessageAndBlocksToDB(assistantMessage, []) // Save assistant stub

      // 5. Prepare for API Call
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }))
      const queue = getTopicQueue(topicId)

      // --- API Call Logic ---
      queue.add(async () => {
        // const finalAssistantMessageState: Partial<NewMessage> = {} // REMOVED: Unused variable
        const finalAssistantBlocks: MessageBlock[] = []
        let accumulatedContent = '' // Accumulate text content
        let mainTextBlockId: string | null = null // Track the ID of the main text block

        try {
          // const messagesHistory = getState().newMessages.messagesByTopic[topicId] || [] // REMOVED/COMMENTED: Unused variable (until TODO is implemented)
          // TODO: Prepare messages in the format required by fetchChatCompletion
          // This will involve fetching blocks for previous messages and formatting them.
          // This part needs careful implementation based on API requirements.
          const formattedHistory: any[] = [] // Placeholder

          await fetchChatCompletion({
            // Use the initial assistant message stub as the base
            message: { ...assistantMessage! },
            messages: formattedHistory, // Pass the prepared history
            assistant: assistant, // Pass the assistant config
            onResponse: async (streamData) => {
              // --- Process Stream Data ---
              // This logic needs to be adapted based on the actual structure of streamData
              // It needs to handle different block types coming from the stream

              const { contentChunk, blockType, blockData, isFinal, errorData } = parseStreamData(streamData) // Hypothetical parser, removed unused 'status'

              let blockToUpdate: MessageBlock | null = null
              const messageUpdates: Partial<NewMessage> = { status: 'processing' } // Default to processing

              if (blockType === 'main_text' || contentChunk) {
                accumulatedContent += contentChunk || ''
                if (!mainTextBlockId) {
                  // Create main text block on first chunk
                  const newTextBlock = createMainTextBlock(assistantMessage!.id, accumulatedContent, {
                    status: STATUS_STREAMING // Use constant
                  })
                  mainTextBlockId = newTextBlock.id
                  blockToUpdate = newTextBlock
                  finalAssistantBlocks.push(newTextBlock) // Add to final list
                  // Add block ID to message reference immediately
                  dispatch(
                    newMessagesActions.upsertBlockReference({
                      messageId: assistantMessage!.id,
                      blockId: mainTextBlockId
                    })
                  )
                } else {
                  // Update existing main text block
                  blockToUpdate = {
                    id: mainTextBlockId,
                    changes: { content: accumulatedContent, status: STATUS_STREAMING } // Use constant
                  } as any // Use 'any' temporarily for update shape
                }
              } else if (blockType && blockData) {
                // Handle other block types (Tool, Image, Code, etc.)
                // Create or update specific blocks based on blockType and blockData
                // Example:
                // if (blockType === 'tool_call') { ... createToolBlock ... }
                // Remember to add new block IDs to the message reference via upsertBlockReference
              }

              // Handle final status and errors from stream
              if (isFinal) {
                messageUpdates.status = errorData ? 'error' : 'success' // Use string literals for Message status
                if (errorData) {
                  const errorBlock = createErrorBlock(assistantMessage!.id, errorData)
                  finalAssistantBlocks.push(errorBlock)
                  dispatch(
                    newMessagesActions.upsertBlockReference({
                      messageId: assistantMessage!.id,
                      blockId: errorBlock.id
                      // status: 'error' // REMOVED: Block status updated via messageBlocksActions, message status via updateMessage
                    })
                  )
                }
                // Mark the last text block as success if needed
                if (mainTextBlockId) {
                  blockToUpdate = {
                    id: mainTextBlockId,
                    changes: { status: messageUpdates.status } // Use status from messageUpdates
                  } as any
                }
              }

              // --- Dispatch Updates (Throttled) ---
              if (blockToUpdate) {
                // Handle block updates correctly (upsertOne/updateOne?)
                // Using upsertMany for simplicity here, might need refinement
                handleStreamUpdate(
                  dispatch,
                  assistantMessage!.id,
                  topicId,
                  [blockToUpdate], // Pass block to update/add
                  messageUpdates
                )
              } else {
                // If only message status changes
                handleStreamUpdate(dispatch, assistantMessage!.id, topicId, [], messageUpdates)
              }
            } // End onResponse
          }) // End fetchChatCompletion

          // --- Final Update After Stream Ends (if not handled by last onResponse) ---
          // Ensure final state is consistent in Redux and DB
          // This might be redundant if the last handleStreamUpdate covers everything
          const finalState = getState().newMessages.messagesByTopic[topicId]?.find((m) => m.id === assistantMessage!.id)
          const finalBlocksFromState = getState().messageBlocks.entities // Get all blocks from state entity map
          const finalAssistantBlocksActual =
            finalState?.blocks.map((id) => finalBlocksFromState[id]).filter((b): b is MessageBlock => !!b) || []

          await updateExistingMessageAndBlocksInDB(
            { id: assistantMessage!.id, topicId, status: finalState?.status || 'success' }, // Use final status from state
            finalAssistantBlocksActual
          )
        } catch (error: any) {
          console.error('Error during chat completion for message:', assistantMessage?.id, error)
          // --- Handle API Call Error ---
          const errorBlock = createErrorBlock(assistantMessage!.id, {
            message: error.message || 'API request failed',
            stack: error.stack
          })
          // Update state
          dispatch(messageBlocksActions.upsertOneBlock(errorBlock))
          dispatch(
            newMessagesActions.updateMessage({
              topicId,
              messageId: assistantMessage!.id,
              updates: { status: 'error', blocks: [...(assistantMessage?.blocks || []), errorBlock.id] }
            })
          )
          // Update DB
          await updateExistingMessageAndBlocksInDB(
            { id: assistantMessage!.id, topicId, status: 'error' },
            [errorBlock] // Save the error block
          )
        } finally {
          // Ensure queue processing continues for this topic if needed
        }
      }) // End queue.add
    } catch (error: any) {
      console.error('Error in sendMessage outer try block:', error)
      // Handle potential errors during user message creation/saving?
      // Dispatch a general error?
    } finally {
      // Wait for the current message's API call to finish before setting loading to false
      await waitForTopicQueue(topicId)
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }))
    }
  }

// Placeholder for stream data parser
function parseStreamData(streamData: any): {
  status?: NewMessage['status'] // RE-ADD status to return type
  contentChunk?: string
  blockType?: MessageBlock['type'] // Use MessageBlock['type']
  blockData?: any
  isFinal?: boolean
  errorData?: any
} {
  // TODO: Implement actual parsing logic based on API stream format
  console.log('Parsing stream data (TODO):', streamData)
  // Example placeholder logic:
  if (typeof streamData === 'string') {
    return { contentChunk: streamData }
  }
  if (streamData.done) {
    return { isFinal: true, status: streamData.error ? 'error' : 'success', errorData: streamData.error } // Use string literals for Message status
  }
  if (streamData.type && streamData.data) {
    return { blockType: streamData.type, blockData: streamData.data }
  }
  return {} // Default empty parse
}

// TODO: Implement resendMessage Thunk
