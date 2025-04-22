// src/renderer/src/services/AssistantMemoryService.ts

import { fetchGenerate } from '@renderer/services/ApiService'
import store from '@renderer/store'
import { addAssistantMemory, saveMemoryData } from '@renderer/store/memory'
import { Message } from '@renderer/types'

/**
 * 分析助手对话并提取记忆
 * @param assistantId 助手ID
 * @param messages 消息列表
 * @returns 是否成功添加了新记忆
 */
export const analyzeAndAddAssistantMemories = async (assistantId: string, messages: Message[]): Promise<boolean> => {
  // 获取当前状态
  const state = store.getState()
  const assistantMemoryActive = state.memory?.assistantMemoryActive
  const assistantMemoryAnalyzeModel = state.memory?.assistantMemoryAnalyzeModel
  const filterSensitiveInfo = state.memory?.filterSensitiveInfo ?? true

  // 检查功能是否启用
  if (!assistantMemoryActive || !assistantMemoryAnalyzeModel) {
    console.log('[Assistant Memory Analysis] Assistant memory feature is not active or no model selected')
    return false
  }

  // 获取当前助手的记忆
  const assistantMemories = state.memory?.assistantMemories || []
  const currentAssistantMemories = assistantMemories.filter((memory) => memory.assistantId === assistantId)

  // 获取已分析过的消息ID
  const analyzedMessageIds = new Set<string>()
  currentAssistantMemories.forEach((memory) => {
    if (memory.analyzedMessageIds) {
      memory.analyzedMessageIds.forEach((id) => analyzedMessageIds.add(id))
    }
  })

  // 过滤出未分析的消息
  const newMessages = messages.filter(
    (msg) => msg.id && !analyzedMessageIds.has(msg.id) && msg.content && msg.content.trim() !== ''
  )

  if (newMessages.length === 0) {
    console.log('[Assistant Memory Analysis] No new messages to analyze')
    return false
  }

  console.log(`[Assistant Memory Analysis] Found ${newMessages.length} new messages to analyze.`)

  // 构建新消息的对话内容
  const newConversation = newMessages.map((msg) => `${msg.role || 'user'}: ${msg.content || ''}`).join('\n')

  // 获取已有的助手记忆内容
  const existingMemoriesContent = currentAssistantMemories.map((memory) => memory.content).join('\n')

  try {
    console.log('[Assistant Memory Analysis] Starting analysis...')
    console.log(`[Assistant Memory Analysis] Analyzing assistant: ${assistantId}`)
    console.log('[Assistant Memory Analysis] New conversation length:', newConversation.length)

    // 从Redux状态中获取自定义提示词
    const customAssistantPrompt = store.getState().memory?.assistantMemoryPrompt

    // 构建助手记忆分析提示词
    const prompt =
      customAssistantPrompt ||
      `
请分析以下对话内容，提取对助手需要长期记住的重要信息。这些信息将作为助手的记忆，帮助助手在未来的对话中更好地理解用户和提供个性化服务。

请注意以下几点：
1. 提取的信息应该是对助手提供服务有帮助的，例如用户偏好、习惯、背景信息等
2. 每条记忆应该简洁明了，一句话表达一个完整的信息点
3. 记忆应该是事实性的，不要包含推测或不确定的信息
4. 记忆应该是有用的，能够帮助助手在未来的对话中更好地服务用户
5. 不要重复已有的记忆内容
${filterSensitiveInfo ? '6. 不要提取任何敏感信息，如API密钥、密码、个人身份信息等' : ''}

${existingMemoriesContent ? `已有的助手记忆：\n${existingMemoriesContent}\n\n` : ''}

对话内容:
${newConversation}

请以JSON数组格式返回提取的记忆，每条记忆是一个字符串。例如：
["用户喜欢简洁的回答", "用户对技术话题特别感兴趣", "用户希望得到具体的代码示例"]

如果没有找到值得记忆的新信息，请返回空数组 []。
`

    // 获取模型
    let modelId = assistantMemoryAnalyzeModel
    let providerId = ''

    // 尝试解析JSON格式的模型ID
    if (typeof assistantMemoryAnalyzeModel === 'string') {
      if (assistantMemoryAnalyzeModel.startsWith('{')) {
        try {
          const parsedModel = JSON.parse(assistantMemoryAnalyzeModel)
          modelId = parsedModel.id
          providerId = parsedModel.provider
          console.log(`[Assistant Memory Analysis] Using model ${modelId} from provider ${providerId}`)
        } catch (error) {
          console.error('[Assistant Memory Analysis] Failed to parse model ID:', error)
        }
      } else {
        // 如果不是JSON格式，直接使用字符串作为模型ID
        modelId = assistantMemoryAnalyzeModel
        console.log(`[Assistant Memory Analysis] Using model ID directly: ${modelId}`)
      }
    }

    // 先尝试根据供应商和模型ID查找
    let model: any = null
    if (providerId) {
      const provider = state.llm.providers.find((p) => p.id === providerId)
      if (provider) {
        const foundModel = provider.models.find((m) => m.id === modelId)
        if (foundModel) {
          model = foundModel
        }
      }
    }

    // 如果没找到，尝试在所有模型中查找
    if (!model) {
      const foundModel = state.llm.providers.flatMap((provider) => provider.models).find((m) => m.id === modelId)
      if (foundModel) {
        model = foundModel
      }
    }

    if (!model) {
      console.error(`[Assistant Memory Analysis] Model ${assistantMemoryAnalyzeModel} not found`)
      return false
    }

    // 调用AI生成文本
    console.log('[Assistant Memory Analysis] Calling AI.generateText...')
    const result = await fetchGenerate({
      prompt: prompt,
      content: newConversation,
      modelId: model.id
    })
    console.log('[Assistant Memory Analysis] AI.generateText response received')

    if (!result || typeof result !== 'string' || result.trim() === '') {
      console.log('[Assistant Memory Analysis] No valid result from AI analysis.')
      return false
    }

    // 解析结果
    let memories: string[] = []
    try {
      // 尝试直接解析JSON
      const jsonMatch = result.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        memories = JSON.parse(jsonMatch[0])
      } else {
        // 如果没有找到JSON数组，尝试按行分割并处理
        memories = result
          .split('\n')
          .filter((line) => line.trim().startsWith('"') || line.trim().startsWith('-'))
          .map((line) => line.trim().replace(/^["'\-\s]+|["'\s]+$/g, ''))
      }
    } catch (error) {
      console.error('[Assistant Memory Analysis] Failed to parse memories:', error)
      // 尝试使用正则表达式提取引号中的内容
      const quotedStrings = result.match(/"([^"]*)"/g)
      if (quotedStrings) {
        memories = quotedStrings.map((str) => str.slice(1, -1))
      } else {
        // 最后尝试按行分割
        memories = result
          .split('\n')
          .filter((line) => line.trim() && !line.includes('```'))
          .map((line) => line.trim().replace(/^["'\-\s]+|["'\s]+$/g, ''))
      }
    }

    // 过滤空字符串和已存在的记忆
    memories = memories.filter(
      (memory) =>
        memory &&
        memory.trim() !== '' &&
        !currentAssistantMemories.some((m) => m.content.toLowerCase() === memory.toLowerCase())
    )

    console.log(`[Assistant Memory Analysis] Extracted ${memories.length} new memories`)

    // 添加新记忆
    const addedMemories: string[] = []
    const newMessageIds = newMessages.map((msg) => msg.id).filter(Boolean) as string[]
    const lastMessageId = newMessages.length > 0 ? newMessages[newMessages.length - 1].id : undefined

    for (const memoryContent of memories) {
      // 添加到Redux状态
      store.dispatch(
        addAssistantMemory({
          content: memoryContent,
          assistantId,
          analyzedMessageIds: newMessageIds,
          lastMessageId
        })
      )
      addedMemories.push(memoryContent)
    }

    // 显式触发保存操作，确保数据被持久化，并强制覆盖
    try {
      const state = store.getState().memory
      await store
        .dispatch(
          saveMemoryData({
            assistantMemories: state.assistantMemories,
            assistantMemoryActive: state.assistantMemoryActive,
            assistantMemoryAnalyzeModel: state.assistantMemoryAnalyzeModel,
            forceOverwrite: true // 强制覆盖文件，确保数据正确保存
          })
        )
        .unwrap()
      console.log('[Assistant Memory Analysis] Memory data saved successfully (force overwrite)')
    } catch (error) {
      console.error('[Assistant Memory Analysis] Failed to save memory data:', error)
      // 即使保存失败，我们仍然返回true，因为记忆已经添加到Redux状态中
    }

    return addedMemories.length > 0
  } catch (error) {
    console.error('[Assistant Memory Analysis] Failed to analyze and add assistant memories:', error)
    return false
  }
}

/**
 * 重置助手记忆分析标记
 * @param assistantId 助手ID
 * @returns 是否成功重置
 */
export const resetAssistantMemoryAnalyzedMessageIds = async (assistantId: string): Promise<boolean> => {
  try {
    // 获取当前状态
    const state = store.getState()
    const assistantMemories = state.memory?.assistantMemories || []

    // 获取当前助手的记忆
    const currentAssistantMemories = assistantMemories.filter((memory) => memory.assistantId === assistantId)

    if (currentAssistantMemories.length === 0) {
      console.log(`[Assistant Memory] No memories found for assistant ${assistantId}`)
      return false
    }

    // 创建新的助手记忆数组，清除分析标记
    const updatedMemories = assistantMemories.map((memory) => {
      if (memory.assistantId === assistantId) {
        return {
          ...memory,
          analyzedMessageIds: [],
          lastMessageId: undefined
        }
      }
      return memory
    })

    // 保存更新后的记忆
    await store
      .dispatch(
        saveMemoryData({
          assistantMemories: updatedMemories,
          assistantMemoryActive: state.memory?.assistantMemoryActive,
          assistantMemoryAnalyzeModel: state.memory?.assistantMemoryAnalyzeModel,
          forceOverwrite: true
        })
      )
      .unwrap()

    console.log(`[Assistant Memory] Reset analysis markers for assistant ${assistantId}`)
    return true
  } catch (error) {
    console.error('[Assistant Memory] Failed to reset assistant memory analyzed message IDs:', error)
    return false
  }
}
