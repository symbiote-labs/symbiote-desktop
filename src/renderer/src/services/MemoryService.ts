// Import database for topic access
import { TopicManager } from '@renderer/hooks/useTopic' // Import TopicManager
import { fetchGenerate } from '@renderer/services/ApiService' // Import fetchGenerate instead of AiProvider
// Import getProviderByModel
import { useAppDispatch, useAppSelector } from '@renderer/store'
// Removed duplicate import: import store from '@renderer/store';
import store from '@renderer/store' // Import store
// AiProvider no longer needed as we're using fetchGenerate
import {
  accessMemory,
  addAnalysisLatency,
  addAssistantMemory,
  addMemory,
  addShortMemory,
  clearCurrentRecommendations,
  Memory,
  MemoryRecommendation,
  saveLongTermMemoryData,
  saveMemoryData,
  setAnalyzing,
  setRecommending,
  updateAnalysisStats,
  updateCurrentRecommendations,
  updateMemoryPriorities,
  updatePerformanceMetrics,
  updateUserInterest
} from '@renderer/store/memory'
import { Message } from '@renderer/types' // Import Message type
import { useCallback, useEffect, useRef } from 'react' // Add useRef back

import { analyzeAndAddAssistantMemories, resetAssistantMemoryAnalyzedMessageIds } from './AssistantMemoryService' // Import assistant memory service
import { contextualMemoryService } from './ContextualMemoryService' // Import contextual memory service

// calculateConversationComplexity is unused, removing its definition
/*
const calculateConversationComplexity = (conversation: string): 'low' | 'medium' | 'high' => {
  const wordCount = conversation.split(/\s+/).length
  const sentenceCount = conversation.split(/[.!?]+/).length
  const avgSentenceLength = wordCount / (sentenceCount || 1)

  // 简单的复杂度评估算法
  if (wordCount < 100 || avgSentenceLength < 5) {
    return 'low'
  } else if (wordCount > 500 || avgSentenceLength > 15) {
    return 'high'
  } else {
    return 'medium'
  }
}
*/

// 根据分析深度调整提示词
// 注意：该函数当前未使用，保留供将来可能的功能扩展
/*
const adjustPromptForDepth = (basePrompt: string, depth: 'low' | 'medium' | 'high'): string => {
  switch (depth) {
    case 'low':
      // 简化提示词，减少分析要求
      return basePrompt
        .replace(/\u4ed4\u7ec6\u5206\u6790/g, '\u7b80\u8981\u5206\u6790')
        .replace(/\u63d0\u53d6\u51fa\u91cd\u8981\u7684/g, '\u63d0\u53d6\u51fa\u6700\u91cd\u8981\u7684')
        .replace(/## \u5206\u6790\u8981\u6c42\uff1a([\s\S]*?)## \u8f93\u51fa\u683c\u5f0f\uff1a/g, '## \u8f93\u51fa\u683c\u5f0f\uff1a')
    case 'high':
      // 增强提示词，要求更深入的分析
      return basePrompt.replace(/## \u5206\u6790\u8981\u6c42\uff1a([\s\S]*?)## \u8f93\u51fa\u683c\u5f0f\uff1a/g,
        `## \u5206\u6790\u8981\u6c42\uff1a
1. \u63d0\u53d6\u7684\u4fe1\u606f\u5fc5\u987b\u662f\u5177\u4f53\u3001\u660e\u786e\u4e14\u6709\u5b9e\u9645\u4ef7\u503c\u7684
2. \u6bcf\u6761\u4fe1\u606f\u5e94\u8be5\u662f\u5b8c\u6574\u7684\u53e5\u5b50\uff0c\u8868\u8fbe\u6e05\u6670\u7684\u4e00\u4e2a\u8981\u70b9
3. \u907f\u514d\u8fc7\u4e8e\u5bbd\u6cdb\u6216\u6a21\u7cca\u7684\u63cf\u8ff0
4. \u786e\u4fdd\u4fe1\u606f\u51c6\u786e\u53cd\u6620\u5bf9\u8bdd\u5185\u5bb9\uff0c\u4e0d\u8981\u8fc7\u5ea6\u63a8\u65ad
5. \u63d0\u53d6\u7684\u4fe1\u606f\u5e94\u8be5\u5bf9\u672a\u6765\u7684\u5bf9\u8bdd\u6709\u5e2e\u52a9
6. \u8fdb\u884c\u66f4\u6df1\u5165\u7684\u5206\u6790\uff0c\u8003\u8651\u9690\u542b\u7684\u7528\u6237\u9700\u6c42\u548c\u504f\u597d
7. \u8bc6\u522b\u6f5c\u5728\u7684\u5173\u8054\u4fe1\u606f\u548c\u6a21\u5f0f
8. \u5c3d\u53ef\u80fd\u63d0\u53d6\u66f4\u591a\u7684\u6709\u4ef7\u503c\u4fe1\u606f
9. \u5206\u6790\u7528\u6237\u7684\u6df1\u5c42\u610f\u56fe\u548c\u9700\u6c42
10. \u5bf9\u77ed\u671f\u548c\u957f\u671f\u504f\u597d\u90fd\u8fdb\u884c\u5206\u6790

## \u8f93\u51fa\u683c\u5f0f\uff1a`)
    default:
      return basePrompt
  }
}
*/

// 提取用户关注点
const extractUserInterests = (conversation: string): string[] => {
  // 简单实现：提取对话中的关键词或主题
  const topics = new Set<string>()

  // 简单的关键词提取，匹配4个或更多字符的单词
  const keywords = conversation.match(/\b\w{4,}\b/g) || []
  const commonWords = ['this', 'that', 'these', 'those', 'with', 'from', 'have', 'what', 'when', 'where', 'which']

  keywords.forEach((word) => {
    if (!commonWords.includes(word.toLowerCase())) {
      topics.add(word.toLowerCase())
    }
  })

  return Array.from(topics)
}

