import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { Topic } from '@renderer/types'
// Separate type-only imports from value imports
import type {
  Message, // Assuming this is the updated Message type
  MessagesState as NewMessagesState
} from '@renderer/types/newMessageTypes'
import {
  MessageBlockStatus // Import as value
} from '@renderer/types/newMessageTypes'

interface MessagesState extends Omit<NewMessagesState, 'streamBlocksByMessage'> {
  // Ensure Message type used here reflects the LATEST definition (blocks: string[])
  messagesByTopic: Record<string, Message[]>
}

const initialState: MessagesState = {
  messagesByTopic: {},
  currentTopic: null,
  loadingByTopic: {},
  displayCount: 20,
  error: null
}

// Payload now only needs info relevant to adding the ID and updating status
interface UpsertBlockReferencePayload {
  messageId: string
  blockId: string // The ID to potentially add
  status?: MessageBlockStatus // Status of the block to update message status
}

const messagesSlice = createSlice({
  name: 'newMessage',
  initialState,
  reducers: {
    setCurrentTopic(state, action: PayloadAction<Topic | null>) {
      state.currentTopic = action.payload
      if (action.payload && !(action.payload.id in state.messagesByTopic)) {
        state.messagesByTopic[action.payload.id] = []
        state.loadingByTopic[action.payload.id] = false
      }
      state.error = null
    },
    setLoading(state, action: PayloadAction<{ topicId: string; isLoading: boolean }>) {
      state.loadingByTopic[action.payload.topicId] = action.payload.isLoading
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload
    },
    setDisplayCount(state, action: PayloadAction<number>) {
      state.displayCount = action.payload
    },
    addMessage(state, action: PayloadAction<{ topicId: string; message: Message }>) {
      const { topicId, message } = action.payload
      if (!state.messagesByTopic[topicId]) {
        state.messagesByTopic[topicId] = []
      }
      // Ensure blocks array exists if missing
      if (!message.blocks) {
        message.blocks = []
      }
      state.messagesByTopic[topicId].push(message)
    },
    updateMessage(state, action: PayloadAction<{ topicId: string; messageId: string; updates: Partial<Message> }>) {
      const { topicId, messageId, updates } = action.payload
      const topicMessages = state.messagesByTopic[topicId]
      if (topicMessages) {
        const messageIndex = topicMessages.findIndex((msg) => msg.id === messageId)
        if (messageIndex !== -1) {
          const messageToUpdate = topicMessages[messageIndex]
          // Ensure incoming blocks update is string[] if present
          if (updates.blocks) {
            updates.blocks = updates.blocks.map(String)
          }
          Object.assign(messageToUpdate, updates)
          // Removed updatedAt assignment
        }
      }
    },
    clearTopicMessages(state, action: PayloadAction<string>) {
      const topicId = action.payload
      if (state.messagesByTopic[topicId]) {
        state.messagesByTopic[topicId] = []
      }
      state.loadingByTopic[topicId] = false
      state.error = null
    },
    upsertBlockReference(state, action: PayloadAction<UpsertBlockReferencePayload>) {
      const { messageId, blockId, status } = action.payload

      let targetTopicId: string | null = null
      for (const topicId in state.messagesByTopic) {
        if (state.messagesByTopic[topicId].some((msg) => msg.id === messageId)) {
          targetTopicId = topicId
          break
        }
      }

      if (!targetTopicId) {
        console.error(`[upsertBlockReference] Message ${messageId} not found in any topic.`)
        return
      }

      const messageIndex = state.messagesByTopic[targetTopicId].findIndex((msg) => msg.id === messageId)
      if (messageIndex === -1) {
        console.error(`[upsertBlockReference] Message ${messageId} not found in topic ${targetTopicId}.`)
        return
      }

      const message = state.messagesByTopic[targetTopicId][messageIndex]

      // --- Update Message Status ---
      // Removed updatedAt assignment
      if (status) {
        if (status === MessageBlockStatus.PROCESSING && message.status === 'sending') {
          message.status = 'processing'
        } else if (status === MessageBlockStatus.ERROR) {
          message.status = 'error'
        }
      }

      // --- Remove Content Update Logic ---
      // REMOVED: Check for isMainText and update message.content

      // --- Add Block ID if it doesn't exist ---
      // Handling blocks as string[]
      if (!message.blocks) {
        message.blocks = []
      }

      // Ensure it's treated as string[] before includes check
      const blockIds = message.blocks.map(String)
      if (!blockIds.includes(blockId)) {
        // Direct mutation (push) - Push the string ID
        message.blocks.push(blockId) // Push string ID
      }
    }
  }
})

export const {
  setCurrentTopic,
  setLoading,
  setError,
  setDisplayCount,
  addMessage,
  updateMessage,
  clearTopicMessages,
  upsertBlockReference
} = messagesSlice.actions

export default messagesSlice.reducer
