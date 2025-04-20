import db from '@renderer/databases'
import { fetchChatCompletion } from '@renderer/services/ApiService'
import { createStreamProcessor, type StreamProcessorCallbacks } from '@renderer/services/StreamProcessingService'
import store from '@renderer/store'
import type { Assistant, MCPToolResponse, Topic } from '@renderer/types'
import type { MainTextMessageBlock, Message, MessageBlock, ToolMessageBlock } from '@renderer/types/newMessage'
import { AssistantMessageStatus, MessageBlockStatus, MessageBlockType } from '@renderer/types/newMessage'
import { isAbortError } from '@renderer/utils/error'
import {
  createAssistantMessage,
  createErrorBlock,
  createImageBlock,
  createMainTextBlock,
  createToolBlock
} from '@renderer/utils/messageUtils/create'
import { getTopicQueue } from '@renderer/utils/queue'
import { throttle } from 'lodash'

import type { AppDispatch, RootState } from '../index'
import { removeManyBlocks, updateOneBlock, upsertManyBlocks, upsertOneBlock } from '../messageBlock'
import { newMessagesActions, removeMessage, removeMessages, removeMessagesByAskId } from '../newMessage'

const saveMessageAndBlocksToDB = async (message: Message, blocks: MessageBlock[]) => {
  try {
    if (blocks.length > 0) {
      await db.message_blocks.bulkPut(blocks)
    }
    const topic = await db.topics.get(message.topicId)
    if (topic) {
      const messageIndex = topic.messages.findIndex((m) => m.id === message.id)
      const updatedMessages = [...topic.messages]

      if (messageIndex !== -1) {
        updatedMessages[messageIndex] = message
      } else {
        updatedMessages.push(message)
      }
      await db.topics.update(message.topicId, { messages: updatedMessages })
    } else {
      console.error(`[saveMessageAndBlocksToDB] Topic ${message.topicId} not found.`)
    }
  } catch (error) {
    console.error(`[saveMessageAndBlocksToDB] Failed to save message ${message.id}:`, error)
  }
}

const updateExistingMessageAndBlocksInDB = async (
  updatedMessage: Partial<Message> & Pick<Message, 'id' | 'topicId'>,
  updatedBlocks: MessageBlock[]
) => {
  try {
    // Always update blocks if provided
    if (updatedBlocks.length > 0) {
      await db.message_blocks.bulkPut(updatedBlocks)
    }

    // Check if there are message properties to update beyond id and topicId
    const messageKeysToUpdate = Object.keys(updatedMessage).filter((key) => key !== 'id' && key !== 'topicId')

    // Only proceed with topic update if there are actual message changes
    if (messageKeysToUpdate.length > 0) {
      const topic = await db.topics.get(updatedMessage.topicId)
      if (topic) {
        const messageIndex = topic.messages.findIndex((m) => m.id === updatedMessage.id)
        if (messageIndex !== -1) {
          const newMessages = [...topic.messages]
          // Apply the updates passed in updatedMessage
          Object.assign(newMessages[messageIndex], updatedMessage)
          await db.topics.update(updatedMessage.topicId, { messages: newMessages })
        } else {
          console.error(`[updateExistingMsg] Message ${updatedMessage.id} not found in topic ${updatedMessage.topicId}`)
        }
      } else {
        console.error(`[updateExistingMsg] Topic ${updatedMessage.topicId} not found.`)
      }
    }
    // If messageKeysToUpdate.length === 0, we skip topic fetch/update entirely
  } catch (error) {
    console.error(`[updateExistingMsg] Failed to update message ${updatedMessage.id}:`, error)
  }
}
const throttledBlockUpdate = throttle((id, blockUpdate) => {
  store.dispatch(updateOneBlock({ id, changes: blockUpdate }))
}, 150)

// const throttledMessageUpdate = throttle((topicId, messageId, messageUpdates) => {
//   const dispatch = store.dispatch
//   dispatch(newMessagesActions.updateMessage({ topicId, messageId, updates: { blockInstruction: messageUpdates } }))
// }, 150)

