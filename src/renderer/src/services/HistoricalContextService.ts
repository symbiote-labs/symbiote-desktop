// src/renderer/src/services/HistoricalContextService.ts
import { TopicManager } from '@renderer/hooks/useTopic'
import { fetchGenerate } from '@renderer/services/ApiService'
import store from '@renderer/store'
import { ShortMemory } from '@renderer/store/memory'
import { Message } from '@renderer/types'

/**
 * 分析当前对话并决定是否需要调用历史对话
 * @param topicId 当前话题ID
 * @param recentMessageCount 要分析的最近消息数量
 * @param returnIdOnly 是否只返回话题ID而不获取完整内容（用于调试）
 * @returns 如果需要历史上下文，返回历史对话内容；否则返回null
 */
export const analyzeAndSelectHistoricalContext = async (
  topicId: string,
  recentMessageCount: number = 8,
  returnIdOnly: boolean = false
): Promise<{ content: string; sourceTopicId: string } | null> => {
  try {
    // 1. 获取设置，检查功能是否启用
    const state = store.getState()
    const isEnabled = state.settings?.enableHistoricalContext ?? false

    if (!isEnabled) {
      // 减少日志输出
      return null
    }

    // 2. 获取最近的消息
    const recentMessages = await getRecentMessages(topicId, recentMessageCount)
    if (!recentMessages || recentMessages.length === 0) {
      // 减少日志输出
      return null
    }

    // 3. 获取所有短期记忆（已分析的对话）
    const shortMemories = state.memory?.shortMemories || []
    if (shortMemories.length === 0) {
      // 减少日志输出
      return null
    }

    // 4. 使用快速模型分析是否需要历史上下文
    const analysisResult = await analyzeNeedForHistoricalContext(recentMessages, shortMemories)
    if (!analysisResult.needsHistoricalContext) {
      // 减少日志输出
      return null
    }

    // 5. 如果需要历史上下文，获取原始对话内容
    if (analysisResult.selectedTopicId) {
      // 如果只需要返回ID，则不获取完整内容（用于调试）
      if (returnIdOnly) {
        return {
          content: `话题ID: ${analysisResult.selectedTopicId}\n原因: ${analysisResult.reason || '相关历史对话'}`,
          sourceTopicId: analysisResult.selectedTopicId
        }
      }

      // 正常情况下，获取完整对话内容
      const dialogContent = await getOriginalDialogContent(analysisResult.selectedTopicId)
      if (dialogContent) {
        return {
          content: dialogContent,
          sourceTopicId: analysisResult.selectedTopicId
        }
      }
    }

    return null
  } catch (error) {
    // 静默处理错误，减少日志输出
    return null
  }
}

/**
 * 获取指定话题的最近消息
 */
const getRecentMessages = async (topicId: string, count: number): Promise<Message[]> => {
  try {
    // 先尝试从Redux store获取
    const state = store.getState()
    let messages: Message[] = []

    if (state.messages?.messagesByTopic && state.messages.messagesByTopic[topicId]) {
      messages = state.messages.messagesByTopic[topicId]
    } else {
      // 如果Redux store中没有，从数据库获取
      const topicMessages = await TopicManager.getTopicMessages(topicId)
      if (topicMessages && topicMessages.length > 0) {
        messages = topicMessages
      }
    }

    // 返回最近的count条消息
    return messages.slice(-count)
  } catch (error) {
    // 静默处理错误，减少日志输出
    return []
  }
}

/**
 * 分析是否需要历史上下文
 */