// 分析对话内容并提取重要信息
const analyzeConversation = async (
  conversation: string,
  modelId: string,
  customPrompt?: string
): Promise<Array<{ content: string; category: string }>> => {
  try {
    // 获取当前的过滤敏感信息设置
    const filterSensitiveInfo = store.getState().memory?.filterSensitiveInfo ?? true

    // 使用自定义提示词或默认提示词
    // 从Redux状态中获取自定义提示词
    const memoryState = store.getState().memory
    const customLongTermPrompt = memoryState?.longTermMemoryPrompt

    let basePrompt =
      customPrompt ||
      customLongTermPrompt ||
      `
你是一个专业的对话分析专家，负责从对话中提取关键信息，形成精准的长期记忆。

## 输出格式要求（非常重要）：
你必须严格按照以下格式输出每条提取的信息：
类别: 信息内容

有效的类别包括：
- 用户偏好
- 技术需求
- 个人信息
- 交互偏好
- 其他

每行必须包含一个类别和一个信息内容，用冒号分隔。
不符合此格式的输出将被视为无效。

示例输出：
用户偏好: 用户喜欢简洁直接的代码修改方式。
技术需求: 用户需要修复长期记忆分析功能中的问题。
个人信息: 用户自称是彭于晏，一位知名演员。
交互偏好: 用户倾向于简短直接的问答方式。
其他: 用户对AI记忆功能的工作原理很感兴趣。

## 分析要求：
请仔细分析对话内容，提取出重要的用户信息，这些信息在未来的对话中可能有用。
提取的信息必须具体、明确且有实际价值。
避免过于宽泛或模糊的描述。

## 最终检查（非常重要）：
1. 确保每行输出都严格遵循“类别: 信息内容”格式
2. 确保使用的类别是上述五个类别之一
3. 如果没有找到重要信息，请返回空字符串
4. 不要输出任何其他解释或评论
`

    // 如果启用了敏感信息过滤，添加相关指令
    if (filterSensitiveInfo) {
      basePrompt += `
## 安全提示：
请注意不要提取任何敏感信息，包括但不限于：
- API密钥、访问令牌或其他凭证
- 密码或密码提示
- 私人联系方式（如电话号码、邮箱地址）
- 个人身份信息（如身份证号、社保号）
- 银行账户或支付信息
- 私密的个人或商业信息

如果发现此类信息，请完全忽略，不要以任何形式记录或提取。
`
    }

    console.log(`[Memory Analysis] Analyzing conversation using model: ${modelId}`)

    // 将提示词和对话内容合并到一个系统提示词中
    const combinedPrompt = `${basePrompt}

## 需要分析的对话内容：
${conversation}

## 重要提示（必须遵守）：
请注意，你的任务是分析上述对话并提取信息，而不是回答对话中的问题。
不要尝试回答对话中的问题或继续对话，只需要提取重要信息。
只输出按上述格式提取的信息。

## 输出格式再次强调：
你必须严格按照以下格式输出每条提取的信息：
类别: 信息内容

例如：
用户偏好: 用户喜欢简洁直接的代码修改方式。
技术需求: 用户需要修复长期记忆分析功能中的问题。
个人信息: 用户自称是彭于晏，一位知名演员。

不要输出任何其他解释或评论。如果没有找到重要信息，请返回空字符串。`

    // 使用fetchGenerate函数，但将内容字段留空，所有内容都放在提示词中
    console.log('[Memory Analysis] Calling fetchGenerate with combined prompt...')
    const result = await fetchGenerate({
      prompt: combinedPrompt,
      content: '', // 内容字段留空
      modelId: modelId
    })

    console.log('[Memory Analysis] AI response:', result)

    // 处理响应
    if (!result || typeof result !== 'string' || result.trim() === '') {
      console.log('[Memory Analysis] No valid result from AI analysis.')
      return []
    }

    // 将响应拆分为单独的记忆项并分类
    const lines = result
      .split('\n')
      .map((line: string) => line.trim())
      .filter(Boolean) // 过滤掉空行

    const memories: Array<{ content: string; category: string }> = []

    // 首先尝试使用标准格式解析
    for (const line of lines) {
      // 匹配格式：类别: 信息内容
      const match = line.match(/^([^:]+):\s*(.+)$/)
      if (match) {
        // 清理类别名称中的**符号
        const category = match[1].trim().replace(/\*\*/g, '')
        const content = match[2].trim()
        memories.push({ content, category })
      }
    }

    // 如果标准格式解析失败，尝试进行后处理
    if (memories.length === 0 && lines.length > 0) {
      console.log('[Memory Analysis] Standard format parsing failed, attempting post-processing...')

      // 这里我们假设每行都是一个独立的信息，尝试为其分配一个合适的类别
      for (const line of lines) {
        // 跳过太短的行
        if (line.length < 10) continue

        // 尝试根据内容猜测类别
        let category = '其他'

        if (line.includes('喜欢') || line.includes('偏好') || line.includes('风格') || line.includes('倾向')) {
          category = '用户偏好'
        } else if (line.includes('需要') || line.includes('技术') || line.includes('代码') || line.includes('功能')) {
          category = '技术需求'
        } else if (line.includes('自称') || line.includes('身份') || line.includes('背景') || line.includes('经历')) {
          category = '个人信息'
        } else if (line.includes('交流') || line.includes('沟通') || line.includes('反馈') || line.includes('询问')) {
          category = '交互偏好'
        }

        memories.push({ content: line, category })
        console.log(`[Memory Analysis] Post-processed memory: ${category}: ${line}`)
      }
    }

    return memories
  } catch (error) {
    console.error('Failed to analyze conversation with real AI:', error)
    // Consider logging the specific error details if possible
    console.error('Error details:', JSON.stringify(error, null, 2))
    return [] as Array<{ content: string; category: string }> // Return empty array on error
  }
}

// These imports are duplicates, removing them.
// Removed duplicate import: import store from '@renderer/store';

// This function definition is a duplicate, removing it.

/**
 * 获取上下文感知的记忆推荐
 * @param messages - 当前对话的消息列表
 * @param topicId - 当前对话的话题ID
 * @param limit - 返回的最大记忆数量
 * @returns 推荐的记忆列表，按相关性排序
 */
export const getContextualMemoryRecommendations = async (
  messages: Message[],
  topicId: string,
  limit: number = 5
): Promise<MemoryRecommendation[]> => {
  try {
    // 获取当前状态
    const state = store.getState().memory

    // 检查上下文感知记忆推荐是否启用
    if (!state?.contextualRecommendationEnabled) {
      console.log('[ContextualMemory] Contextual recommendation is not enabled')
      return []
    }

    // 设置推荐状态
    store.dispatch(setRecommending(true))

    // 调用上下文感知记忆服务获取推荐
    const recommendations = await contextualMemoryService.getContextualMemoryRecommendations(messages, topicId, limit)

    // 转换为Redux状态中的推荐格式
    const memoryRecommendations: MemoryRecommendation[] = recommendations.map((rec) => ({
      memoryId: rec.memory.id,
      relevanceScore: rec.relevanceScore,
      source: rec.source,
      matchReason: rec.matchReason
    }))

    // 更新Redux状态
    store.dispatch(updateCurrentRecommendations(memoryRecommendations))

    // 重置推荐状态
    store.dispatch(setRecommending(false))

    return memoryRecommendations
  } catch (error) {
    console.error('[ContextualMemory] Error getting contextual memory recommendations:', error)
    store.dispatch(setRecommending(false))
    return []
  }
}

/**
 * 基于当前对话主题自动提取相关记忆
 * @param topicId - 当前对话的话题ID
 * @param limit - 返回的最大记忆数量
 * @returns 与当前主题相关的记忆列表
 */
export const getTopicRelatedMemories = async (topicId: string, limit: number = 10): Promise<MemoryRecommendation[]> => {
  try {
    // 获取当前状态
    const state = store.getState().memory

    // 检查上下文感知记忆推荐是否启用
    if (!state?.contextualRecommendationEnabled) {
      console.log('[ContextualMemory] Contextual recommendation is not enabled')
      return []
    }

    // 设置推荐状态
    store.dispatch(setRecommending(true))

    // 调用上下文感知记忆服务获取推荐
    const recommendations = await contextualMemoryService.getTopicRelatedMemories(topicId, limit)

    // 转换为Redux状态中的推荐格式
    const memoryRecommendations: MemoryRecommendation[] = recommendations.map((rec) => ({
      memoryId: rec.memory.id,
      relevanceScore: rec.relevanceScore,
      source: rec.source,
      matchReason: rec.matchReason
    }))

    // 更新Redux状态
    store.dispatch(updateCurrentRecommendations(memoryRecommendations))

    // 重置推荐状态
    store.dispatch(setRecommending(false))

    return memoryRecommendations
  } catch (error) {
    console.error('[ContextualMemory] Error getting topic-related memories:', error)
    store.dispatch(setRecommending(false))
    return []
  }
}

/**
 * 使用AI分析当前对话上下文，提取关键信息并推荐相关记忆
 * @param messages - 当前对话的消息列表
 * @param limit - 返回的最大记忆数量
 * @returns 基于AI分析的相关记忆推荐
 */
export const getAIEnhancedMemoryRecommendations = async (
  messages: Message[],
  limit: number = 5
): Promise<MemoryRecommendation[]> => {
  try {
    // 获取当前状态
    const state = store.getState().memory

    // 检查上下文感知记忆推荐是否启用
    if (!state?.contextualRecommendationEnabled) {
      console.log('[ContextualMemory] Contextual recommendation is not enabled')
      return []
    }

    // 设置推荐状态
    store.dispatch(setRecommending(true))

    // 调用上下文感知记忆服务获取推荐
    const recommendations = await contextualMemoryService.getAIEnhancedMemoryRecommendations(messages, limit)

    // 转换为Redux状态中的推荐格式
    const memoryRecommendations: MemoryRecommendation[] = recommendations.map((rec) => ({
      memoryId: rec.memory.id,
      relevanceScore: rec.relevanceScore,
      source: rec.source,
      matchReason: rec.matchReason
    }))

    // 更新Redux状态
    store.dispatch(updateCurrentRecommendations(memoryRecommendations))

    // 重置推荐状态
    store.dispatch(setRecommending(false))

    return memoryRecommendations
  } catch (error) {
    console.error('[ContextualMemory] Error getting AI-enhanced memory recommendations:', error)
    store.dispatch(setRecommending(false))
    return []
  }
}