const messageAndBlockUpdate = (topicId, messageId, blockUpdate) => {
  const dispatch = store.dispatch
  store.dispatch(
    newMessagesActions.updateMessage({ topicId, messageId, updates: { blockInstruction: { id: blockUpdate.id } } })
  )
  dispatch(upsertOneBlock(blockUpdate))

  dispatch(newMessagesActions.upsertBlockReference({ messageId, blockId: blockUpdate.id, status: blockUpdate.status }))
}

const throttledDbUpdate = throttle(
  async (messageId: string, topicId: string, getState: () => RootState) => {
    const state = getState()
    const message = state.messages.messagesByTopic[topicId]?.find((m) => m.id === messageId)
    if (!message) return

    const blockIds = message.blocks
    const blocksToSave = blockIds.map((id) => state.messageBlocks.entities[id]).filter((b): b is MessageBlock => !!b)

    await updateExistingMessageAndBlocksInDB(
      { id: messageId, topicId, status: message.status, blocks: blockIds },
      blocksToSave
    )
  },
  500,
  { leading: false, trailing: true }
)

// Internal function extracted from sendMessage to handle fetching and processing assistant response
const fetchAndProcessAssistantResponseImpl = async (
  dispatch: AppDispatch,
  getState: () => RootState,
  topicId: string,
  assistant: Assistant,
  userMessage: Message,
  _contextMessages: Message[],
  passedTopicId: Topic['id']
) => {
  let assistantMessage: Message | null = null
  try {
    // 创建助手消息
    assistantMessage = createAssistantMessage(assistant.id, passedTopicId, {
      askId: userMessage.id,
      model: assistant.model
    })
    const assistantMsgId = assistantMessage.id
    // 将助手消息添加到store
    dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }))
    // 保存助手消息到DB
    await saveMessageAndBlocksToDB(assistantMessage, [])
    // 设置会话加载状态
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }))

    let accumulatedContent = ''
    // Track the last block added to handle interleaving
    let lastBlockId: string | null = null
    let lastBlockType: MessageBlockType | null = null
    // Map to track tool call IDs to their corresponding block IDs
    const toolCallIdToBlockIdMap = new Map<string, string>()

    // --- Context Message Filtering --- START
    // --- Helper Function --- START
    // Helper to manage state transitions when switching block types
    const handleBlockTransition = (newBlock: MessageBlock, newBlockType: MessageBlockType) => {
      // 1. Finalize previous text block (if applicable)
      if (lastBlockType === MessageBlockType.MAIN_TEXT && lastBlockId) {
        console.log(`[Transition] Marking previous MAIN_TEXT block ${lastBlockId} as SUCCESS.`)
        dispatch(updateOneBlock({ id: lastBlockId, changes: { status: MessageBlockStatus.SUCCESS } }))
        // TODO: Consider cancelling throttled update for lastBlockId if throttle library supports it
        // throttledBlockUpdate.cancel(lastBlockId);
      }

      // 2. Update trackers to the new block
      lastBlockId = newBlock.id
      lastBlockType = newBlockType

      // 3. Reset text accumulator
      accumulatedContent = ''

      // 4. Add/Update the new block in store and DB (via messageAndBlockUpdate)
      console.log(`[Transition] Adding/Updating new ${newBlockType} block ${newBlock.id}.`)
      messageAndBlockUpdate(topicId, assistantMsgId, newBlock) // Centralized call
    }
    // --- Helper Function --- END

    const allMessagesForTopic = getState().messages.messagesByTopic[topicId] || []
    // Filter messages: include up to the assistant message stub, remove 'ing' statuses
    const assistantMessageIndex = allMessagesForTopic.findIndex((m) => m.id === assistantMsgId)
    const messagesForContext = (
      assistantMessageIndex !== -1 ? allMessagesForTopic.slice(0, assistantMessageIndex) : allMessagesForTopic
    ).filter((m) => !m.status?.includes('ing'))
    // TODO: Apply further filtering based on assistant settings (maxContextMessages, etc.) if needed
    // --- Context Message Filtering --- END

    const callbacks: StreamProcessorCallbacks = {
      onTextChunk: (text) => {
        accumulatedContent += text
        if (lastBlockType === MessageBlockType.MAIN_TEXT && lastBlockId) {
          throttledBlockUpdate(lastBlockId, {
            content: accumulatedContent
          })
        } else {
          const newBlock = createMainTextBlock(assistantMsgId, accumulatedContent, {
            status: MessageBlockStatus.STREAMING
          })
          lastBlockId = newBlock.id
          lastBlockType = MessageBlockType.MAIN_TEXT

          messageAndBlockUpdate(topicId, assistantMsgId, newBlock)
        }

        throttledDbUpdate(assistantMsgId, topicId, getState)
      },
      onToolCallComplete: (toolResponse: MCPToolResponse) => {
        console.log('toolResponse', toolResponse, toolResponse.status)

        const existingBlockId = toolCallIdToBlockIdMap.get(toolResponse.id)

        if (toolResponse.status === 'invoking') {
          // Status: Invoking - Create the block
          if (existingBlockId) {
            console.warn(
              `[onToolCallComplete] Block already exists for invoking tool call ID: ${toolResponse.id}. Ignoring.`
            )
            return
          }

          const toolBlock = createToolBlock(assistantMsgId, toolResponse.id, {
            toolName: toolResponse.tool.name,
            metadata: {
              rawMcpToolResponse: toolResponse
            }
          })

          // Handle the entire transition using the helper
          handleBlockTransition(toolBlock, MessageBlockType.TOOL)

          toolCallIdToBlockIdMap.set(toolResponse.id, toolBlock.id) // Store the mapping

          console.log('[Invoking] onToolCallComplete', toolBlock)
          // Optionally save initial invoking state to DB
          // throttledDbUpdate(assistantMsgId, topicId, getState)
        } else if (toolResponse.status === 'done' || toolResponse.status === 'error') {
          // Status: Done or Error - Update the existing block
          if (!existingBlockId) {
            console.error(
              `[onToolCallComplete] No existing block found for completed/error tool call ID: ${toolResponse.id}. Cannot update.`
            )
            // Fallback: maybe create a new block? Or just log error.
            // For now, just log and return.
            return
          }

          const finalStatus = toolResponse.status === 'done' ? MessageBlockStatus.SUCCESS : MessageBlockStatus.ERROR
          const changes: Partial<ToolMessageBlock> = {
            content: toolResponse.response,
            status: finalStatus,
            metadata: {
              rawMcpToolResponse: toolResponse
            }
          }
          if (finalStatus === MessageBlockStatus.ERROR) {
            changes.error = { message: `Tool execution failed/error`, details: toolResponse.response }
          }

          console.log(`[${toolResponse.status}] Updating ToolBlock ${existingBlockId} with changes:`, changes)
          // Update the block directly in the store
          dispatch(updateOneBlock({ id: existingBlockId, changes }))

          // Ensure the final state is saved to DB
          throttledDbUpdate(assistantMsgId, topicId, getState)
        } else {
          console.warn(
            `[onToolCallComplete] Received unhandled tool status: ${toolResponse.status} for ID: ${toolResponse.id}`
          )
        }
      },
      onCitationData: (citations) => {
        // TODO: Implement actual citation block creation
        console.warn('onCitationData received, creating placeholder CitationBlock.', citations)
        // Placeholder: Assume citation block is created and update trackers
        // When implemented, call handleBlockTransition:
        // handleBlockTransition(citationBlock, MessageBlockType.CITATION);
        // throttledDbUpdate(assistantMsgId, topicId, getState);
      },
      onImageGenerated: (imageData) => {
        const imageUrl = imageData.images?.[0] || 'placeholder_image_url'
        const imageBlock = createImageBlock(assistantMsgId, {
          url: imageUrl,
          metadata: { generateImageResponse: imageData },
          status: MessageBlockStatus.SUCCESS
        })
        // Handle the transition using the helper
        handleBlockTransition(imageBlock, MessageBlockType.IMAGE)
        throttledDbUpdate(assistantMsgId, topicId, getState)
      },
      onWebSearchGrounding: (groundingMetadata) => {
        // TODO: Implement actual web search block creation
        console.warn('onWebSearchGrounding received, creating placeholder WebSearchBlock.', groundingMetadata)
        // Placeholder: Assume web search block is created and update trackers
        // When implemented, call handleBlockTransition:
        // handleBlockTransition(webSearchBlock, MessageBlockType.WEB_SEARCH);
        // throttledDbUpdate(assistantMsgId, topicId, getState);
      },
      onError: (error) => {
        console.error('Stream processing error:', error)
        // Create a serializable error object
        const serializableError = {
          name: error.name,
          message: 'Stream processing error', // Keep specific message for this context
          originalMessage: error.message, // Store original message separately
          stack: error.stack // Include stack trace if available
          // Add any other relevant serializable properties from the error if needed
        }
        const errorBlock = createErrorBlock(assistantMsgId, serializableError) // Pass the serializable object

        // Use immediate update for error block
        messageAndBlockUpdate(topicId, assistantMsgId, errorBlock)

        // Also update message status directly
        dispatch(
          newMessagesActions.updateMessage({
            topicId,
            messageId: assistantMsgId,
            updates: { status: AssistantMessageStatus.ERROR }
          })
        )
        throttledDbUpdate(assistantMsgId, topicId, getState)
      },
      onComplete: async (status: AssistantMessageStatus, finalError?: any) => {
        // --- Handle Abort Error Specifically ---
        if (status === 'error' && isAbortError(finalError)) {
          console.log(`[onComplete] Stream aborted for message ${assistantMsgId}. Setting status to paused.`)
          // Update message status to 'paused'
          dispatch(
            newMessagesActions.updateMessage({
              topicId,
              messageId: assistantMsgId,
              updates: { status: AssistantMessageStatus.PAUSED }
            })
          )
          // Ensure paused state is saved to DB
          throttledDbUpdate(assistantMsgId, topicId, getState)
          // Skip further block/message status updates for aborts
          return
        }

        // Non-abort error logging is handled by onError or the error source directly.

        // Get the latest state AFTER all chunks/updates have been processed
        const finalState = getState()
        const finalAssistantMsg = finalState.messages.messagesByTopic[topicId]?.find((m) => m.id === assistantMsgId)

        // --- Create Error Block if needed for non-abort errors reported via onComplete --- START
        if (status === 'error' && finalError) {
          // 有错误就创建错误块
          const serializableError = {
            name: finalError.name || 'Error',
            message: finalError.message || 'Stream completed with an unspecified error',
            stack: finalError.stack,
            ...finalError // Spread other potential properties
          }
          const errorBlock = createErrorBlock(assistantMsgId, serializableError)
          // Use immediate update
          messageAndBlockUpdate(topicId, assistantMsgId, errorBlock)
        }
        // --- Create Error Block if needed --- END

        // --- Update final block status ---
        // --- Update status of the VERY LAST block if it was streaming MAIN_TEXT on SUCCESS --- START
        if (status === 'success' && finalAssistantMsg && finalAssistantMsg.blocks.length > 0) {
          const lastBlockIdFromMsg = finalAssistantMsg.blocks[finalAssistantMsg.blocks.length - 1]
          const lastBlock = finalState.messageBlocks.entities[lastBlockIdFromMsg]

          // If the last block was MAIN_TEXT and was still streaming, mark it as success
          if (
            lastBlock &&
            lastBlock.type === MessageBlockType.MAIN_TEXT &&
            lastBlock.status === MessageBlockStatus.STREAMING
          ) {
            console.log(`[onComplete] Setting final streaming MAIN_TEXT block ${lastBlock.id} to SUCCESS.`)
            dispatch(updateOneBlock({ id: lastBlock.id, changes: { status: MessageBlockStatus.SUCCESS } }))
          }
        }
        // --- End of final block status update on SUCCESS --- END

        // --- Update final message status ---
        const messageUpdates: Partial<Message> = { status }

        dispatch(
          newMessagesActions.updateMessage({
            topicId,
            messageId: assistantMsgId,
            updates: messageUpdates // Update message status to 'success' or 'error'
          })
        )
        // --- End of message status update ---

        // Ensure final state is persisted to DB
        throttledDbUpdate(assistantMsgId, topicId, getState)
      }
    }

    const streamProcessorCallbacks = createStreamProcessor(callbacks)

    await fetchChatCompletion({
      messages: messagesForContext,
      assistant: assistant,
      onChunkReceived: streamProcessorCallbacks
    })
  } catch (error: any) {
    console.error('Error fetching chat completion:', error)
    if (assistantMessage) {
      // Create a serializable error object
      const serializableError = {
        name: error.name,
        message: error.message || 'Failed to fetch completion',
        stack: error.stack // Include stack trace if available
        // Add any other relevant serializable properties from the error if needed
      }
      const errorBlock = createErrorBlock(assistantMessage.id, serializableError) // Pass the serializable object

      // Use immediate update for error block during catch
      messageAndBlockUpdate(topicId, assistantMessage.id, errorBlock)
      // Also update message status directly
      dispatch(
        newMessagesActions.updateMessage({
          topicId,
          messageId: assistantMessage.id,
          updates: { status: AssistantMessageStatus.ERROR }
        })
      )
      throttledDbUpdate(assistantMessage.id, topicId, getState) // Ensure DB is updated on error
    }
  } finally {
    const isLoading = getState().messages.loadingByTopic[topicId]
    if (isLoading) {
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }))
    }
  }
}

