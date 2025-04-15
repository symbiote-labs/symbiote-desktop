import db from '@renderer/databases'
import { fetchChatCompletion } from '@renderer/services/ApiService'
import { createStreamProcessor, type StreamProcessorCallbacks } from '@renderer/services/StreamProcessingService'
import type { Assistant, FileType, MCPToolResponse, Topic } from '@renderer/types'
import { FileTypes } from '@renderer/types'
import type { MainTextMessageBlock, Message, MessageBlock } from '@renderer/types/newMessageTypes'
import { MessageBlockStatus, MessageBlockType } from '@renderer/types/newMessageTypes'
import {
  createAssistantMessage,
  createErrorBlock,
  createFileBlock,
  createImageBlock,
  createMainTextBlock,
  createMessage,
  createToolBlock
} from '@renderer/utils/messageUtils/create'
import { getTopicQueue } from '@renderer/utils/queue'
import { throttle } from 'lodash'

import type { AppDispatch, RootState } from '../index'
import { updateOneBlock, upsertManyBlocks, upsertOneBlock } from '../messageBlock'
import { newMessagesActions } from '../newMessage'

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
    if (updatedBlocks.length > 0) {
      await db.message_blocks.bulkPut(updatedBlocks)
    }
    const topic = await db.topics.get(updatedMessage.topicId)
    if (topic) {
      const messageIndex = topic.messages.findIndex((m) => m.id === updatedMessage.id)
      if (messageIndex !== -1) {
        const newMessages = [...topic.messages]
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

const throttledStateUpdate = throttle(
  (
    dispatch: AppDispatch,
    messageId: string,
    topicId: string,
    blockUpdates: MessageBlock[],
    messageUpdates: Partial<Message>,
    getState: () => RootState
  ) => {
    if (blockUpdates.length > 0) {
      dispatch(upsertManyBlocks(blockUpdates))
      const currentState = getState()
      blockUpdates.forEach((block) => {
        if (!currentState.messageBlocks.entities[block.id]) {
          dispatch(newMessagesActions.upsertBlockReference({ messageId, blockId: block.id, status: block.status }))
        }
      })
    }
    if (Object.keys(messageUpdates).length > 0) {
      dispatch(newMessagesActions.updateMessage({ topicId, messageId, updates: messageUpdates }))
    }
  },
  150,
  { leading: true, trailing: true }
)

const throttledDbUpdate = throttle(
  async (messageId: string, topicId: string, getState: () => RootState) => {
    const state = getState()
    const message = state.messages.messagesByTopic[topicId]?.find((m) => m.id === messageId)
    if (!message) return
    const blockIds = message.blocks
    const blocks = blockIds.map((id) => state.messageBlocks.entities[id]).filter((b): b is MessageBlock => !!b)
    await updateExistingMessageAndBlocksInDB({ id: messageId, topicId, status: message.status }, blocks)
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
  passedTopic: Topic
) => {
  let assistantMessage: Message | null = null
  try {
    assistantMessage = createAssistantMessage(assistant.id, passedTopic, { askId: userMessage.id })
    const assistantMsgId = assistantMessage.id

    dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }))
    await saveMessageAndBlocksToDB(assistantMessage, [])

    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }))

    let accumulatedContent = ''
    let mainTextBlockId: string | null = null

    // --- Context Message Filtering --- START
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
        let blockToUpsert: MessageBlock | null = null
        if (!mainTextBlockId) {
          const newBlock = createMainTextBlock(assistantMsgId, accumulatedContent, {
            status: MessageBlockStatus.STREAMING
          })
          mainTextBlockId = newBlock.id
          blockToUpsert = newBlock
        } else {
          dispatch(
            updateOneBlock({
              id: mainTextBlockId,
              changes: { content: accumulatedContent, status: MessageBlockStatus.STREAMING }
            })
          )
        }
        throttledStateUpdate(
          dispatch,
          assistantMsgId,
          topicId,
          blockToUpsert ? [blockToUpsert] : [],
          { status: 'processing' },
          getState
        )
        throttledDbUpdate(assistantMsgId, topicId, getState)
      },
      onToolCallComplete: (toolResponse: MCPToolResponse) => {
        const toolBlock = createToolBlock(assistantMsgId, toolResponse.id, {
          toolName: toolResponse.tool.name,
          content: toolResponse.response,
          status: toolResponse.status === 'done' ? MessageBlockStatus.SUCCESS : MessageBlockStatus.ERROR,
          ...(toolResponse.status !== 'done' && {
            error: { message: `Tool status: ${toolResponse.status}`, details: toolResponse.response }
          })
        })
        throttledStateUpdate(dispatch, assistantMsgId, topicId, [toolBlock], { status: 'processing' }, getState)
        throttledDbUpdate(assistantMsgId, topicId, getState)
      },
      onCitationData: (citations) => {
        console.warn('onCitationData received, creating placeholder CitationBlock.', citations)
      },
      onImageGenerated: (imageData) => {
        const imageUrl = imageData.images[0]
        const imageBlock = createImageBlock(assistantMsgId, {
          url: imageUrl,
          metadata: { generateImageResponse: imageData },
          status: MessageBlockStatus.SUCCESS
        })
        throttledStateUpdate(dispatch, assistantMsgId, topicId, [imageBlock], { status: 'processing' }, getState)
        throttledDbUpdate(assistantMsgId, topicId, getState)
      },
      onWebSearchGrounding: (groundingMetadata) => {
        console.warn('onWebSearchGrounding received, creating placeholder WebSearchBlock.', groundingMetadata)
      },
      onError: (error) => {
        console.error('Stream processing error:', error)
        const errorBlock = createErrorBlock(assistantMsgId, {
          message: 'Stream processing error',
          details: error
        })
        dispatch(upsertOneBlock(errorBlock))
        dispatch(
          newMessagesActions.upsertBlockReference({
            messageId: assistantMsgId,
            blockId: errorBlock.id,
            status: errorBlock.status
          })
        )
        dispatch(
          newMessagesActions.updateMessage({
            topicId,
            messageId: assistantMsgId,
            updates: { status: 'error' }
          })
        )
        throttledDbUpdate(assistantMsgId, topicId, getState)
      },
      onComplete: async (status: 'error' | 'success', finalError?: any) => {
        if (status === 'error' && finalError) {
          console.error('Stream completed with error:', finalError)
        }
        const finalState = getState()
        const finalAssistantMsg = finalState.messages.messagesByTopic[topicId]?.find((m) => m.id === assistantMsgId)

        const mainTextBlockId = finalAssistantMsg?.blocks.find((blockId) => {
          const block = finalState.messageBlocks.entities[blockId]
          return block && block.type === MessageBlockType.MAIN_TEXT
        })

        if (mainTextBlockId) {
          const mainTextBlock = finalState.messageBlocks.entities[mainTextBlockId] as MainTextMessageBlock | undefined
          if (mainTextBlock && mainTextBlock.status === MessageBlockStatus.STREAMING) {
            const blockFinalStatus = status === 'error' ? MessageBlockStatus.ERROR : MessageBlockStatus.SUCCESS
            dispatch(updateOneBlock({ id: mainTextBlockId, changes: { status: blockFinalStatus } }))
          }
          // TODO: Find a way to get final usage/metrics and update the block here if needed.
        }

        const updates: Partial<Message> = { status }
        // TODO: Find a way to get the final model used

        dispatch(
          newMessagesActions.updateMessage({
            topicId,
            messageId: assistantMsgId,
            updates
          })
        )
        throttledDbUpdate(assistantMsgId, topicId, getState) // Ensure final DB update
      }
    }

    const streamProcessorFn = createStreamProcessor(callbacks)

    // Call fetchChatCompletion with filtered context and new callback signature
    await fetchChatCompletion({
      messages: messagesForContext,
      assistant: assistant,
      onChunkReceived: streamProcessorFn
    })
  } catch (error: any) {
    console.error('Error fetching chat completion:', error)
    if (assistantMessage) {
      const errorBlock = createErrorBlock(assistantMessage.id, {
        message: error.message || 'Failed to fetch completion',
        details: error
      })
      dispatch(upsertOneBlock(errorBlock))
      dispatch(
        newMessagesActions.upsertBlockReference({
          messageId: assistantMessage.id,
          blockId: errorBlock.id,
          status: errorBlock.status
        })
      )
      dispatch(
        newMessagesActions.updateMessage({ topicId, messageId: assistantMessage.id, updates: { status: 'error' } })
      )
      throttledDbUpdate(assistantMessage.id, topicId, getState) // Ensure DB is updated on error
    }
  } finally {
    // Check if still loading before setting to false, another message might have started
    const isLoading = getState().messages.loadingByTopic[topicId]
    if (isLoading) {
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }))
    }
  }
}