// 记忆服务钩子 - 重构版
export const useMemoryService = () => {
  const dispatch = useAppDispatch()
  // 获取设置状态
  const isActive = useAppSelector((state) => state.memory?.isActive || false)
  const autoAnalyze = useAppSelector((state) => state.memory?.autoAnalyze || false)
  const analyzeModel = useAppSelector((state) => state.memory?.analyzeModel || null)
  const contextualRecommendationEnabled = useAppSelector(
    (state) => state.memory?.contextualRecommendationEnabled || false
  )
  const autoRecommendMemories = useAppSelector((state) => state.memory?.autoRecommendMemories || false)

  // 使用 useCallback 定义分析函数，但减少依赖项
  // 增加可选的 topicId 参数，允许分析指定的话题
  // 增加 isManualAnalysis 参数，标记是否是手动分析
  const analyzeAndAddMemories = useCallback(
    async (topicId?: string, isManualAnalysis: boolean = false) => {
      // 如果没有提供话题ID，则使用当前话题
      // 在函数执行时获取最新状态
      const currentState = store.getState() // Use imported store
      const memoryState = currentState.memory || {}
      const messagesState = currentState.messages || {}

      // 检查isAnalyzing状态是否卡住（超过1分钟）
      if (memoryState.isAnalyzing && memoryState.lastAnalyzeTime) {
        const now = Date.now()
        const analyzeTime = memoryState.lastAnalyzeTime
        if (now - analyzeTime > 1 * 60 * 1000) {
          // 1分钟超时
          console.log('[Memory Analysis] Analysis state stuck, resetting...')
          dispatch(setAnalyzing(false))
        }
      }

      // 检查条件
      // 手动分析时不检查 autoAnalyze 条件
      const conditions = {
        isActive: memoryState.isActive,
        autoAnalyze: isManualAnalysis ? true : memoryState.autoAnalyze, // 手动分析时忽略自动分析设置
        analyzeModel: memoryState.analyzeModel,
        isAnalyzing: memoryState.isAnalyzing
      }

      if (!conditions.isActive || !conditions.autoAnalyze || !conditions.analyzeModel || conditions.isAnalyzing) {
        console.log('[Memory Analysis] Conditions not met or already analyzing at time of call:', conditions)
        return
      }

      // 获取对话内容
      let messages: any[] = []
      const targetTopicId = topicId || messagesState.currentTopic?.id

      if (targetTopicId) {
        // 如果提供了话题ID，先尝试从 Redux store 中获取
        if (messagesState.messagesByTopic && messagesState.messagesByTopic[targetTopicId]) {
          messages = messagesState.messagesByTopic[targetTopicId] || []
        } else {
          // 如果 Redux store 中没有，则从数据库中获取
          try {
            const topicMessages = await TopicManager.getTopicMessages(targetTopicId)
            if (topicMessages && topicMessages.length > 0) {
              messages = topicMessages
            }
          } catch (error) {
            console.error(`[Memory Analysis] Failed to get messages for topic ${targetTopicId}:`, error)
          }
        }
      }

      if (!messages || messages.length === 0) {
        console.log('[Memory Analysis] No messages to analyze.')
        return
      }

      // 获取现有的长期记忆
      const existingMemories = store.getState().memory?.memories || []
      const topicMemories = existingMemories.filter((memory) => memory.topicId === targetTopicId)

      // 收集所有已分析过的消息ID
      const analyzedMessageIds = new Set<string>()
      topicMemories.forEach((memory) => {
        if (memory.analyzedMessageIds) {
          memory.analyzedMessageIds.forEach((id) => analyzedMessageIds.add(id))
        }
      })

      // 找出未分析过的新消息
      const newMessages = messages.filter((msg) => !analyzedMessageIds.has(msg.id))

      if (newMessages.length === 0) {
        console.log('[Memory Analysis] No new messages to analyze.')
        return
      }

      // 减少日志输出

      // 构建新消息的对话内容
      const newConversation = newMessages.map((msg) => `${msg.role || 'user'}: ${msg.content || ''}`).join('\n')

      // 获取已有的长期记忆内容
      const existingMemoriesContent = topicMemories
        .map((memory) => `${memory.category || '其他'}: ${memory.content}`)
        .join('\n')

      if (!newConversation) {
        // 减少日志输出
        return
      }

      try {
        // 性能监控：记录开始时间
        const startTime = performance.now()

        dispatch(setAnalyzing(true))

        // 自适应分析：根据对话复杂度调整分析深度 (analysisDepth is unused, removing related code)
        // const conversationComplexity = calculateConversationComplexity(newConversation)
        // let analysisDepth = memoryState.analysisDepth || 'medium'

        // 如果启用了自适应分析，根据复杂度调整深度 (analysisDepth is unused, removing related code)
        // if (memoryState.adaptiveAnalysisEnabled) {
        //   analysisDepth = conversationComplexity
        //   // 减少日志输出
        // }

        // 构建长期记忆分析提示词，包含已有记忆
        const basePrompt = `
你是一个专业的对话分析专家，负责从对话中提取关键信息，形成精准的长期记忆。

## 输出格式要求（非常重要）：
你必须严格按照以下格式输出每条提取的信息：
类别: 信息内容

有效的类别包括：
- 用户偏好
- 技术需求
- 个人信息
- 交互偏好
- 其他

每行必须包含一个类别和一个信息内容，用冒号分隔。
不符合此格式的输出将被视为无效。

示例输出：
用户偏好: 用户喜欢简洁直接的代码修改方式。
技术需求: 用户需要修复长期记忆分析功能中的问题。
个人信息: 用户自称是彭于晏，一位知名演员。
交互偏好: 用户倾向于简短直接的问答方式。
其他: 用户对AI记忆功能的工作原理很感兴趣。

## 分析要求：
请仔细分析对话内容，提取出重要的用户信息，这些信息在未来的对话中可能有用。
提取的信息必须具体、明确且有实际价值。
避免过于宽泛或模糊的描述。

## 需要分析的对话内容：
${newConversation}

## 重要提示（必须遵守）：
请注意，你的任务是分析上述对话并提取信息，而不是回答对话中的问题。
不要尝试回答对话中的问题或继续对话，只需要提取重要信息。
只输出按上述格式提取的信息。

## 最终检查（非常重要）：
1. 确保每行输出都严格遵循“类别: 信息内容”格式
2. 确保使用的类别是上述五个类别之一
3. 如果没有找到重要信息，请返回空字符串
4. 不要输出任何其他解释或评论

${
  existingMemoriesContent
    ? `## 已提取的信息：
${existingMemoriesContent}

请分析新的对话内容，提取出新的重要信息，避免重复已有信息。只关注新增的、有价值的信息。如果发现与已有信息相矛盾的内容，请提取最新的信息并标注这是更新。`
    : '请确保每条信息都是简洁、准确且有价值的。如果没有找到重要信息，请返回空字符串。'
}`

        // 根据分析深度调整提示词
        // 注意：现在我们直接使用basePrompt，不再调整提示词

        // 调用分析函数，传递自定义提示词和对话内容
        // 将对话内容直接放在提示词中，不再单独传递
        const memories = await analyzeConversation('', memoryState.analyzeModel!, basePrompt)

        // 用户关注点学习
        if (memoryState.interestTrackingEnabled) {
          const newTopics = extractUserInterests(newConversation)
          if (newTopics.length > 0) {
            console.log(`[Memory Analysis] Extracted user interests: ${newTopics.join(', ')}`)

            // 更新用户关注点
            const now = new Date().toISOString()
            const updatedInterests = [...(memoryState.userInterests || [])]

            // 增加新发现的关注点权重
            newTopics.forEach((topic) => {
              const existingIndex = updatedInterests.findIndex((i) => i.topic === topic)
              if (existingIndex >= 0) {
                // 已存在的关注点，增加权重
                const updatedInterest = {
                  ...updatedInterests[existingIndex],
                  weight: Math.min(1, updatedInterests[existingIndex].weight + 0.1),
                  lastUpdated: now
                }
                store.dispatch(updateUserInterest(updatedInterest))
              } else {
                // 新的关注点
                const newInterest = {
                  topic,
                  weight: 0.5, // 初始权重
                  lastUpdated: now
                }
                store.dispatch(updateUserInterest(newInterest))
              }
            })
          }
        }
        console.log('[Memory Analysis] Analysis complete. Memories extracted:', memories)

        // 添加提取的记忆
        if (memories && memories.length > 0) {
          // 性能监控：记录分析时间
          const endTime = performance.now()
          const analysisTime = endTime - startTime

          // 更新分析统计数据
          store.dispatch(
            updateAnalysisStats({
              totalAnalyses: (memoryState.analysisStats?.totalAnalyses || 0) + 1,
              successfulAnalyses: (memoryState.analysisStats?.successfulAnalyses || 0) + 1,
              newMemoriesGenerated: (memoryState.analysisStats?.newMemoriesGenerated || 0) + memories.length,
              averageAnalysisTime: memoryState.analysisStats?.totalAnalyses
                ? ((memoryState.analysisStats.averageAnalysisTime || 0) *
                    (memoryState.analysisStats.totalAnalyses || 0) +
                    analysisTime) /
                  ((memoryState.analysisStats.totalAnalyses || 0) + 1)
                : analysisTime,
              lastAnalysisTime: Date.now()
            })
          )

          // 性能监控：记录分析延迟
          try {
            store.dispatch(addAnalysisLatency(analysisTime))
          } catch (error) {
            console.warn('[Memory Analysis] Failed to add analysis latency:', error)
          }
          // 智能去重：使用AI模型检查语义相似的记忆
          const existingMemories = store.getState().memory?.memories || []

          // 首先进行简单的字符串匹配去重
          const newMemories = memories.filter((memory) => {
            return !existingMemories.some((m) => m.content === memory.content)
          })

          // 记录是否添加了新记忆
          let addedNewMemories = false

          console.log(`[Memory Analysis] Found ${memories.length} memories, ${newMemories.length} are new`)

          // 添加新记忆
          for (const memory of newMemories) {
            // 获取当前选中的列表ID
            const currentListId = store.getState().memory?.currentListId || store.getState().memory?.memoryLists[0]?.id

            // 收集新分析的消息ID
            const newMessageIds = messages.map((msg) => msg.id)

            // 获取最后一条消息的ID，用于跟踪分析进度
            const lastMessageId = messages[messages.length - 1]?.id

            dispatch(
              addMemory({
                content: memory.content,
                source: '自动分析',
                category: memory.category,
                listId: currentListId,
                analyzedMessageIds: newMessageIds,
                lastMessageId: lastMessageId,
                topicId: targetTopicId
              })
            )
            console.log(
              `[Memory Analysis] Added new memory: "${memory.content}" (${memory.category}) to list ${currentListId}`
            )
            addedNewMemories = true
          }

          console.log(`[Memory Analysis] Processed ${memories.length} potential memories, added ${newMemories.length}.`)

          // 如果添加了新记忆，将其保存到长期记忆文件
          if (addedNewMemories) {
            try {
              const state = store.getState().memory
              await store
                .dispatch(
                  saveLongTermMemoryData({
                    memories: state.memories,
                    memoryLists: state.memoryLists,
                    currentListId: state.currentListId,
                    analyzeModel: state.analyzeModel
                  })
                )
                .unwrap()
              console.log('[Memory Analysis] Long-term memories saved to file after analysis')
            } catch (error) {
              console.error('[Memory Analysis] Failed to save long-term memory data after analysis:', error)
            }
          }

          // 自适应分析：根据分析结果调整分析频率
          if (memoryState.adaptiveAnalysisEnabled) {
            // 如果分析成功率低，增加分析频率
            const successRate =
              (memoryState.analysisStats?.successfulAnalyses || 0) /
              Math.max(1, memoryState.analysisStats?.totalAnalyses || 1)
            let newFrequency = memoryState.analysisFrequency || 5

            if (successRate < 0.3 && newFrequency > 3) {
              // 成功率低，减少分析频率（增加消息数阈值）
              newFrequency += 1
              console.log(
                `[Memory Analysis] Low success rate (${successRate.toFixed(2)}), increasing message threshold to ${newFrequency}`
              )
            } else if (successRate > 0.7 && newFrequency > 2) {
              // 成功率高，增加分析频率（减少消息数阈值）
              newFrequency -= 1
              console.log(
                `[Memory Analysis] High success rate (${successRate.toFixed(2)}), decreasing message threshold to ${newFrequency}`
              )
            }
          }
        } else {
          console.log('[Memory Analysis] No new memories extracted.')

          // 更新分析统计数据（分析失败）
          const endTime = performance.now()
          const analysisTime = endTime - startTime

          store.dispatch(
            updateAnalysisStats({
              totalAnalyses: (memoryState.analysisStats?.totalAnalyses || 0) + 1,
              lastAnalysisTime: Date.now()
            })
          )

          // 性能监控：记录分析延迟
          try {
            store.dispatch(addAnalysisLatency(analysisTime))
          } catch (error) {
            console.warn('[Memory Analysis] Failed to add analysis latency:', error)
          }
        }

        // 性能监控：更新性能指标
        if (memoryState.monitoringEnabled) {
          try {
            store.dispatch(
              updatePerformanceMetrics({
                memoryCount: store.getState().memory?.memories.length || 0,
                shortMemoryCount: store.getState().memory?.shortMemories.length || 0,
                lastPerformanceCheck: Date.now()
              })
            )
          } catch (error) {
            console.warn('[Memory Analysis] Failed to update performance metrics:', error)
          }
        }
      } catch (error) {
        console.error('Failed to analyze and add memories:', error)
      } finally {
        dispatch(setAnalyzing(false))
        console.log('[Memory Analysis] Analysis finished.')
      }
      // 依赖项只需要 dispatch，因为其他所有状态都在函数内部重新获取
    },
    [dispatch]
  )

  // Ref 来存储最新的 analyzeAndAddMemories 函数
  const analyzeAndAddMemoriesRef = useRef(analyzeAndAddMemories)

  // Effect 来保持 ref 是最新的
  useEffect(() => {
    analyzeAndAddMemoriesRef.current = analyzeAndAddMemories
  }, [analyzeAndAddMemories])

  // 记录记忆访问
  const recordMemoryAccess = useCallback(
    (memoryId: string, isShortMemory: boolean = false, isAssistantMemory: boolean = false) => {
      store.dispatch(accessMemory({ id: memoryId, isShortMemory, isAssistantMemory }))
    },
    []
  )

  // Effect 来设置/清除定时器，只依赖于启动条件
  useEffect(() => {
    // 定期更新记忆优先级
    const priorityUpdateInterval = setInterval(
      () => {
        const memoryState = store.getState().memory
        if (!memoryState?.priorityManagementEnabled) return

        // 检查上次更新时间，避免频繁更新
        const now = Date.now()
        const lastUpdate = memoryState.lastPriorityUpdate || 0
        const updateInterval = 30 * 60 * 1000 // 30分钟更新一次

        if (now - lastUpdate < updateInterval) return

        console.log('[Memory Priority] Updating memory priorities and freshness...')
        store.dispatch(updateMemoryPriorities())
      },
      10 * 60 * 1000
    ) // 每10分钟检查一次

    return () => {
      clearInterval(priorityUpdateInterval)
    }
  }, [])

  // Effect 来设置/清除分析定时器，只依赖于启动条件
  useEffect(() => {
    if (!isActive || !autoAnalyze || !analyzeModel) {
      console.log('[Memory Analysis Timer] Conditions not met for setting up timer:', {
        isActive,
        autoAnalyze,
        analyzeModel
      })
      return // 清理函数不需要显式返回 undefined
    }

    console.log('[Memory Analysis Timer] Setting up interval timer (1 minute)...') // 更新日志说明时间
    // 设置 1 分钟间隔用于测试
    const intervalId = setInterval(
      () => {
        console.log('[Memory Analysis Timer] Interval triggered. Calling analyze function from ref...')
        // 定时器触发时不指定话题ID，使用当前活动话题
        analyzeAndAddMemoriesRef.current() // 调用 ref 中的函数
      },
      1 * 60 * 1000
    ) // 1 分钟

    // 清理函数
    return () => {
      console.log('[Memory Analysis Timer] Clearing interval timer...')
      clearInterval(intervalId)
    }
    // 依赖项只包含决定是否启动定时器的设置
  }, [isActive, autoAnalyze, analyzeModel])

  // 获取上下文感知记忆推荐
  const getContextualRecommendations = useCallback(
    async (messages: Message[], topicId: string, limit: number = 5) => {
      if (!contextualRecommendationEnabled) {
        console.log('[ContextualMemory] Contextual recommendation is not enabled')
        return []
      }

      return await getContextualMemoryRecommendations(messages, topicId, limit)
    },
    [contextualRecommendationEnabled]
  )

  // 获取主题相关记忆
  const getTopicRecommendations = useCallback(
    async (topicId: string, limit: number = 10) => {
      if (!contextualRecommendationEnabled) {
        console.log('[ContextualMemory] Contextual recommendation is not enabled')
        return []
      }

      return await getTopicRelatedMemories(topicId, limit)
    },
    [contextualRecommendationEnabled]
  )

  // 获取AI增强记忆推荐
  const getAIRecommendations = useCallback(
    async (messages: Message[], limit: number = 5) => {
      if (!contextualRecommendationEnabled) {
        console.log('[ContextualMemory] Contextual recommendation is not enabled')
        return []
      }

      return await getAIEnhancedMemoryRecommendations(messages, limit)
    },
    [contextualRecommendationEnabled]
  )

  // 清除当前记忆推荐
  const clearRecommendations = useCallback(() => {
    dispatch(clearCurrentRecommendations())
  }, [dispatch])

  // 自动记忆推荐定时器
  useEffect(() => {
    if (!contextualRecommendationEnabled || !autoRecommendMemories) {
      return
    }

    console.log('[ContextualMemory] Setting up auto recommendation timer...')

    // 每5分钟自动推荐一次记忆
    const intervalId = setInterval(
      () => {
        const state = store.getState()
        const currentTopicId = state.messages.currentTopic?.id
        const messages = currentTopicId ? state.messages.messagesByTopic?.[currentTopicId] || [] : []

        if (currentTopicId && messages.length > 0) {
          console.log('[ContextualMemory] Auto recommendation triggered')
          getContextualRecommendations(messages, currentTopicId)
        }
      },
      5 * 60 * 1000
    ) // 5分钟

    return () => {
      console.log('[ContextualMemory] Clearing auto recommendation timer')
      clearInterval(intervalId)
    }
  }, [contextualRecommendationEnabled, autoRecommendMemories, getContextualRecommendations])

  // 返回分析函数、记忆访问函数和记忆推荐函数，以便在其他组件中使用
  return {
    analyzeAndAddMemories,
    recordMemoryAccess,
    getContextualRecommendations,
    getTopicRecommendations,
    getAIRecommendations,
    clearRecommendations
  }
}