/**
 * 发送消息并处理助手回复
 * @param userMessage 已创建的用户消息
 * @param userMessageBlocks 用户消息关联的消息块
 * @param assistant 助手对象
 * @param topicId 主题ID
 */
export const sendMessage =
  (userMessage: Message, userMessageBlocks: MessageBlock[], assistant: Assistant, topicId: Topic['id']) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    try {
      if (userMessage.blocks.length === 0) {
        console.warn('sendMessage: No blocks in the provided message.')
        return
      }

      // 更新store和DB
      dispatch(newMessagesActions.addMessage({ topicId, message: userMessage }))
      if (userMessageBlocks.length > 0) {
        dispatch(upsertManyBlocks(userMessageBlocks))
      }
      await saveMessageAndBlocksToDB(userMessage, userMessageBlocks)

      // 将获取/处理调用添加到队列
      const queue = getTopicQueue(topicId)
      queue.add(async () => {
        const currentState = getState()
        const allMessages = currentState.messages.messagesByTopic[topicId] || []
        // 传递原始消息列表直到用户消息
        const contextMessages = allMessages.slice(0, allMessages.findIndex((m) => m.id === userMessage.id) + 1)

        await fetchAndProcessAssistantResponseImpl(
          dispatch,
          getState,
          topicId,
          assistant,
          userMessage,
          contextMessages,
          topicId
        )
      })
    } catch (error) {
      console.error('Error in sendMessage thunk:', error)
    }
  }

