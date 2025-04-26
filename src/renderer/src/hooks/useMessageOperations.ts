import { createSelector } from '@reduxjs/toolkit'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import store, { type RootState, useAppDispatch, useAppSelector } from '@renderer/store'
import { messageBlocksSelectors } from '@renderer/store/messageBlock'
import { updateOneBlock } from '@renderer/store/messageBlock'
import { newMessagesActions, selectMessagesForTopic } from '@renderer/store/newMessage'
import {
  clearTopicMessagesThunk,
  deleteMessageGroupThunk,
  deleteSingleMessageThunk,
  initiateTranslationThunk,
  regenerateAssistantResponseThunk,
  resendMessageThunk,
  resendUserMessageWithEditThunk
} from '@renderer/store/thunk/messageThunk'
import { throttledBlockDbUpdate } from '@renderer/store/thunk/messageThunk'
import type { Assistant, Topic } from '@renderer/types'
import type { Message, MessageBlock } from '@renderer/types/newMessage'
import { MessageBlockStatus, MessageBlockType } from '@renderer/types/newMessage'
import { abortCompletion } from '@renderer/utils/abortController'
import { useCallback } from 'react'

const findMainTextBlockId = (message: Message): string | undefined => {
  if (!message || !message.blocks) return undefined
  const state = store.getState()
  for (const blockId of message.blocks) {
    const block = messageBlocksSelectors.selectById(state, String(blockId))
    if (block && block.type === MessageBlockType.MAIN_TEXT) {
      return block.id
    }
  }
  return undefined
}

const selectMessagesState = (state: RootState) => state.messages

export const selectNewTopicMessages = createSelector(
  [selectMessagesState, (state: RootState, topicId: string) => topicId],
  (messagesState, topicId) => messagesState.messageIdsByTopic[topicId] || []
)

export const selectNewTopicLoading = createSelector(
  [selectMessagesState, (state: RootState, topicId: string) => topicId],
  (messagesState, topicId) => messagesState.loadingByTopic[topicId] || false
)

export const selectNewDisplayCount = createSelector(
  [selectMessagesState],
  (messagesState) => messagesState.displayCount
)

/**
 *
 * @param topic 当前主题
 * @returns 一组消息操作方法
 */