// 手动添加短记忆
export const addShortMemoryItem = async (
  content: string,
  topicId: string,
  analyzedMessageIds?: string[],
  lastMessageId?: string
) => {
  // Use imported store directly
  store.dispatch(
    addShortMemory({
      content,
      topicId,
      analyzedMessageIds,
      lastMessageId
    })
  )

  // 保存到文件，并强制覆盖
  try {
    const state = store.getState().memory
    await store
      .dispatch(
        saveMemoryData({
          shortMemories: state.shortMemories,
          forceOverwrite: true // 强制覆盖文件，确保数据正确保存
        })
      )
      .unwrap()
    console.log('[Memory] Short memory saved to file after manual addition (force overwrite)')
  } catch (error) {
    console.error('[Memory] Failed to save short memory data after manual addition:', error)
  }
}

// 手动添加长期记忆
export const addMemoryItem = async (
  content: string,
  category?: string,
  source?: string,
  listId?: string,
  topicId?: string
) => {
  // Use imported store directly
  store.dispatch(
    addMemory({
      content,
      category,
      source: source || '手动添加',
      listId,
      topicId
    })
  )

  // 保存到长期记忆文件
  try {
    const state = store.getState().memory
    await store
      .dispatch(
        saveLongTermMemoryData({
          memories: state.memories,
          memoryLists: state.memoryLists,
          currentListId: state.currentListId,
          analyzeModel: state.analyzeModel
        })
      )
      .unwrap()
    console.log('[Memory] Long-term memory saved to file after manual addition')
  } catch (error) {
    console.error('[Memory] Failed to save long-term memory data after manual addition:', error)
  }
}