// Placeholder for the new resendMessage thunk
export const resendMessage =
  (messageToResend: Message, assistant: Assistant, topic: Topic) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    console.warn('resendMessage thunk not fully implemented yet.')
    // 初步实现resendMessage逻辑
    try {
      const topicId = topic.id
      // 1. 获取要重发的消息
      const state = getState()

      // 2. 创建新的助手消息作为回复
      const assistantMessage = createAssistantMessage(assistant.id, topicId, { askId: messageToResend.id })

      // 3. 将消息添加到store
      dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }))

      // 4. 使用现有的fetchAndProcessAssistantResponseImpl处理助手响应
      // 找到消息上下文
      const allMessages = state.messages.messagesByTopic[topicId] || []
      const messageIndex = allMessages.findIndex((m) => m.id === messageToResend.id)
      const contextMessages =
        messageIndex !== -1 ? allMessages.slice(0, messageIndex + 1) : [...allMessages, messageToResend]

      // 调用处理助手响应的函数
      await fetchAndProcessAssistantResponseImpl(
        dispatch,
        getState,
        topicId,
        assistant,
        messageToResend,
        contextMessages,
        topicId
      )
    } catch (error) {
      console.error('Error in resendMessage thunk:', error)
    }
  }

/**
 * Loads messages and their blocks for a specific topic from the database
 * and updates the Redux store.
 */
