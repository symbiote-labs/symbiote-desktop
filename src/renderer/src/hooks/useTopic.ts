import db from '@renderer/databases'
import i18n from '@renderer/i18n'
import { deleteMessageFiles } from '@renderer/services/MessagesService'
import store from '@renderer/store'
import { updateTopic } from '@renderer/store/assistants'
import { prepareTopicMessages } from '@renderer/store/messages'
import { Assistant, Topic } from '@renderer/types'
import { find, isEmpty } from 'lodash'
import { useEffect, useState } from 'react'

import { useAssistant } from './useAssistant'
import { getStoreSetting } from './useSettings'

const renamingTopics = new Set<string>()

let _activeTopic: Topic
let _setActiveTopic: (topic: Topic) => void

export function useActiveTopic(_assistant: Assistant, topic?: Topic) {
  const { assistant } = useAssistant(_assistant.id)
  const [activeTopic, setActiveTopic] = useState(topic || _activeTopic || assistant?.topics[0])

  _activeTopic = activeTopic
  _setActiveTopic = setActiveTopic

  useEffect(() => {
    if (activeTopic) {
      store.dispatch(prepareTopicMessages(activeTopic))
    }
  }, [activeTopic])

  useEffect(() => {
    // activeTopic not in assistant.topics
    if (assistant && !find(assistant.topics, { id: activeTopic?.id })) {
      setActiveTopic(assistant.topics[0])
    }
  }, [activeTopic?.id, assistant])

  return { activeTopic, setActiveTopic }
}

export function useTopic(assistant: Assistant, topicId?: string) {
  return assistant?.topics.find((topic) => topic.id === topicId)
}

export function getTopic(assistant: Assistant, topicId: string) {
  return assistant?.topics.find((topic) => topic.id === topicId)
}

export async function getTopicById(topicId: string) {
  const assistants = store.getState().assistants.assistants
  const topics = assistants.map((assistant) => assistant.topics).flat()
  const topic = topics.find((topic) => topic.id === topicId)
  const messages = await TopicManager.getTopicMessages(topicId)
  return { ...topic, messages } as Topic
}

// 优化自动重命名功能，减少API调用和性能影响
export const autoRenameTopic = async (assistant: Assistant, topicId: string) => {
  // 如果该主题正在重命名中，直接返回
  if (renamingTopics.has(topicId)) {
    return
  }

  // Declare variables outside the try block to make them accessible in finally
  let enableTopicNaming: boolean | undefined
  let topic: Topic | undefined
  let messages: any[] = [] // Assuming messages is an array, adjust type if needed

  try {
    renamingTopics.add(topicId)

    // 获取主题设置并确保其为布尔值
    enableTopicNaming = getStoreSetting('enableTopicNaming') === true

    // 从当前状态中获取主题，避免数据库访问
    const state = store.getState()
    const topics = state.assistants.assistants.map((a) => a.topics).flat()
    topic = topics.find((t) => t.id === topicId)

    // 如果主题不存在或已手动编辑名称，直接返回
    if (!topic || topic.isNameManuallyEdited) {
      return
    }

    // 获取消息
    messages = state.messages.messagesByTopic[topicId] || []
    if (isEmpty(messages)) {
      return
    }

    // 如果不启用自动命名，使用第一条消息的前50个字符作为主题名称
    if (!enableTopicNaming) {
      const topicName = messages[0]?.content?.substring(0, 50)
      // Ensure topic is defined before using it
      if (topicName && topic) {
        const data = { ...topic, name: topicName }
        // Check if _setActiveTopic exists and is a function before calling
        if (typeof _setActiveTopic === 'function') {
          _setActiveTopic(data)
        }
        store.dispatch(updateTopic({ assistantId: assistant.id, topic: data }))
      }
      return
    }

    // 只有当主题名称是默认名称且消息数量足够时，才调用API生成摘要
    if (topic && topic.name === i18n.t('chat.default.topic.name') && messages.length >= 2) {
      // 延迟加载摘要API，减少切换会话时的卡顿
      setTimeout(async () => {
        try {
          const { fetchMessagesSummary } = await import('@renderer/services/ApiService')
          const summaryText = await fetchMessagesSummary({ messages, assistant })
          // Ensure topic is defined before using it
          if (summaryText && topic) {
            const data = { ...topic, name: summaryText }
            // Check if _setActiveTopic exists and is a function before calling
            if (typeof _setActiveTopic === 'function') {
              _setActiveTopic(data)
            }
            store.dispatch(updateTopic({ assistantId: assistant.id, topic: data }))
          }
        } catch (error) {
          // 静默处理错误，不影响用户体验
        } finally {
          renamingTopics.delete(topicId)
        }
      }, 1000) // 延迟1秒执行，避免切换会话时的卡顿
      return
    }
  } finally {
    // 如果没有进入延迟执行的分支，则在这里清除标记
    if (!enableTopicNaming || topic?.name !== i18n.t('chat.default.topic.name') || messages.length < 2) {
      renamingTopics.delete(topicId)
    }
  }
}

// Convert class to object with functions since class only has static methods
// 只有静态方法,没必要用class，可以export {}
export const TopicManager = {
  async getTopicLimit(limit: number) {
    return await db.topics
      .orderBy('updatedAt') // 按 updatedAt 排序（默认升序）
      .reverse() // 逆序（变成降序）
      .limit(limit) // 取前 10 条
      .toArray()
  },

  async getTopic(id: string) {
    return await db.topics.get(id)
  },

  async getAllTopics() {
    return await db.topics.toArray()
  },

  async getTopicMessages(id: string) {
    const topic = await TopicManager.getTopic(id)
    return topic ? topic.messages : []
  },

  async removeTopic(id: string) {
    const messages = await TopicManager.getTopicMessages(id)

    for (const message of messages) {
      await deleteMessageFiles(message)
    }

    db.topics.delete(id)
  },

  async clearTopicMessages(id: string) {
    const topic = await TopicManager.getTopic(id)

    if (topic) {
      for (const message of topic?.messages ?? []) {
        await deleteMessageFiles(message)
      }

      topic.messages = []

      await db.topics.update(id, topic)
    }
  }
}