// 手动添加助手记忆
export const addAssistantMemoryItem = async (
  content: string,
  assistantId: string,
  analyzedMessageIds?: string[],
  lastMessageId?: string
) => {
  // Use imported store directly
  store.dispatch(
    addAssistantMemory({
      content,
      assistantId,
      analyzedMessageIds,
      lastMessageId
    })
  )

  // 保存到文件，并强制覆盖
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
    console.log('[Memory] Assistant memory saved to file after manual addition (force overwrite)')
  } catch (error) {
    console.error('[Memory] Failed to save assistant memory data after manual addition:', error)
  }
}

// 导出助手记忆分析函数
export { analyzeAndAddAssistantMemories, resetAssistantMemoryAnalyzedMessageIds }

/**
 * 重置指定话题的长期记忆分析标记
 * @param topicId 要重置的话题ID
 * @returns 是否重置成功
 */
export const resetLongTermMemoryAnalyzedMessageIds = async (topicId: string): Promise<boolean> => {
  if (!topicId) {
    console.log('[Memory Reset] No topic ID provided')
    return false
  }

  try {
    // 获取当前记忆状态
    const state = store.getState().memory

    // 找到指定话题的所有长期记忆
    const memories = state.memories || []
    const topicMemories = memories.filter((memory) => memory.topicId === topicId)

    if (topicMemories.length === 0) {
      console.log(`[Memory Reset] No long-term memories found for topic ${topicId}`)
      return false
    }

    console.log(`[Memory Reset] Found ${topicMemories.length} long-term memories for topic ${topicId}`)

    // 重置每个记忆的已分析消息ID
    let hasChanges = false

    // 创建更新后的记忆数组
    const updatedMemories = state.memories.map((memory) => {
      // 只更新指定话题的记忆
      if (memory.topicId === topicId && memory.analyzedMessageIds && memory.analyzedMessageIds.length > 0) {
        hasChanges = true
        // 创建新对象，而不是修改原对象
        return {
          ...memory,
          analyzedMessageIds: []
        }
      }
      return memory
    })

    if (!hasChanges) {
      console.log(`[Memory Reset] No analyzed message IDs to reset for topic ${topicId}`)
      return false
    }

    // 更新Redux状态中的memories数组
    store.dispatch({
      type: 'memory/setMemories',
      payload: updatedMemories
    })

    // 保存更改到文件
    await store
      .dispatch(
        saveMemoryData({
          memories: updatedMemories
        })
      )
      .unwrap()

    // 尝试获取话题的消息，以确保分析时能找到消息
    try {
      // 获取当前话题的消息
      const messagesState = store.getState().messages || {}
      let messages: any[] = []

      // 先尝试从 Redux store 中获取
      if (messagesState.messagesByTopic && messagesState.messagesByTopic[topicId]) {
        messages = messagesState.messagesByTopic[topicId] || []
      } else {
        // 如果 Redux store 中没有，则从数据库中获取
        try {
          const topicMessages = await TopicManager.getTopicMessages(topicId)
          if (topicMessages && topicMessages.length > 0) {
            messages = topicMessages
          }
        } catch (error) {
          console.error(`[Memory Reset] Failed to get messages for topic ${topicId}:`, error)
        }
      }

      console.log(`[Memory Reset] Found ${messages.length} messages for topic ${topicId}`)

      if (messages.length === 0) {
        console.log(`[Memory Reset] Warning: No messages found for topic ${topicId}, analysis may not work`)
      }
    } catch (error) {
      console.error(`[Memory Reset] Error checking messages for topic ${topicId}:`, error)
    }

    console.log(`[Memory Reset] Successfully reset analyzed message IDs for topic ${topicId}`)
    return true
  } catch (error) {
    console.error('[Memory Reset] Failed to reset analyzed message IDs:', error)
    return false
  }
}