export const loadTopicMessagesThunk =
  (topicId: string, forceReload: boolean = false) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState()
    const topicMessagesExist = state.messages.messagesByTopic[topicId]
    const isLoading = state.messages.loadingByTopic[topicId]

    if ((topicMessagesExist && !forceReload) || isLoading) {
      if (topicMessagesExist && isLoading) {
        dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }))
      }
      return
    }

    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }))

    try {
      const topic = await db.topics.get(topicId)
      const messages = topic?.messages || []

      if (messages.length > 0) {
        const messageIds = messages.map((m) => m.id)
        const blocks = await db.message_blocks.where('messageId').anyOf(messageIds).toArray()

        if (blocks && blocks.length > 0) {
          dispatch(upsertManyBlocks(blocks))
        }
        const messagesWithBlockIds = messages.map((m) => ({
          ...m,
          blocks: m.blocks || []
        }))
        dispatch(newMessagesActions.messagesReceived({ topicId, messages: messagesWithBlockIds }))
      } else {
        dispatch(newMessagesActions.messagesReceived({ topicId, messages: [] }))
      }
    } catch (error: any) {
      console.error(`[loadTopicMessagesThunk] Failed to load messages for topic ${topicId}:`, error)
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }))
    }
  }

/**
 * Thunk to delete a single message and its associated blocks.
 */
