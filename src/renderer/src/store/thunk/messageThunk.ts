import db from '@renderer/databases'
import { fetchChatCompletion } from '@renderer/services/ApiService'
import { createStreamProcessor, type StreamProcessorCallbacks } from '@renderer/services/StreamProcessingService'
import store from '@renderer/store'
import {
  type Assistant,
  ExternalToolResult,
  type MCPToolResponse,
  type Model,
  type Topic,
  WebSearchSource
} from '@renderer/types'
import type { CitationMessageBlock, Message, MessageBlock, ToolMessageBlock } from '@renderer/types/newMessage'
import { AssistantMessageStatus, MessageBlockStatus, MessageBlockType } from '@renderer/types/newMessage'
import { Response } from '@renderer/types/newMessage'
import { extractUrlsFromMarkdown } from '@renderer/utils/linkConverter'
import {
  createAssistantMessage,
  createCitationBlock,
  createErrorBlock,
  createImageBlock,
  createMainTextBlock,
  createThinkingBlock,
  createToolBlock,
  resetAssistantMessage
} from '@renderer/utils/messageUtils/create'
import { getTopicQueue, waitForTopicQueue } from '@renderer/utils/queue'
import { throttle } from 'lodash'

import type { AppDispatch, RootState } from '../index'
import { removeManyBlocks, updateOneBlock, upsertManyBlocks, upsertOneBlock } from '../messageBlock'
import { newMessagesActions, removeMessage, removeMessagesByAskId } from '../newMessage'

const handleChangeLoadingOfTopic = async (topicId: string) => {
  await waitForTopicQueue(topicId)
  console.log('[DEBUG] Waiting for topic queue to complete')
  store.dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }))
}

const saveMessageAndBlocksToDB = async (message: Message, blocks: MessageBlock[]) => {
  try {
    console.log(`[DEBUG] saveMessageAndBlocksToDB started for message ${message.id} with ${blocks.length} blocks`)
    if (blocks.length > 0) {
      console.log('[DEBUG] Saving blocks to DB')
      await db.message_blocks.bulkPut(blocks)
      console.log('[DEBUG] Blocks saved to DB')
    }
    console.log('[DEBUG] Getting topic from DB')
    const topic = await db.topics.get(message.topicId)
    console.log('[DEBUG] Got topic from DB:', !!topic)
    if (topic) {
      const messageIndex = topic.messages.findIndex((m) => m.id === message.id)
      const updatedMessages = [...topic.messages]

      if (messageIndex !== -1) {
        updatedMessages[messageIndex] = message
      } else {
        updatedMessages.push(message)
      }
      console.log('[DEBUG] Updating topic in DB', updatedMessages)
      await db.topics.update(message.topicId, { messages: updatedMessages })
      console.log('[DEBUG] Topic updated in DB')
    } else {
      console.error(`[saveMessageAndBlocksToDB] Topic ${message.topicId} not found.`)
    }
    console.log(`[DEBUG] saveMessageAndBlocksToDB completed for message ${message.id}`)
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

// 更新单个块的逻辑，用于更新消息中的单个块
const throttledBlockUpdate = throttle((id, blockUpdate) => {
  store.dispatch(updateOneBlock({ id, changes: blockUpdate }))
}, 150)

// 更新消息和块的逻辑，用于更新消息中的单个块
const messageAndBlockUpdate = (topicId, messageId, blockUpdate) => {
  const dispatch = store.dispatch
  // 更新message.blocks
  dispatch(
    newMessagesActions.updateMessage({ topicId, messageId, updates: { blockInstruction: { id: blockUpdate.id } } })
  )
  // 更新块/没有就创建
  dispatch(upsertOneBlock(blockUpdate))
  // 更新message的引用(目前只是用来更新status)
  dispatch(newMessagesActions.upsertBlockReference({ messageId, blockId: blockUpdate.id, status: blockUpdate.status }))
}

// 节流保存消息和块于数据库
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

// --- Helper Function for Multi-Model Dispatch ---
// 多模型创建和发送请求的逻辑，用于用户消息多模型发送和重发
const dispatchMultiModelResponses = async (
  dispatch: AppDispatch,
  getState: () => RootState,
  topicId: string,
  triggeringMessage: Message, // userMessage or messageToResend
  assistant: Assistant,
  mentionedModels: Model[]
) => {
  console.log(
    `[DEBUG] dispatchMultiModelResponses called for ${mentionedModels.length} models, triggered by message ${triggeringMessage.id}.`
  )
  // Prepare arrays to hold stubs and task data
  const assistantMessageStubs: Message[] = []
  const tasksToQueue: { assistantConfig: Assistant; messageStub: Message }[] = []

  for (const mentionedModel of mentionedModels) {
    const assistantForThisMention = { ...assistant, model: mentionedModel }

    // Create the initial Assistant Message stub for this model
    console.log(`[DEBUG] Creating assistant message stub for model: ${mentionedModel.id}`)
    const assistantMessage = createAssistantMessage(assistant.id, topicId, {
      askId: triggeringMessage.id, // Use the triggering message ID
      model: mentionedModel,
      modelId: mentionedModel.id
    })

    // Add stub to Redux store (sync)
    console.log('[DEBUG] Adding assistant message stub to store')
    dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }))

    // Collect the stub itself for DB update later
    assistantMessageStubs.push(assistantMessage)

    // Collect task data for queueing later
    tasksToQueue.push({ assistantConfig: assistantForThisMention, messageStub: assistantMessage })
  }

  // After the loop: Update the Topic in DB once with all stubs
  console.log('[DEBUG] Updating topic in DB with all assistant message stubs...')
  const topicFromDB = await db.topics.get(topicId)
  if (topicFromDB) {
    const updatedMessages = [...topicFromDB.messages, ...assistantMessageStubs]
    await db.topics.update(topicId, { messages: updatedMessages })
    console.log('[DEBUG] Topic updated in DB successfully.')
  } else {
    console.error(`[dispatchMultiModelResponses] Topic ${topicId} not found in DB during multi-model save.`)
    throw new Error(`Topic ${topicId} not found in DB.`)
  }

  // Now, queue all the processing tasks
  console.log('[DEBUG] Queueing all processing tasks...')
  const queue = getTopicQueue(topicId)
  for (const task of tasksToQueue) {
    queue.add(async () => {
      await fetchAndProcessAssistantResponseImpl(
        dispatch,
        getState,
        topicId,
        task.assistantConfig, // Use the specific assistant config
        task.messageStub // Pass the specific assistant message stub
      )
    })
  }
}