const analyzeNeedForHistoricalContext = async (
  recentMessages: Message[],
  shortMemories: ShortMemory[]
): Promise<{ needsHistoricalContext: boolean; selectedTopicId?: string; reason?: string }> => {
  try {
    // 准备分析提示词
    const messagesContent = recentMessages
      .map((msg) => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`)
      .join('\n')

    const memoriesContent = shortMemories
      .map((memory) => `话题ID: ${memory.topicId}\n内容: ${memory.content}`)
      .join('\n\n')

    // 从Redux状态中获取自定义提示词
    const customHistoricalPrompt = store.getState().memory?.historicalContextPrompt

    const prompt =
      customHistoricalPrompt ||
      `
你是一个专门分析对话上下文的助手，你的任务是判断当前对话是否需要引用历史对话来提供更完整、更连贯的回答。

最近的对话内容:
${messagesContent}

可用的历史对话摘要:
${memoriesContent}

请仔细分析用户的问题和可用的历史对话摘要。考虑以下因素：

1. 用户当前问题是否与历史对话中的任何主题相关
2. 历史对话中是否包含可能对当前问题有帮助的信息
3. 引用历史对话是否能使回答更全面、更个性化
4. 即使用户没有直接提及历史内容，但如果历史对话中有相关信息，也应考虑引用

请积极地寻找可能的联系，即使联系不是非常明显的。如果有任何可能相关的历史对话，请倾向于引用它。

请回答以下问题:
1. 是否需要引用历史对话来更好地回答用户的问题？(是/否)
2. 如果需要，请指出最相关的历史对话的话题ID。
3. 详细解释为什么需要引用这个历史对话，以及它如何与当前问题相关。

请按以下JSON格式回答，不要添加任何其他文本:
{
  "needsHistoricalContext": true/false,
  "selectedTopicId": "话题ID或null",
  "reason": "详细解释为什么需要或不需要引用历史对话"
}
`

    // 获取分析模型
    const state = store.getState()
    // 优先使用历史对话上下文分析模型，如果没有设置，则使用短期记忆分析模型或长期记忆分析模型
    const analyzeModel =
      state.memory?.historicalContextAnalyzeModel || state.memory?.shortMemoryAnalyzeModel || state.memory?.analyzeModel

    if (!analyzeModel) {
      // 减少日志输出
      return { needsHistoricalContext: false }
    }

    // 调用模型进行分析
    const result = await fetchGenerate({
      prompt,
      content: '',
      modelId: analyzeModel
    })

    if (!result) {
      // 减少日志输出
      return { needsHistoricalContext: false }
    }

    // 解析结果
    try {
      // 尝试直接解析JSON
      const parsedResult = JSON.parse(result)
      return {
        needsHistoricalContext: parsedResult.needsHistoricalContext === true,
        selectedTopicId: parsedResult.selectedTopicId || undefined,
        reason: parsedResult.reason
      }
    } catch (parseError) {
      // 如果直接解析失败，尝试从文本中提取JSON
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const extractedJson = JSON.parse(jsonMatch[0])
          return {
            needsHistoricalContext: extractedJson.needsHistoricalContext === true,
            selectedTopicId: extractedJson.selectedTopicId || undefined,
            reason: extractedJson.reason
          }
        } catch (extractError) {
          // 静默处理错误，减少日志输出
        }
      }

      // 如果都失败了，尝试简单的文本分析
      const needsContext = result.toLowerCase().includes('true') && !result.toLowerCase().includes('false')
      const topicIdMatch = result.match(/selectedTopicId["\s:]+([^"\s,}]+)/)
      const reasonMatch = result.match(/reason["\s:]+"([^"]+)"/) || result.match(/reason["\s:]+([^,}\s]+)/)

      return {
        needsHistoricalContext: needsContext,
        selectedTopicId: topicIdMatch ? topicIdMatch[1] : undefined,
        reason: reasonMatch ? reasonMatch[1] : undefined
      }
    }
  } catch (error) {
    // 静默处理错误，减少日志输出
    return { needsHistoricalContext: false }
  }
}

/**
 * 获取原始对话内容
 */
const getOriginalDialogContent = async (topicId: string): Promise<string | null> => {
  try {
    // 获取话题的原始消息
    const messages = await TopicManager.getTopicMessages(topicId)
    if (!messages || messages.length === 0) {
      // 减少日志输出
      return null
    }

    // 格式化对话内容
    const dialogContent = messages.map((msg) => `${msg.role === 'user' ? '用户' : 'AI'}: ${msg.content}`).join('\n\n')

    return dialogContent
  } catch (error) {
    // 静默处理错误，减少日志输出
    return null
  }
}