export const deleteSingleMessageThunk =
  (topicId: string, messageId: string) => async (dispatch: AppDispatch, getState: () => RootState) => {
    // Get the current state
    const currentState = getState()

    // Find the message to delete and associated blocks
    const messageToDelete = currentState.messages.messagesByTopic[topicId]?.find((m) => m.id === messageId)
    if (!messageToDelete) {
      console.error(`[deleteSingleMessage] Message ${messageId} not found in topic ${topicId}.`)
      return
    }

    // Get IDs of blocks to delete
    const blockIdsToDelete = messageToDelete.blocks

    try {
      // Dispatch actions to remove from Redux state
      dispatch(removeMessage({ topicId, messageId })) // Use the new action
      dispatch(removeManyBlocks(blockIdsToDelete)) // Use imported action

      // Remove from Dexie DB
      await db.message_blocks.bulkDelete(blockIdsToDelete)
      const topic = await db.topics.get(topicId)
      if (topic) {
        const updatedMessages = topic.messages.filter((m) => m.id !== messageId)
        await db.topics.update(topicId, { messages: updatedMessages })
      }
    } catch (error) {
      console.error(`[deleteSingleMessage] Failed to delete message ${messageId}:`, error)
      // TODO: Consider rollback or adding back to state if DB fails?
    }
  }

/**
 * Thunk to delete a group of messages (user query + assistant responses) based on askId.
 */
export const deleteMessageGroupThunk =
  (topicId: string, askId: string) => async (dispatch: AppDispatch, getState: () => RootState) => {
    // Get the current state
    const currentState = getState()

    // Find messages to delete based on askId
    const messagesToDelete = currentState.messages.messagesByTopic[topicId]?.filter((m) => m.askId === askId)

    if (!messagesToDelete || messagesToDelete.length === 0) {
      console.warn(`[deleteMessageGroup] No messages found with askId ${askId} in topic ${topicId}.`)
      return
    }

    const blockIdsToDelete = messagesToDelete.flatMap((m) => m.blocks)

    try {
      // Dispatch actions to remove from Redux state
      dispatch(removeMessagesByAskId({ topicId, askId })) // Use the new action
      dispatch(removeManyBlocks(blockIdsToDelete)) // Use imported action

      // Remove from Dexie DB
      await db.message_blocks.bulkDelete(blockIdsToDelete)
      const topic = await db.topics.get(topicId)
      if (topic) {
        const updatedMessages = topic.messages.filter((m) => m.askId !== askId)
        await db.topics.update(topicId, { messages: updatedMessages })
      }
    } catch (error) {
      console.error(`[deleteMessageGroup] Failed to delete messages with askId ${askId}:`, error)
      // TODO: Rollback?
    }
  }