// --- End Helper Function ---

// Internal function extracted from sendMessage to handle fetching and processing assistant response
const fetchAndProcessAssistantResponseImpl = async (
  dispatch: AppDispatch,
  getState: () => RootState,
  topicId: string,
  assistant: Assistant,
  assistantMessage: Message // Pass the prepared assistant message (new or reset)
) => {
  console.log('[DEBUG] fetchAndProcessAssistantResponseImpl started for existing message:', assistantMessage.id)
  const assistantMsgId = assistantMessage.id // Use the passed message ID
  let callbacks: StreamProcessorCallbacks = {}
  try {
    // REMOVED: Assistant message creation, adding to store, and initial DB save are now handled upstream.
    // assistantMessage = createAssistantMessage(assistant.id, passedTopicId, {
    //   askId: userMessage.id,
    //   model: assistant.model
    // })
    // const assistantMsgId = assistantMessage.id
    // dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }))
    // await saveMessageAndBlocksToDB(assistantMessage, [])

    // Set topic loading state (can remain here or move upstream, keeping here is fine)
    console.log('[DEBUG] Setting topic loading state')
    dispatch(newMessagesActions.setTopicLoading({ topicId, loading: true }))

    let accumulatedContent = ''
    let accumulatedThinking = ''
    // Track the last block added to handle interleaving
    let lastBlockId: string | null = null
    let lastBlockType: MessageBlockType | null = null
    // 用于存储tool call id 和 block id 的映射
    // mcp-tools中使用promise.all并发调用mcp,所以onToolCallComplete可能是乱序的
    const toolCallIdToBlockIdMap = new Map<string, string>()

    // --- Context Message Filtering --- START
    // --- Helper Function --- START
    // Helper to manage state transitions when switching block types
    const handleBlockTransition = (newBlock: MessageBlock, newBlockType: MessageBlockType) => {
      // 1. Update trackers to the new block
      lastBlockId = newBlock.id
      lastBlockType = newBlockType

      // 2. Reset text accumulator (if transitioning away from text)
      if (newBlockType !== MessageBlockType.MAIN_TEXT) {
        accumulatedContent = '' // Reset if moving away from text accumulation
      }

      // 3. Add/Update the new block in store and DB (via messageAndBlockUpdate)
      console.log(`[Transition] Adding/Updating new ${newBlockType} block ${newBlock.id}.`)
      messageAndBlockUpdate(topicId, assistantMsgId, newBlock) // Centralized call
    }
    // --- Helper Function --- END

    const allMessagesForTopic = getState().messages.messagesByTopic[topicId] || []
    let messagesForContext: Message[] = []

    // 1. Get the ID of the user message that triggered this assistant response
    const userMessageId = assistantMessage.askId
    // 2. Find the index of the triggering user message
    const userMessageIndex = allMessagesForTopic.findIndex((m) => m.id === userMessageId)

    if (userMessageIndex === -1) {
      // --- Fallback if triggering user message not found (should not happen) ---
      console.error(
        `[fetchAndProcessAssistantResponseImpl] Triggering user message ${userMessageId} (askId of ${assistantMsgId}) not found in topic ${topicId}. Cannot determine context accurately. Falling back.`
      )
      const assistantMessageIndexFallback = allMessagesForTopic.findIndex((m) => m.id === assistantMsgId)
      messagesForContext = (
        assistantMessageIndexFallback !== -1
          ? allMessagesForTopic.slice(0, assistantMessageIndexFallback)
          : allMessagesForTopic
      ).filter((m) => !m.status?.includes('ing'))
      // --- End Fallback ---
    } else {
      // 3. Slice messages up to and including the triggering user message
      const contextSlice = allMessagesForTopic.slice(0, userMessageIndex + 1)
      console.log(
        `[DEBUG] Context sliced up to user message ${userMessageId} (index ${userMessageIndex}). Contains ${contextSlice.length} messages initially.`
      )

      // 4. Apply status filtering to the sliced context
      // 过滤到正在处理的消息，主要应对的是多个模型新发/重发
      messagesForContext = contextSlice.filter((m) => {
        const isNotIng = !m.status?.includes('ing')
        // Optional: Log filtered out messages
        // if (!isNotIng) {
        //     console.log(`[DEBUG] Filtering out message ${m.id} due to status ${m.status}`);
        // }
        return isNotIng
      })
      console.log(
        `[DEBUG] Context after filtering 'ing' statuses for message ${assistantMsgId}: ${messagesForContext.length} messages.`
      )
    }
    // TODO: Apply further filtering based on assistant settings (maxContextMessages, etc.) if needed
    // --- Context Message Filtering --- END

    callbacks = {
      // FIXME: 哪怕返回其他模态，应该也是文字流在前？
      // onLLMResponseCreated: () => {
      //   const newBlock = createMainTextBlock(assistantMsgId, accumulatedContent, {
      //     status: MessageBlockStatus.PROCESSING //主要为等待流提供spinner
      //   })
      //   handleBlockTransition(newBlock, MessageBlockType.MAIN_TEXT)
      // },
      onTextChunk: (text) => {
        accumulatedContent += text
        if (lastBlockType === MessageBlockType.MAIN_TEXT && lastBlockId) {
          // Keep updating the existing block, ensuring status stays STREAMING
          throttledBlockUpdate(lastBlockId, {
            content: accumulatedContent,
            status: MessageBlockStatus.STREAMING // Explicitly keep it streaming
          })
        } else {
          const newBlock = createMainTextBlock(assistantMsgId, accumulatedContent, {
            status: MessageBlockStatus.PROCESSING //主要为等待流提供spinner
          })
          handleBlockTransition(newBlock, MessageBlockType.MAIN_TEXT)
        }
        throttledDbUpdate(assistantMsgId, topicId, getState)
      },
      onThinkingChunk: (text, thinking_millsec) => {
        accumulatedThinking += text
        // Check if the last block was already a thinking block
        if (lastBlockType === MessageBlockType.THINKING && lastBlockId) {
          // Update the existing thinking block
          throttledBlockUpdate(lastBlockId, {
            content: accumulatedThinking,
            status: MessageBlockStatus.STREAMING,
            thinking_millsec: thinking_millsec
          })
        } else {
          const newBlock = createThinkingBlock(assistantMsgId, accumulatedThinking, {
            status: MessageBlockStatus.STREAMING,
            thinking_millsec: thinking_millsec
          })
          handleBlockTransition(newBlock, MessageBlockType.THINKING)
        }
      },
      onTextComplete: (finalText) => {
        // Check if the last block was indeed a text block
        if (lastBlockType === MessageBlockType.MAIN_TEXT && lastBlockId) {
          console.log(`[onTextComplete] Marking MAIN_TEXT block ${lastBlockId} as SUCCESS.`)
          // Mark the block as success and update with the final text
          dispatch(
            updateOneBlock({
              id: lastBlockId,
              changes: {
                content: finalText, // Use the complete text from the chunk
                status: MessageBlockStatus.SUCCESS
              }
            })
          )
          throttledDbUpdate(assistantMsgId, topicId, getState) // Save the completed text block state

          // THEN, check for OpenRouter web search citation logic
          if (assistant.enableWebSearch && assistant.model?.provider === 'openrouter') {
            console.log('[onTextComplete] Processing OpenRouter web search citations.')
            const extractedUrls = extractUrlsFromMarkdown(finalText) // Use finalText here
            if (extractedUrls.length > 0) {
              const citationBlock = createCitationBlock(
                assistantMsgId,
                {
                  response: {
                    source: WebSearchSource.OPENROUTER,
                    results: extractedUrls
                  }
                },
                {
                  status: MessageBlockStatus.SUCCESS // Citation block is immediately complete
                }
              )
              // Use handleBlockTransition to add the new citation block and update state
              handleBlockTransition(citationBlock, MessageBlockType.CITATION)
              // Ensure the new citation block is also saved
              throttledDbUpdate(assistantMsgId, topicId, getState)
            } else {
              console.log('[onTextComplete] No URLs found for OpenRouter citation.')
            }
          }
        } else {
          console.warn(
            `[onTextComplete] Received text.complete but last block was not MAIN_TEXT (was ${lastBlockType}) or lastBlockId is null.`
          )
          // Handle the case where OpenRouter citation might still be relevant even if the last block wasn't text? Unlikely but consider.
        }
      },
      onToolCallInProgress: (toolResponse: MCPToolResponse) => {
        if (toolResponse.status === 'invoking') {
          // Status: Invoking - Create the block
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
        } else {
          console.warn(
            `[onToolCallInProgress] Received unhandled tool status: ${toolResponse.status} for ID: ${toolResponse.id}`
          )
        }
      },
      onToolCallComplete: (toolResponse: MCPToolResponse) => {
        console.log('toolResponse', toolResponse, toolResponse.status)

        const existingBlockId = toolCallIdToBlockIdMap.get(toolResponse.id)

        if (toolResponse.status === 'done' || toolResponse.status === 'error') {
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
      onExternalToolInProgress: () => {
        console.log('onExternalToolInProgress received, creating placeholder CitationBlock.')
        const citationBlock = createCitationBlock(
          assistantMsgId,
          {},
          {
            status: MessageBlockStatus.PROCESSING
          }
        )
        // lastBlockId = citationBlock.id
        handleBlockTransition(citationBlock, MessageBlockType.CITATION)
        throttledDbUpdate(assistantMsgId, topicId, getState)
      },
      onExternalToolComplete: (externalToolResult: ExternalToolResult) => {
        console.warn('onExternalToolComplete received, creating placeholder WebSearchBlock.', externalToolResult)
        const changes: Partial<CitationMessageBlock> = {
          response: externalToolResult.webSearch,
          knowledge: externalToolResult.knowledge,
          status: MessageBlockStatus.SUCCESS
        }
        if (lastBlockId) {
          dispatch(updateOneBlock({ id: lastBlockId, changes }))
          throttledDbUpdate(assistantMsgId, topicId, getState)
        }
      },
      onLLMWebSearchComplete(llmWebSearchResult) {
        const citationBlock = createCitationBlock(
          assistantMsgId,
          {
            response: llmWebSearchResult
          },
          { status: MessageBlockStatus.SUCCESS }
        )
        handleBlockTransition(citationBlock, MessageBlockType.CITATION)
        throttledDbUpdate(assistantMsgId, topicId, getState)
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
      onError: (error) => {
        // console.error('Stream processing error:', error)
        // 所有错误都收束到这
        // Create a serializable error object
        const serializableError = {
          name: error.name,
          message: error.message || 'Stream processing error', // Keep specific message for this context
          originalMessage: error.message, // Store original message separately
          stack: error.stack // Include stack trace if available
          // Add any other relevant serializable properties from the error if needed
        }
        const errorBlock = createErrorBlock(assistantMsgId, serializableError) // Pass the serializable object
        // Use immediate update for error block
        // messageAndBlockUpdate(topicId, assistantMsgId, errorBlock)
        handleBlockTransition(errorBlock, MessageBlockType.ERROR)

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
      onComplete: async (status: AssistantMessageStatus, response?: Response) => {
        // --- Handle Abort Error Specifically ---
        // if (status === 'error' && isAbortError(finalError)) {
        //   console.log(`[onComplete] Stream aborted for message ${assistantMsgId}. Setting status to paused.`)
        //   // Update message status to 'paused'
        //   dispatch(
        //     newMessagesActions.updateMessage({
        //       topicId,
        //       messageId: assistantMsgId,
        //       updates: { status: AssistantMessageStatus.PAUSED }
        //     })
        //   )
        //   // Ensure paused state is saved to DB
        //   throttledDbUpdate(assistantMsgId, topicId, getState)
        //   return
        // }

        // Non-abort error logging is handled by onError or the error source directly.

        // Get the latest state AFTER all chunks/updates have been processed
        const finalState = getState()
        const finalAssistantMsg = finalState.messages.messagesByTopic[topicId]?.find((m) => m.id === assistantMsgId)

        // --- Create Error Block if needed for non-abort errors reported via onComplete --- START
        // if (status === 'error' && finalError) {
        //   // 有错误就创建错误块
        //   const serializableError = {
        //     name: finalError.name || 'Error',
        //     message: finalError.message || 'Stream completed with an unspecified error',
        //     stack: finalError.stack
        //   }
        //   const errorBlock = createErrorBlock(assistantMsgId, serializableError)
        //   // Use immediate update
        //   messageAndBlockUpdate(topicId, assistantMsgId, errorBlock)
        // }
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

          // const citationBlocks = finalAssistantMsg.blocks
          //   .map((block) => finalState.messageBlocks.entities[block])
          //   .filter((block) => block.type === MessageBlockType.CITATION)
          //   .map((block) => ({
          //     ...block,
          //     status: MessageBlockStatus.SUCCESS
          //   }))
          // dispatch(upsertManyBlocks(citationBlocks))
        }
        // --- End of final block status update on SUCCESS --- END

        // --- Update final message status ---
        const messageUpdates: Partial<Message> = { status, metrics: response?.metrics, usage: response?.usage }

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

    console.log('[DEBUG] Creating stream processor')
    const streamProcessorCallbacks = createStreamProcessor(callbacks)

    console.log('[DEBUG] Calling fetchChatCompletion')
    await fetchChatCompletion({
      messages: messagesForContext,
      assistant: assistant,
      onChunkReceived: streamProcessorCallbacks
    })
    console.log('[DEBUG] fetchChatCompletion completed')
  } catch (error: any) {
    console.error('Error fetching chat completion:', error)
    if (assistantMessage) {
      callbacks.onError?.(error)
      // 抛出错误
      throw error
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
    console.log('[DEBUG] sendMessage thunk started')
    try {
      if (userMessage.blocks.length === 0) {
        console.warn('sendMessage: No blocks in the provided message.')
        return
      }
      console.log('sendMessage', userMessage)
      // 更新store和DB (User Message)
      console.log('[DEBUG] Updating store with user message')
      dispatch(newMessagesActions.addMessage({ topicId, message: userMessage }))
      if (userMessageBlocks.length > 0) {
        console.log('[DEBUG] Updating store with message blocks')
        dispatch(upsertManyBlocks(userMessageBlocks))
      }
      console.log('[DEBUG] Saving user message and blocks to DB')
      await saveMessageAndBlocksToDB(userMessage, userMessageBlocks)
      console.log('[DEBUG] Saved user message to DB successfully')

      // --- 2. Prepare Context (Do this once) ---
      // const currentState = getState()
      // const allMessages = currentState.messages.messagesByTopic[topicId] || []
      // const userMessageIndex = allMessages.findIndex((m) => m.id === userMessage.id)
      // Context includes messages up to (and including) the user message itself
      // const contextMessages = userMessageIndex !== -1 ? allMessages.slice(0, userMessageIndex + 1) : [...allMessages] // Safety fallback
      console.log('[DEBUG] Context messages prepared')

      // --- 3. Handle Assistant Response(s) ---
      const mentionedModels = userMessage.mentions
      const queue = getTopicQueue(topicId) // Get queue once

      if (mentionedModels && mentionedModels.length > 0) {
        // --- Multi-Model Scenario ---
        console.log(`[DEBUG] Multi-model send detected for ${mentionedModels.length} models.`)
        await dispatchMultiModelResponses(dispatch, getState, topicId, userMessage, assistant, mentionedModels)
      } else {
        // --- Single-Model Scenario (Original Logic) ---
        console.log('[DEBUG] Single-model send.')
        // Create, add, and save the initial Assistant Message stub
        console.log('[DEBUG] Creating assistant message stub')
        const assistantMessage = createAssistantMessage(assistant.id, topicId, {
          askId: userMessage.id,
          model: assistant.model // Use the primary assistant's model
        })
        console.log('[DEBUG] Adding assistant message stub to store')
        dispatch(newMessagesActions.addMessage({ topicId, message: assistantMessage }))
        console.log('[DEBUG] Saving assistant message stub to DB')
        await saveMessageAndBlocksToDB(assistantMessage, []) // Save stub

        // Queue the processing task
        console.log('[DEBUG] Adding task to queue')
        queue.add(async () => {
          console.log('[DEBUG] Queue task started')
          await fetchAndProcessAssistantResponseImpl(
            dispatch,
            getState,
            topicId,
            assistant, // Use the primary assistant config
            assistantMessage // Pass the created assistant message stub
          )
          console.log('[DEBUG] fetchAndProcessAssistantResponseImpl completed')
        })
      }
    } catch (error) {
      console.error('Error in sendMessage thunk:', error)
    } finally {
      handleChangeLoadingOfTopic(topicId)
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
 * Thunk to resend a user message by regenerating its associated assistant responses.
 * Finds all assistant messages responding to the given user message, resets them,
 * and queues them for regeneration without deleting other messages.
 */
export const resendMessageThunk =
  (topicId: Topic['id'], userMessageToResend: Message, assistant: Assistant) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    console.log(
      `[resendMessageThunk] Regenerating responses for user message ${userMessageToResend.id} in topic ${topicId}`
    )
    try {
      const state = getState()
      const allMessages = state.messages.messagesByTopic[topicId] || []

      // 1. 找到所有助手消息
      const assistantMessagesToReset = allMessages.filter(
        (m) => m.askId === userMessageToResend.id && m.role === 'assistant'
      )

      if (assistantMessagesToReset.length === 0) {
        console.warn(
          `[resendMessageThunk] No assistant responses found for user message ${userMessageToResend.id}. Nothing to regenerate.`
        )
        return
      }

      console.log(
        `[resendMessageThunk] Found ${assistantMessagesToReset.length} assistant messages to reset and regenerate.`
      )

      // 2. Prepare data for updates
      const resetDataList: { resetMsg: Message }[] = []
      const allBlockIdsToDelete: string[] = []
      const messagesToUpdateInRedux: { topicId: string; messageId: string; updates: Partial<Message> }[] = []

      for (const originalMsg of assistantMessagesToReset) {
        const blockIdsToDelete = [...originalMsg.blocks]
        const resetMsg = resetAssistantMessage(originalMsg, {
          status: AssistantMessageStatus.PENDING // Start regeneration in PENDING state
          // Keep the original model information if available
        })

        resetDataList.push({ resetMsg })
        allBlockIdsToDelete.push(...blockIdsToDelete)
        messagesToUpdateInRedux.push({ topicId, messageId: resetMsg.id, updates: resetMsg })
      }

      // 3. 更新redux
      console.log('[resendMessageThunk] Updating Redux state...')
      messagesToUpdateInRedux.forEach((update) => dispatch(newMessagesActions.updateMessage(update)))
      if (allBlockIdsToDelete.length > 0) {
        dispatch(removeManyBlocks(allBlockIdsToDelete))
        console.log(`[resendMessageThunk] Removed ${allBlockIdsToDelete.length} old blocks from Redux.`)
      }

      // 4. 更新数据库
      console.log('[resendMessageThunk] Updating Database...')
      try {
        // 先删除旧的blocks
        if (allBlockIdsToDelete.length > 0) {
          await db.message_blocks.bulkDelete(allBlockIdsToDelete)
          console.log(`[resendMessageThunk] Removed ${allBlockIdsToDelete.length} old blocks from DB.`)
        }

        // 获取最新的messages数组
        const finalMessagesFromState = getState().messages.messagesByTopic[topicId] || []

        // 更新数据库中的topic
        await db.topics.update(topicId, { messages: finalMessagesFromState })
        console.log(`[resendMessageThunk] Updated DB topic ${topicId} with latest messages from Redux state.`)
      } catch (dbError) {
        console.error('[resendMessageThunk] Error updating database:', dbError)
        // TODO: Consider state rollback? For now, log the error.
        // throw dbError //
      }

      // 5. 队列生成任务
      console.log('[resendMessageThunk] Queueing regeneration tasks...')
      const queue = getTopicQueue(topicId)
      for (const { resetMsg } of resetDataList) {
        // 确定用于此特定生成的助手配置
        // 如果重置消息保留了其模型，则使用该模型。否则，使用默认助手。
        const assistantConfigForThisRegen = {
          ...assistant,
          ...(resetMsg.model ? { model: resetMsg.model } : {}) // Use the specific model from the message if available
        }

        console.log(
          `[resendMessageThunk] Queueing task for message ${resetMsg.id} with model ${assistantConfigForThisRegen.model?.id}`
        )
        queue.add(async () => {
          await fetchAndProcessAssistantResponseImpl(
            dispatch,
            getState,
            topicId,
            assistantConfigForThisRegen, // Use potentially specific assistant config
            resetMsg // Pass the reset assistant message stub
          )
        })
      }
      console.log(`[resendMessageThunk] Successfully queued ${resetDataList.length} regeneration tasks.`)
    } catch (error) {
      console.error(`[resendMessageThunk] Error resending user message ${userMessageToResend.id}:`, error)
    } finally {
      handleChangeLoadingOfTopic(topicId)
    }
  }

/**
 * Thunk to resend a user message after its content has been edited.
 * Updates the user message's text block and then triggers the regeneration
 * of its associated assistant responses using resendMessageThunk.
 */
export const resendUserMessageWithEditThunk =
  (
    topicId: Topic['id'],
    originalMessage: Message,
    mainTextBlockId: string,
    editedContent: string,
    assistant: Assistant
  ) =>
  async (dispatch: AppDispatch) => {
    console.log(
      `[resendUserMessageWithEditThunk] Updating block ${mainTextBlockId} for message ${originalMessage.id} and triggering regeneration.`
    )
    try {
      // 1. Define changes for the edited block
      const blockChanges = {
        content: editedContent,
        updatedAt: new Date().toISOString()
      }

      // 2. Update the edited text block in Redux and DB
      console.log('[resendUserMessageWithEditThunk] Updating edited block...')
      dispatch(updateOneBlock({ id: mainTextBlockId, changes: blockChanges }))
      await db.message_blocks.update(mainTextBlockId, blockChanges)
      console.log('[resendUserMessageWithEditThunk] Edited block updated successfully.')

      // 3. Trigger the regeneration logic using resendMessageThunk
      // Pass the original message as its ID is the key (askId) for assistant responses
      console.log('[resendUserMessageWithEditThunk] Dispatching resendMessageThunk to regenerate responses...')
      // No need to await dispatch here, as resendMessageThunk handles its own async logic and finally block
      dispatch(resendMessageThunk(topicId, originalMessage, assistant))
      console.log('[resendUserMessageWithEditThunk] Regeneration process initiated by resendMessageThunk dispatch.')
    } finally {
      handleChangeLoadingOfTopic(topicId)
    }
  }

// --- NEW Thunk for regenerating Assistant Response ---
export const regenerateAssistantResponseThunk =
  (topic: Topic, assistantMessageToRegenerate: Message, assistant: Assistant) =>
  async (dispatch: AppDispatch, getState: () => RootState) => {
    console.log(
      `[regenerateAssistantResponseThunk] Regenerating response for assistant message ${assistantMessageToRegenerate.id} in topic ${topic.id}`
    )
    const topicId = topic.id
    try {
      const state = getState()
      const allMessages = state.messages.messagesByTopic[topicId] || []

      // 1. Find the original user query that this assistant message was responding to
      const originalUserQuery = allMessages.find((m) => m.id === assistantMessageToRegenerate.askId)
      if (!originalUserQuery) {
        console.error(
          `[regenerateAssistantResponseThunk] Original user query (askId: ${assistantMessageToRegenerate.askId}) not found for assistant message ${assistantMessageToRegenerate.id}. Cannot regenerate.`
        )
        return
      }

      // 2. Find the index of the assistant message to reset
      const assistantMessageIndex = allMessages.findIndex((m) => m.id === assistantMessageToRegenerate.id)
      if (assistantMessageIndex === -1) {
        console.error(
          `[regenerateAssistantResponseThunk] Assistant message ${assistantMessageToRegenerate.id} not found in topic ${topicId}.`
        )
        return
      }

      // 3. Get the actual message object to reset
      const messageToReset = allMessages[assistantMessageIndex]

      // 4. Get Block IDs to delete BEFORE resetting the message
      const blockIdsToDelete = [...messageToReset.blocks]

      // 5. Reset the assistant message using the utility function
      const resetAssistantMsg = resetAssistantMessage(messageToReset, {
        status: AssistantMessageStatus.PENDING // Or PROCESSING
      })

      // 6. Update the message in Redux state
      dispatch(
        newMessagesActions.updateMessage({
          topicId,
          messageId: resetAssistantMsg.id,
          updates: resetAssistantMsg
        })
      )

      // 7. Remove the old blocks from Redux state
      if (blockIdsToDelete.length > 0) {
        console.log(`[regenerateAssistantResponseThunk] Removing ${blockIdsToDelete.length} old blocks.`)
        dispatch(removeManyBlocks(blockIdsToDelete))
      }

      // 8. Update DB
      const dbTopic = await db.topics.get(topicId)
      if (dbTopic && dbTopic.messages) {
        const messageIndexInDB = dbTopic.messages.findIndex((m) => m.id === resetAssistantMsg.id)
        if (messageIndexInDB !== -1) {
          const updatedMessages = [...dbTopic.messages]
          updatedMessages[messageIndexInDB] = resetAssistantMsg // Replace with reset message
          await db.topics.update(topicId, { messages: updatedMessages })
        } else {
          console.error(
            `[regenerateAssistantResponseThunk] Assistant message ${resetAssistantMsg.id} not found in DB topic messages.`
          )
        }
        // Delete the old blocks from DB regardless of whether the message was found in topic (safety measure)
        if (blockIdsToDelete.length > 0) {
          await db.message_blocks.bulkDelete(blockIdsToDelete)
        }
      } else if (blockIdsToDelete.length > 0) {
        // Fallback: If topic not found, still try to delete blocks from the blocks table
        console.warn(
          `[regenerateAssistantResponseThunk] Topic ${topicId} not found in DB, attempting to delete blocks directly.`
        )
        await db.message_blocks.bulkDelete(blockIdsToDelete)
      }

      // 9. Prepare context: Messages up to and including the original user query
      // const currentMessages = getState().messages.messagesByTopic[topicId] || [] // Get updated list AFTER the reset
      // const userQueryIndex = currentMessages.findIndex((m) => m.id === originalUserQuery.id)
      // if (userQueryIndex === -1) {
      //   console.error(
      //     `[regenerateAssistantResponseThunk] Original user query ${originalUserQuery.id} disappeared after reset? Aborting.`
      //   )
      //   return
      // }
      // const contextMessages = currentMessages.slice(0, userQueryIndex + 1)

      // 10. Add fetch/process call to the queue for this topic
      const queue = getTopicQueue(topicId)
      queue.add(async () => {
        await fetchAndProcessAssistantResponseImpl(dispatch, getState, topicId, assistant, resetAssistantMsg)
      })
    } catch (error) {
      console.error(
        `[regenerateAssistantResponseThunk] Error regenerating response for assistant message ${assistantMessageToRegenerate.id}:`,
        error
      )
      // Ensure loading state is potentially reset if error happens before fetch starts
      dispatch(newMessagesActions.setTopicLoading({ topicId, loading: false }))
    }
  }