export function useMessageOperations(topic: Topic) {
  const dispatch = useAppDispatch()

  /**
   * 删除单个消息
   * Dispatches deleteSingleMessageThunk.
   */
  const deleteMessage = useCallback(
    async (id: string) => {
      await dispatch(deleteSingleMessageThunk(topic.id, id))
    },
    [dispatch, topic.id] // Use topic.id directly
  )

  /**
   * 删除一组消息（基于askId）
   * Dispatches deleteMessageGroupThunk.
   */
  const deleteGroupMessages = useCallback(
    async (askId: string) => {
      await dispatch(deleteMessageGroupThunk(topic.id, askId))
    },
    [dispatch, topic.id]
  )

  /**
   * 编辑消息 (Uses newMessagesActions.updateMessage)
   * TODO: Token recalculation logic needs adding if required.
   */
  const editMessage = useCallback(
    async (messageId: string, updates: Partial<Message>) => {
      // Basic update remains the same
      await dispatch(newMessagesActions.updateMessage({ topicId: topic.id, messageId, updates }))
      // TODO: Add token recalculation logic here if necessary
      // if ('content' in updates or other relevant fields change) {
      //   const state = store.getState(); // Need store or selector access
      //   const message = state.messages.messagesByTopic[topic.id]?.find(m => m.id === messageId);
      //   if (message) {
      //      const updatedUsage = await estimateTokenUsage(...); // Call estimation service
      //      await dispatch(newMessagesActions.updateMessage({ topicId: topic.id, messageId, updates: { usage: updatedUsage } }));
      //   }
      // }
    },
    [dispatch, topic.id]
  )

  /**
   * 重新发送消息
   * Dispatches resendMessageThunk.
   */
  const resendMessage = useCallback(
    async (message: Message, assistant: Assistant) => {
      await dispatch(resendMessageThunk(topic.id, message, assistant))
    },
    [dispatch, topic.id] // topic object needed by thunk
  )

  /**
   * 重新发送用户消息（编辑后）
   * Dispatches resendUserMessageWithEditThunk.
   */
  const resendUserMessageWithEdit = useCallback(
    async (message: Message, editedContent: string, assistant: Assistant) => {
      const mainTextBlockId = findMainTextBlockId(message)
      if (!mainTextBlockId) {
        console.error('Cannot resend edited message: Main text block not found.')
        return
      }

      await dispatch(resendUserMessageWithEditThunk(topic.id, message, mainTextBlockId, editedContent, assistant))
    },
    [dispatch, topic.id] // topic object needed by thunk
  )

  /**
   * 清除会话消息
   * Dispatches clearTopicMessagesThunk.
   */
  const clearTopicMessages = useCallback(
    async (_topicId?: string) => {
      const topicIdToClear = _topicId || topic.id
      await dispatch(clearTopicMessagesThunk(topicIdToClear))
    },
    [dispatch, topic.id]
  )

  /**
   * 创建新的上下文（clear message）
   */
  const createNewContext = useCallback(async () => {
    EventEmitter.emit(EVENT_NAMES.NEW_CONTEXT)
  }, [])

  const displayCount = useAppSelector(selectNewDisplayCount)

  /**
   * 暂停消息流
   */
  const pauseMessages = useCallback(async () => {
    // Use selector if preferred, but direct access is okay in callback
    const state = store.getState()
    const topicMessages = selectMessagesForTopic(state, topic.id)
    if (!topicMessages) return

    // Find messages currently in progress (adjust statuses if needed)
    const streamingMessages = topicMessages.filter((m) => m.status === 'processing' || m.status === 'pending')

    const askIds = [...new Set(streamingMessages?.map((m) => m.askId).filter((id) => !!id) as string[])]

    for (const askId of askIds) {
      abortCompletion(askId)
    }
    // Ensure loading state is set to false
    dispatch(newMessagesActions.setTopicLoading({ topicId: topic.id, loading: false }))
  }, [topic.id, dispatch])

  /**
   * 恢复/重发消息
   * Reuses resendMessage logic.
   */
  const resumeMessage = useCallback(
    async (message: Message, assistant: Assistant) => {
      // Directly call the resendMessage function from this hook
      return resendMessage(message, assistant)
    },
    [resendMessage] // Dependency is the resendMessage function itself
  )

  /**
   * 重新生成助手消息
   * Dispatches regenerateAssistantResponseThunk.
   */
  const regenerateAssistantMessage = useCallback(
    async (message: Message, assistant: Assistant) => {
      if (message.role !== 'assistant') {
        console.warn('regenerateAssistantMessage should only be called for assistant messages.')
        return
      }
      await dispatch(regenerateAssistantResponseThunk(topic.id, message, assistant))
    },
    [dispatch, topic.id] // topic object needed by thunk
  )

  /**
   * Initiates translation and returns a function to update the streaming block.
   * @returns An async function that, when called with text chunks, updates the block.
   *          Returns null if initiation fails.
   */
  const getTranslationUpdater = useCallback(
    async (
      messageId: string,
      targetLanguage: string,
      sourceBlockId?: string,
      sourceLanguage?: string
    ): Promise<((accumulatedText: string, isComplete?: boolean) => void) | null> => {
      if (!topic.id) return null

      // 1. Initiate the block and get its ID
      const blockId = await dispatch(
        initiateTranslationThunk(messageId, topic.id, targetLanguage, sourceBlockId, sourceLanguage)
      )

      if (!blockId) {
        console.error('[getTranslationUpdater] Failed to initiate translation block.')
        return null
      }

      // 2. Return the updater function
      // TODO:下面这个逻辑也可以放在thunk中
      return (accumulatedText: string, isComplete: boolean = false) => {
        const status = isComplete ? MessageBlockStatus.SUCCESS : MessageBlockStatus.STREAMING
        const changes: Partial<MessageBlock> = { content: accumulatedText, status: status } // Use Partial<MessageBlock>

        // Dispatch update to Redux store
        dispatch(updateOneBlock({ id: blockId, changes }))

        // Throttle update to DB
        throttledBlockDbUpdate(blockId, changes) // Use the throttled function

        // if (isComplete) {
        //   console.log(`[TranslationUpdater] Final update for block ${blockId}.`)
        //   // Ensure the throttled function flushes if needed, or call an immediate save
        //   // For simplicity, we rely on the throttle's trailing call for now.
        // }
      }
    },
    [dispatch, topic.id]
  )

  return {
    displayCount,
    deleteMessage,
    deleteGroupMessages,
    editMessage,
    resendMessage, // Export renamed function
    regenerateAssistantMessage, // Export the new function
    resendUserMessageWithEdit,
    createNewContext,
    clearTopicMessages, // Export renamed function
    pauseMessages,
    resumeMessage,
    getTranslationUpdater
  }
}

export const useTopicMessages = (topic: Topic) => {
  const messages = useAppSelector((state) => selectMessagesForTopic(state, topic.id))
  return messages
}

export const useTopicLoading = (topic: Topic) => {
  const loading = useAppSelector((state) => selectNewTopicLoading(state, topic.id))
  return loading
}