/**
 * Thunk to clear all messages and associated blocks for a topic.
 */
export const clearTopicMessagesThunk =
  (topicId: string) => async (dispatch: AppDispatch, getState: () => RootState) => {
    try {
      const state = getState()
      const messagesToClear = state.messages.messagesByTopic[topicId] || []
      const blockIdsToDeleteSet = new Set<string>()

      messagesToClear.forEach((message) => {
        message.blocks?.forEach((blockId) => blockIdsToDeleteSet.add(blockId))
      })

      const blockIdsToDelete = Array.from(blockIdsToDeleteSet)

      // 1. Update Redux State
      dispatch(newMessagesActions.clearTopicMessages(topicId))
      if (blockIdsToDelete.length > 0) {
        dispatch(removeManyBlocks(blockIdsToDelete))
      }

      // 2. Update Dexie DB
      // Clear messages array in topic
      await db.topics.update(topicId, { messages: [] })
      // Delete blocks from DB
      if (blockIdsToDelete.length > 0) {
        await db.message_blocks.bulkDelete(blockIdsToDelete)
      }
    } catch (error) {
      console.error(`[clearTopicMessagesThunk] Failed to clear messages for topic ${topicId}:`, error)
      // Optionally dispatch an error action
    }
  }

/**
 * Thunk to resend an existing message (usually the last user message).
 * This involves potentially deleting subsequent messages and re-fetching the assistant response.
 */
export const resendMessageThunk =
  (topic: Topic, messageToResend: Message, assistant: Assistant) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    console.log(`[resendMessageThunk] Resending message ${messageToResend.id} in topic ${topic.id}`)
    try {
      const topicId = topic.id
      const state = getState()
      const allMessages = state.messages.messagesByTopic[topicId] || []
      const resendIndex = allMessages.findIndex((m) => m.id === messageToResend.id)

      if (resendIndex === -1) {
        console.error(`[resendMessageThunk] Message ${messageToResend.id} not found for resend.`)
        return
      }

      // --- Delete subsequent messages and their blocks ---
      const messagesToDelete = allMessages.slice(resendIndex + 1)
      const blockIdsToDelete = messagesToDelete.flatMap((m) => m.blocks)

      if (messagesToDelete.length > 0) {
        console.log(`[resendMessageThunk] Deleting ${messagesToDelete.length} subsequent messages.`)
        // Update Redux
        dispatch(newMessagesActions.removeMessages({ topicId, messageIds: messagesToDelete.map((m) => m.id) }))
        if (blockIdsToDelete.length > 0) {
          dispatch(removeManyBlocks(blockIdsToDelete))
        }
        // Update DB (remove from topic and delete blocks)
        const dbTopic = await db.topics.get(topicId)
        if (dbTopic && dbTopic.messages) {
          const updatedMessages = dbTopic.messages.filter((m: any) => !messagesToDelete.map((m) => m.id).includes(m.id))
          await db.topics.update(topicId, { messages: updatedMessages })
        }
        if (blockIdsToDelete.length > 0) {
          await db.message_blocks.bulkDelete(blockIdsToDelete)
        }
      }
      // --- End Deletion ---

      // Context includes messages up to (and including) the one being resent
      const currentMessages = getState().messages.messagesByTopic[topicId] || [] // Get updated list
      const contextMessages = currentMessages.slice(
        0,
        currentMessages.findIndex((m) => m.id === messageToResend.id) + 1
      )

      // Add fetch/process call to the queue for this topic
      const queue = getTopicQueue(topicId)
      queue.add(async () => {
        await fetchAndProcessAssistantResponseImpl(
          dispatch,
          getState,
          topicId,
          assistant,
          messageToResend, // The message triggering the response
          contextMessages, // Context for the LLM call
          topicId
        )
      })
    } catch (error) {
      console.error(`[resendMessageThunk] Error resending message ${messageToResend.id}:`, error)
      // Ensure loading state is potentially reset if error happens before fetch starts
      dispatch(newMessagesActions.setTopicLoading({ topicId: topic.id, loading: false }))
    }
  }