// 分析对话内容并提取重要信息添加到短期记忆
// 分析对话内容并提取重要信息添加到短期记忆
export const analyzeAndAddShortMemories = async (topicId: string) => {
  if (!topicId) {
    console.log('[Short Memory Analysis] No topic ID provided')
    return false
  }

  // 获取当前记忆状态
  const memoryState = store.getState().memory || {}
  const messagesState = store.getState().messages || {}
  const shortMemoryAnalyzeModel = memoryState.shortMemoryAnalyzeModel

  if (!shortMemoryAnalyzeModel) {
    console.log('[Short Memory Analysis] No short memory analyze model set')
    return false
  }

  // 获取对话内容
  let messages: any[] = []

  // 从 Redux store 中获取话题消息
  if (messagesState.messagesByTopic && messagesState.messagesByTopic[topicId]) {
    messages = messagesState.messagesByTopic[topicId] || []
  } else {
    // 如果 Redux store 中没有，则从数据库中获取
    try {
      const topicMessages = await TopicManager.getTopicMessages(topicId)
      if (topicMessages && topicMessages.length > 0) {
        messages = topicMessages
      }
    } catch (error) {
      console.error(`[Short Memory Analysis] Failed to get messages for topic ${topicId}:`, error)
      return false
    }
  }

  if (!messages || messages.length === 0) {
    console.log('[Short Memory Analysis] No messages to analyze.')
    return false
  }

  // 获取现有的短期记忆
  const existingShortMemories = store.getState().memory?.shortMemories || []
  const topicShortMemories = existingShortMemories.filter((memory) => memory.topicId === topicId)

  // 收集所有已分析过的消息ID
  const analyzedMessageIds = new Set<string>()
  topicShortMemories.forEach((memory) => {
    if (memory.analyzedMessageIds) {
      memory.analyzedMessageIds.forEach((id) => analyzedMessageIds.add(id))
    }
  })

  // 找出未分析过的新消息
  const newMessages = messages.filter((msg) => !analyzedMessageIds.has(msg.id))

  if (newMessages.length === 0) {
    console.log('[Short Memory Analysis] No new messages to analyze.')
    return false
  }

  console.log(`[Short Memory Analysis] Found ${newMessages.length} new messages to analyze.`)

  // 构建新消息的对话内容
  const newConversation = newMessages.map((msg) => `${msg.role || 'user'}: ${msg.content || ''}`).join('\n')

  // 获取已有的短期记忆内容
  const existingMemoriesContent = topicShortMemories.map((memory) => memory.content).join('\n')

  try {
    console.log('[Short Memory Analysis] Starting analysis...')
    console.log(`[Short Memory Analysis] Analyzing topic: ${topicId}`)
    console.log('[Short Memory Analysis] New conversation length:', newConversation.length)

    // 获取当前的过滤敏感信息设置
    const filterSensitiveInfo = store.getState().memory?.filterSensitiveInfo ?? true

    // 从Redux状态中获取自定义提示词
    const customShortTermPrompt = store.getState().memory?.shortTermMemoryPrompt

    // 构建短期记忆分析提示词，包含已有记忆和新对话
    let prompt =
      customShortTermPrompt ||
      `
请对以下对话内容进行非常详细的分析和总结，提取对当前对话至关重要的上下文信息。请注意，这个分析将用于生成短期记忆，帮助AI理解当前对话的完整上下文。

分析要求：
1. 非常详细地总结用户的每一句话中表达的关键信息、需求和意图
2. 全面分析AI回复中的重要内容和对用户问题的解决方案
3. 详细记录对话中的重要事实、数据、代码示例和具体细节
4. 清晰捕捉对话的逻辑发展、转折点和关键决策
5. 提取对理解当前对话上下文必不可少的信息
6. 记录用户提出的具体问题和关注点
7. 捕捉用户在对话中表达的偏好、困惑和反馈
8. 记录对话中提到的文件、路径、变量名等具体技术细节`

    // 如果启用了敏感信息过滤，添加相关指令
    if (filterSensitiveInfo) {
      prompt += `
9. 请注意不要提取任何敏感信息，包括但不限于：
   - API密钥、访问令牌或其他凭证
   - 密码或密码提示
   - 私人联系方式（如电话号码、邮箱地址）
   - 个人身份信息（如身份证号、社保号）
   - 银行账户或支付信息
   - 私密的个人或商业信息
   如果发现此类信息，请完全忽略，不要以任何形式记录或提取。`
    }

    prompt += `

与长期记忆不同，短期记忆应该非常详细地关注当前对话的具体细节和上下文。每条短期记忆应该是对对话片段的精准总结，确保不遗漏任何重要信息。

请注意，对于长对话（超过5万字），您应该生成至少15-20条详细的记忆条目，确保完整捕捉对话的所有重要方面。对于超长对话（超过8万字），应生成至少20-30条记忆条目。

${
  existingMemoriesContent
    ? `以下是已经提取的重要信息：
${existingMemoriesContent}

请分析新的对话内容，提取出新的重要信息，避免重复已有信息。确保新提取的信息与已有信息形成连贯的上下文理解。对于新的对话内容，请提供非常详细的分析。`
    : '请对对话进行非常全面和详细的分析，确保不遗漏任何重要细节。每条总结应该是完整的句子，清晰表达一个重要的上下文信息。请确保总结足够详细，以便在没有原始对话的情况下也能理解完整的上下文。'
}

输出格式：
请严格按照以下格式输出每条记忆，每条记忆必须单独成行，并以短横线开头：

- 记忆条目1
- 记忆条目2
- 记忆条目3
...

要求：
1. 每条记忆必须以短横线开头（“- ”），不要使用数字编号
2. 每条记忆必须是一个完整的句子，包含充分的上下文信息
3. 确保记忆内容精准、具体且与当前对话直接相关
4. 按重要性排序，最重要的信息放在前面
5. 对于复杂的对话，必须提供至少15-20条记忆条目
6. 对于超长对话（超过8万字），必须提供至少20-30条记忆条目
7. 对于技术内容，请包含具体的文件名、路径、变量名、函数名等技术细节
8. 对于代码相关的对话，请记录关键的代码片段和实现细节

注意：不要在输出中包含任何解释或其他格式的文本，只输出以短横线开头的记忆条目。如果对话内容简单，可以少于15条，但必须确保完整捕捉所有重要信息

请记住，您的分析应该非常详细，不要过于简化或概括。对于8万字的对话，100字的总结是远远不够的，应该提供至少500-1000字的详细总结，分成多个条目。

如果没有找到新的重要信息，请返回空字符串。

新的对话内容:
${newConversation}
`

    // 获取模型
    let modelId = shortMemoryAnalyzeModel
    let providerId = ''

    // 尝试解析JSON格式的模型ID
    if (typeof shortMemoryAnalyzeModel === 'string' && shortMemoryAnalyzeModel.startsWith('{')) {
      try {
        const parsedModel = JSON.parse(shortMemoryAnalyzeModel)
        modelId = parsedModel.id
        providerId = parsedModel.provider
        console.log(`[Short Memory Analysis] Using model ${modelId} from provider ${providerId}`)
      } catch (error) {
        console.error('[Short Memory Analysis] Failed to parse model ID:', error)
      }
    }

    // 先尝试根据供应商和模型ID查找
    let model: any = null
    if (providerId) {
      const provider = store.getState().llm.providers.find((p) => p.id === providerId)
      if (provider) {
        const foundModel = provider.models.find((m) => m.id === modelId)
        if (foundModel) {
          model = foundModel
        }
      }
    }

    // 如果没找到，尝试在所有模型中查找
    if (!model) {
      const foundModel = store
        .getState()
        .llm.providers.flatMap((provider) => provider.models)
        .find((m) => m.id === modelId)
      if (foundModel) {
        model = foundModel
      }
    }

    if (!model) {
      console.error(`[Short Memory Analysis] Model ${shortMemoryAnalyzeModel} not found`)
      return false
    }

    // 调用AI生成文本
    console.log('[Short Memory Analysis] Calling AI.generateText...')
    const result = await fetchGenerate({
      prompt: prompt,
      content: newConversation,
      modelId: model.id
    })
    console.log('[Short Memory Analysis] AI.generateText response:', result)

    if (!result || typeof result !== 'string' || result.trim() === '') {
      console.log('[Short Memory Analysis] No valid result from AI analysis.')
      return false
    }

    // 改进的记忆提取逻辑
    let extractedLines: string[] = []

    // 首先尝试匹配带有数字或短横线的列表项
    const listItemRegex = /(?:^|\n)(?:\d+\.\s*|-\s*)(.+?)(?=\n\d+\.\s*|\n-\s*|\n\n|$)/gs
    let match: RegExpExecArray | null
    while ((match = listItemRegex.exec(result)) !== null) {
      if (match[1] && match[1].trim()) {
        extractedLines.push(match[1].trim())
      }
    }

    // 如果没有找到列表项，则尝试按行分割并过滤
    if (extractedLines.length === 0) {
      extractedLines = result
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => {
          // 过滤掉空行和非内容行（如标题、分隔符等）
          return (
            line &&
            !line.startsWith('#') &&
            !line.startsWith('---') &&
            !line.startsWith('===') &&
            !line.includes('没有找到新的重要信息') &&
            !line.includes('No new important information')
          )
        })
        // 清理行首的数字、点和短横线
        .map((line) => line.replace(/^(\d+\.\s*|-\s*)/, '').trim())
    }

    console.log('[Short Memory Analysis] Extracted items:', extractedLines)

    if (extractedLines.length === 0) {
      console.log('[Short Memory Analysis] No memory items extracted from the analysis result.')
      return false
    }

    // 过滤掉已存在的记忆（使用更严格的比较）
    const existingContents = topicShortMemories.map((memory) => memory.content.toLowerCase())
    const newMemories = extractedLines.filter((content: string) => {
      const normalizedContent = content.toLowerCase()
      // 检查是否与现有记忆完全匹配或高度相似
      return !existingContents.some(
        (existingContent) =>
          existingContent === normalizedContent ||
          // 简单的相似度检查 - 如果一个字符串包含另一个的80%以上的内容
          (existingContent.includes(normalizedContent) && normalizedContent.length > existingContent.length * 0.8) ||
          (normalizedContent.includes(existingContent) && existingContent.length > normalizedContent.length * 0.8)
      )
    })

    console.log(`[Short Memory Analysis] Found ${extractedLines.length} items, ${newMemories.length} are new`)

    if (newMemories.length === 0) {
      console.log('[Short Memory Analysis] No new memories to add after filtering.')
      return false
    }

    // 收集新分析的消息ID
    const newMessageIds = newMessages.map((msg) => msg.id)

    // 获取最后一条消息的ID，用于跟踪分析进度
    const lastMessageId = messages[messages.length - 1]?.id

    // 添加新的短期记忆
    const addedMemories: string[] = [] // Explicitly type addedMemories
    for (const content of newMemories) {
      try {
        store.dispatch(
          addShortMemory({
            content,
            topicId,
            analyzedMessageIds: newMessageIds,
            lastMessageId: lastMessageId
          })
        )
        addedMemories.push(content)
        console.log(`[Short Memory Analysis] Added new short memory: "${content}" to topic ${topicId}`)
      } catch (error) {
        console.error(`[Short Memory Analysis] Failed to add memory: "${content}"`, error)
      }
    }

    // 显式触发保存操作，确保数据被持久化，并强制覆盖
    try {
      const state = store.getState().memory
      await store
        .dispatch(
          saveMemoryData({
            memoryLists: state.memoryLists,
            memories: state.memories,
            shortMemories: state.shortMemories,
            forceOverwrite: true // 强制覆盖文件，确保数据正确保存
          })
        )
        .unwrap() // 使用unwrap()来等待异步操作完成并处理错误
      console.log('[Short Memory Analysis] Memory data saved successfully (force overwrite)')
    } catch (error) {
      console.error('[Short Memory Analysis] Failed to save memory data:', error)
      // 即使保存失败，我们仍然返回true，因为记忆已经添加到Redux状态中
    }

    return addedMemories.length > 0
  } catch (error) {
    console.error('[Short Memory Analysis] Failed to analyze and add short memories:', error)
    return false
  }
}