export const sendMessage =
  (userInput: { content: string; files?: FileType[] }, assistant: Assistant, topic: Topic) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    let userMessage: Message | null = null
    const userMessageBlocks: MessageBlock[] = []
    const topicId = topic.id

    try {
      // Create user message and blocks (same as before)
      userMessage = createMessage('user', topicId, assistant.id, 'text')
      if (userInput.content?.trim()) {
        const textBlock = createMainTextBlock(userMessage.id, userInput.content, { status: MessageBlockStatus.SUCCESS })
        userMessageBlocks.push(textBlock)
        userMessage.blocks.push(textBlock.id)
      }
      if (userInput.files?.length) {
        userInput.files.forEach((file) => {
          if (file.type === FileTypes.IMAGE) {
            const imgBlock = createImageBlock(userMessage!.id, { file: file, status: MessageBlockStatus.SUCCESS })
            userMessageBlocks.push(imgBlock)
            userMessage!.blocks.push(imgBlock.id)
          } else {
            const fileBlock = createFileBlock(userMessage!.id, file, { status: MessageBlockStatus.SUCCESS })
            userMessageBlocks.push(fileBlock)
            userMessage!.blocks.push(fileBlock.id)
          }
        })
      }
      if (userMessage.blocks.length === 0) {
        console.warn('sendMessage: No content or files provided.')
        return
      }

      // Update store and DB for user message (same as before)
      dispatch(newMessagesActions.addMessage({ topicId, message: userMessage }))
      if (userMessageBlocks.length > 0) {
        dispatch(upsertManyBlocks(userMessageBlocks))
      }
      await saveMessageAndBlocksToDB(userMessage, userMessageBlocks)

      // Add the fetch/process call to the queue
      const queue = getTopicQueue(topicId)
      queue.add(async () => {
        const currentState = getState()
        const allMessages = currentState.messages.messagesByTopic[topicId] || []
        // Pass the raw message list up to the user message
        const contextMessages = allMessages.slice(0, allMessages.findIndex((m) => m.id === userMessage!.id) + 1)

        await fetchAndProcessAssistantResponseImpl(
          dispatch,
          getState,
          topicId,
          assistant,
          userMessage!, // User message reference
          contextMessages, // Raw context for filtering inside the impl
          topic
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
    // TODO: Implement resend logic using _fetchAndProcessAssistantResponse
  }