/**
 * Thunk to resend a user message after its content has been edited.
 */
export const resendUserMessageWithEditThunk =
  (topic: Topic, originalMessage: Message, mainTextBlockId: string, editedContent: string, assistant: Assistant) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    const topicId = topic.id
    const messages = getState().messages.messagesByTopic[topicId] || []

    // 1. Find the index of the message being edited/resent
    const messageIndex = messages.findIndex((m) => m.id === originalMessage.id)
    if (messageIndex === -1) {
      console.error(`[resendWithEdit] Message ${originalMessage.id} not found in topic ${topicId}`)
      return
    }

    // 2. Identify messages and blocks to remove (subsequent messages)
    const messagesToRemove = messages.slice(messageIndex + 1)
    const messageIdsToRemove = messagesToRemove.map((m) => m.id)
    const blockIdsToRemove = messagesToRemove.flatMap((m) => m.blocks)

    // 3. Prepare the updated user message and block
    const updatedUserMessage: Message = {
      ...originalMessage
      // updatedAt property is intentionally removed based on type definition
      // other fields remain the same initially
    }
    const updatedBlock: MessageBlock = {
      ...(getState().messageBlocks.entities[mainTextBlockId] as MainTextMessageBlock), // Assert as MainTextMessageBlock
      content: editedContent,
      updatedAt: new Date().toISOString(),
      status: MessageBlockStatus.SUCCESS // Assume edit makes it final
    }

    // 4. Update State and DB before sending the new request
    try {
      // Update user message and its block in Redux
      dispatch(
        newMessagesActions.updateMessage({ topicId, messageId: originalMessage.id, updates: updatedUserMessage })
      )
      dispatch(upsertOneBlock(updatedBlock))

      // Remove subsequent messages/blocks from Redux
      if (messageIdsToRemove.length > 0) {
        dispatch(removeMessages({ topicId, messageIds: messageIdsToRemove })) // Use the new action
      }
      if (blockIdsToRemove.length > 0) {
        dispatch(removeManyBlocks(blockIdsToRemove)) // Use imported action
      }

      // Update user message and block in Dexie DB
      await db.message_blocks.put(updatedBlock)
      // Remove subsequent messages/blocks from Dexie DB
      if (blockIdsToRemove.length > 0) {
        await db.message_blocks.bulkDelete(blockIdsToRemove)
      }

      // Update the topic in DB: remove subsequent messages AND update the edited user message
      const dbTopic = await db.topics.get(topicId)
      if (dbTopic) {
        const finalMessages = dbTopic.messages.filter((m) => !messageIdsToRemove.includes(m.id))
        const editedMsgIndex = finalMessages.findIndex((m) => m.id === originalMessage.id)
        if (editedMsgIndex !== -1) {
          finalMessages[editedMsgIndex] = updatedUserMessage // Replace with the updated message object
        }
        await db.topics.update(topicId, { messages: finalMessages }) // Corrected update call
      } else {
        console.error(`[resendWithEdit] Topic ${topicId} not found in DB for update.`)
      }
    } catch (error) {
      console.error(`[resendWithEdit] Failed during update/deletion for message ${originalMessage.id}:`, error)
      // TODO: Handle potential state inconsistency
      return
    }

    // 5. Get updated context messages (up to and including the edited user message)
    const contextMessages = getState().messages.messagesByTopic[topicId]?.slice(0, messageIndex + 1) || []

    // 6. Send New Request
    await fetchAndProcessAssistantResponseImpl(
      dispatch,
      getState,
      topicId,
      assistant,
      updatedUserMessage, // Pass the *updated* user message
      contextMessages, // Pass context including the updated message
      topicId // Pass topicId again
    )
  }