// 将记忆应用到系统提示词
import { persistor } from '@renderer/store' // Import persistor

export const applyMemoriesToPrompt = async (systemPrompt: string, topicId?: string): Promise<string> => {
  // 检查持久化状态是否已加载完成
  if (!persistor.getState().bootstrapped) {
    console.warn('[Memory] Persistor not bootstrapped yet. Skipping applying memories.')
    return systemPrompt
  }

  const state = store.getState() // Use imported store
  // 确保 state.memory 存在，如果不存在则提供默认值
  const {
    isActive,
    memories,
    memoryLists,
    shortMemoryActive,
    shortMemories,
    assistantMemoryActive,
    assistantMemories,
    priorityManagementEnabled,
    contextualRecommendationEnabled,
    currentRecommendations
  } = state.memory || {
    isActive: false,
    memories: [],
    memoryLists: [],
    shortMemoryActive: false,
    shortMemories: [],
    assistantMemoryActive: false,
    assistantMemories: [],
    priorityManagementEnabled: false,
    contextualRecommendationEnabled: false,
    currentRecommendations: []
  }

  // 获取当前话题ID
  const currentTopicId = state.messages.currentTopic?.id

  console.log('[Memory] Applying memories to prompt:', {
    isActive,
    memoriesCount: memories?.length,
    listsCount: memoryLists?.length,
    shortMemoryActive,
    shortMemoriesCount: shortMemories?.length,
    assistantMemoryActive,
    assistantMemoriesCount: assistantMemories?.length,
    currentTopicId,
    priorityManagementEnabled
  })

  let result = systemPrompt
  let hasContent = false

  // 处理上下文感知记忆推荐
  if (contextualRecommendationEnabled && currentRecommendations && currentRecommendations.length > 0) {
    // 获取推荐记忆的详细信息
    const recommendedMemories: Array<{ content: string; source: string; reason: string }> = []

    // 处理每个推荐记忆
    for (const recommendation of currentRecommendations) {
      // 根据来源查找记忆
      let memory: any = null
      if (recommendation.source === 'long-term') {
        memory = memories.find((m) => m.id === recommendation.memoryId)
      } else if (recommendation.source === 'short-term') {
        memory = shortMemories.find((m) => m.id === recommendation.memoryId)
      } else if (recommendation.source === 'assistant') {
        memory = assistantMemories.find((m) => m.id === recommendation.memoryId)
      }

      if (memory) {
        let sourceLabel = '长期记忆' // 默认为长期记忆
        if (recommendation.source === 'short-term') {
          sourceLabel = '短期记忆'
        } else if (recommendation.source === 'assistant') {
          sourceLabel = '助手记忆'
        }

        recommendedMemories.push({
          content: memory.content,
          source: sourceLabel,
          reason: recommendation.matchReason || '与当前对话相关'
        })

        // 记录访问
        store.dispatch(
          accessMemory({
            id: memory.id,
            isShortMemory: recommendation.source === 'short-term',
            isAssistantMemory: recommendation.source === 'assistant'
          })
        )
      }
    }

    if (recommendedMemories.length > 0) {
      // 构建推荐记忆提示词
      // 按重要性排序
      recommendedMemories.sort((a, b) => {
        const memoryA =
          memories.find((m) => m.content === a.content) ||
          shortMemories.find((m) => m.content === a.content) ||
          assistantMemories.find((m) => m.content === a.content)
        const memoryB =
          memories.find((m) => m.content === b.content) ||
          shortMemories.find((m) => m.content === b.content) ||
          assistantMemories.find((m) => m.content === b.content)
        const importanceA = memoryA?.importance || 0.5
        const importanceB = memoryB?.importance || 0.5
        return importanceB - importanceA
      })

      // 构建更自然的提示词
      const recommendedMemoryPrompt = `在与用户交流时，请考虑以下关于用户的重要信息：\n\n${recommendedMemories
        .map((memory) => `- ${memory.content}`)
        .join('\n')}`

      console.log('[Memory] Contextual memory recommendations:', recommendedMemoryPrompt)

      // 添加推荐记忆到提示词
      result = `${result}\n\n${recommendedMemoryPrompt}`
      hasContent = true
    }
  }

  // 处理助手记忆
  const currentAssistant = state.messages?.currentAssistant
  const currentAssistantId = currentAssistant?.id

  // 获取当前话题的助手ID
  let topicAssistantId = currentAssistantId
  if (topicId) {
    try {
      // 从当前状态中获取话题的助手ID
      const assistants = state.assistants.assistants
      for (const assistant of assistants) {
        const topic = assistant.topics.find((t) => t.id === topicId)
        if (topic) {
          topicAssistantId = assistant.id
          console.log('[Memory] Using topic assistant ID:', topicAssistantId)
          break
        }
      }
    } catch (error) {
      console.error('[Memory] Error getting topic assistant ID:', error)
    }
  }

  // 使用话题助手ID或当前助手ID
  const assistantIdToUse = topicAssistantId || currentAssistantId

  if (assistantMemoryActive && assistantMemories && assistantMemories.length > 0 && assistantIdToUse) {
    // 获取相关助手的记忆
    let assistantSpecificMemories = assistantMemories.filter((memory) => memory.assistantId === assistantIdToUse)

    // 如果启用了智能优先级管理，根据优先级排序
    if (priorityManagementEnabled && assistantSpecificMemories.length > 0) {
      // 计算每个记忆的综合分数（重要性 * 衰减因子 * 鲜度）
      const scoredMemories = assistantSpecificMemories.map((memory) => {
        // 记录访问
        store.dispatch(accessMemory({ id: memory.id, isAssistantMemory: true }))

        // 计算综合分数
        const importance = memory.importance || 0.5
        const decayFactor = memory.decayFactor || 1
        const freshness = memory.freshness || 0.5
        const score = importance * decayFactor * (freshness * 1.5) // 助手记忆的鲜度权重介于长期和短期记忆之间
        return { memory, score }
      })

      // 按综合分数降序排序
      scoredMemories.sort((a, b) => b.score - a.score)

      // 提取排序后的记忆
      assistantSpecificMemories = scoredMemories.map((item) => item.memory)

      // 限制数量，避免提示词过长
      if (assistantSpecificMemories.length > 10) {
        assistantSpecificMemories = assistantSpecificMemories.slice(0, 10)
      }
    }

    if (assistantSpecificMemories.length > 0) {
      // 按重要性排序
      assistantSpecificMemories.sort((a, b) => {
        const importanceA = a.importance || 0.5
        const importanceB = b.importance || 0.5
        return importanceB - importanceA
      })

      // 构建助手记忆提示词
      const memoryItems = assistantSpecificMemories.map((memory) => `- ${memory.content}`).join('\n')
      const assistantMemoryPrompt = `作为当前助手，请记住以下重要信息：\n\n${memoryItems}`
      console.log('[Memory] Assistant memory prompt:', assistantMemoryPrompt)

      // 添加助手记忆到提示词
      result = `${result}\n\n${assistantMemoryPrompt}`
      hasContent = true
    }
  }

  // 处理短记忆
  if (shortMemoryActive && shortMemories && shortMemories.length > 0 && currentTopicId) {
    // 获取当前话题的短记忆
    let topicShortMemories = shortMemories.filter((memory) => memory.topicId === currentTopicId)

    // 如果启用了智能优先级管理，根据优先级排序
    if (priorityManagementEnabled && topicShortMemories.length > 0) {
      // 计算每个记忆的综合分数（重要性 * 衰减因子 * 鲜度）
      const scoredMemories = topicShortMemories.map((memory) => {
        // 记录访问
        store.dispatch(accessMemory({ id: memory.id, isShortMemory: true }))

        // 计算综合分数
        const importance = memory.importance || 0.5
        const decayFactor = memory.decayFactor || 1
        const freshness = memory.freshness || 0.5
        const score = importance * decayFactor * (freshness * 2) // 短期记忆更注重鲜度
        return { memory, score }
      })

      // 按综合分数降序排序
      scoredMemories.sort((a, b) => b.score - a.score)

      // 提取排序后的记忆
      topicShortMemories = scoredMemories.map((item) => item.memory)

      // 限制数量，避免提示词过长
      if (topicShortMemories.length > 10) {
        topicShortMemories = topicShortMemories.slice(0, 10)
      }
    }

    if (topicShortMemories.length > 0) {
      // 按重要性排序
      topicShortMemories.sort((a, b) => {
        const importanceA = a.importance || 0.5
        const importanceB = b.importance || 0.5
        return importanceB - importanceA
      })

      // 构建更自然的短期记忆提示词
      const shortMemoryPrompt = `关于当前对话，请记住以下重要信息：\n\n${topicShortMemories.map((memory) => `- ${memory.content}`).join('\n')}`
      console.log('[Memory] Short memory prompt:', shortMemoryPrompt)

      // 添加短记忆到提示词
      result = `${result}\n\n${shortMemoryPrompt}`
      hasContent = true
    }
  }

  // 处理长记忆
  if (isActive && memories && memories.length > 0 && memoryLists && memoryLists.length > 0) {
    // 获取所有激活的记忆列表
    const activeListIds = memoryLists.filter((list) => list.isActive).map((list) => list.id)

    if (activeListIds.length > 0) {
      // 只获取激活列表中的记忆
      let activeMemories = memories.filter((memory) => activeListIds.includes(memory.listId))

      // 如果启用了智能优先级管理，根据优先级排序
      if (priorityManagementEnabled && activeMemories.length > 0) {
        // 计算每个记忆的综合分数
        const scoredMemories = activeMemories.map((memory) => {
          // 记录访问
          store.dispatch(accessMemory({ id: memory.id }))

          // 计算综合分数
          const importance = memory.importance || 0.5
          const decayFactor = memory.decayFactor || 1
          const freshness = memory.freshness || 0.5
          const score = importance * decayFactor * freshness
          return { memory, score }
        })

        // 按综合分数降序排序
        scoredMemories.sort((a, b) => b.score - a.score)

        // 限制每个列表的记忆数量
        const maxMemoriesPerList = 5
        const memoriesByList: Record<string, Memory[]> = {}

        // 提取排序后的记忆
        const sortedMemories = scoredMemories.map((item) => item.memory)

        sortedMemories.forEach((memory) => {
          if (!memoriesByList[memory.listId]) {
            memoriesByList[memory.listId] = []
          }
          if (memoriesByList[memory.listId].length < maxMemoriesPerList) {
            memoriesByList[memory.listId].push(memory)
          }
        })

        // 重新构建活跃记忆列表
        activeMemories = Object.values(memoriesByList).flat() as Memory[]
      }

      if (activeMemories.length > 0) {
        // 按重要性对所有记忆进行排序
        activeMemories.sort((a, b) => {
          const importanceA = a.importance || 0.5
          const importanceB = b.importance || 0.5
          return importanceB - importanceA
        })

        // 按列表分组构建记忆提示词
        let memoryPrompt = ''

        // 构建更自然的开头
        memoryPrompt = `请考虑以下关于用户的重要背景信息：\n\n`

        // 如果只有一个激活列表，直接列出记忆
        if (activeListIds.length === 1) {
          memoryPrompt += activeMemories.map((memory) => `- ${memory.content}`).join('\n')
        } else {
          // 如果有多个激活列表，按列表分组
          for (const listId of activeListIds) {
            const list = memoryLists.find((l) => l.id === listId)
            if (list) {
              const listMemories = activeMemories.filter((m) => m.listId === listId)
              if (listMemories.length > 0) {
                memoryPrompt += `\n${list.name}:\n`
                memoryPrompt += listMemories.map((memory) => `- ${memory.content}`).join('\n')
                memoryPrompt += '\n'
              }
            }
          }
        }

        console.log('[Memory] Long-term memory prompt:', memoryPrompt)

        // 添加到系统提示词
        result = `${result}\n\n${memoryPrompt}`
        hasContent = true
      }
    }
  }

  if (hasContent) {
    console.log('[Memory] Final prompt with memories applied')
  } else {
    console.log('[Memory] No memories to apply')
  }

  // 添加工作区信息
  try {
    const { enhancePromptWithWorkspaceInfo } = await import('./WorkspaceAIService')
    result = await enhancePromptWithWorkspaceInfo(result)
  } catch (error) {
    console.error('[Memory] Error adding workspace info:', error)
  }

  // 添加历史对话上下文
  if (topicId) {
    try {
      const { analyzeAndSelectHistoricalContext } = await import('./HistoricalContextService')
      const historicalContext = await analyzeAndSelectHistoricalContext(topicId)

      if (historicalContext) {
        console.log('[Memory] Adding historical context from topic:', historicalContext.sourceTopicId)
        result = `${result}\n\n以下是之前的相关对话，可能对回答当前问题有帮助：\n\n${historicalContext.content}`
      }
    } catch (error) {
      console.error('[Memory] Error adding historical context:', error)
    }
  }

  return result
}
