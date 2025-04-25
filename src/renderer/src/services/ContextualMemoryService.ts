// src/renderer/src/services/ContextualMemoryService.ts

import { TopicManager } from '@renderer/hooks/useTopic'
import { fetchGenerate } from '@renderer/services/ApiService'
import store from '@renderer/store'
import { addMemoryRetrievalLatency } from '@renderer/store/memory'
import { Message } from '@renderer/types'

import { vectorService } from './VectorService'

// 记忆项接口（从store/memory.ts导入）
interface Memory {
  id: string
  content: string
  createdAt: string
  source?: string
  category?: string
  listId: string
  analyzedMessageIds?: string[]
  lastMessageId?: string
  topicId?: string
  vector?: number[]
  entities?: string[]
  keywords?: string[]
  importance?: number
  accessCount?: number
  lastAccessedAt?: string
  decayFactor?: number
  freshness?: number
}

interface ShortMemory {
  id: string
  content: string
  createdAt: string
  topicId: string
  analyzedMessageIds?: string[]
  lastMessageId?: string
  vector?: number[]
  entities?: string[]
  keywords?: string[]
  importance?: number
  accessCount?: number
  lastAccessedAt?: string
  decayFactor?: number
  freshness?: number
}

// 记忆推荐结果接口
export interface MemoryRecommendation {
  memory: Memory | ShortMemory
  relevanceScore: number
  source: 'long-term' | 'short-term'
  matchReason?: string
}

/**
 * ContextualMemoryService 类负责实现上下文感知的记忆推荐和检索功能
 */
class ContextualMemoryService {
  /**
   * 基于当前对话上下文推荐相关记忆
   * @param messages - 当前对话的消息列表
   * @param topicId - 当前对话的话题ID
   * @param limit - 返回的最大记忆数量
   * @returns 推荐的记忆列表，按相关性排序
   */
  async getContextualMemoryRecommendations(
    messages: Message[],
    topicId: string,
    limit: number = 5
  ): Promise<MemoryRecommendation[]> {
    console.log(`[ContextualMemory] Getting contextual memory recommendations for topic ${topicId}`)

    const startTime = performance.now()

    try {
      // 获取当前状态
      const state = store.getState()
      const memoryState = state.memory

      if (!memoryState) {
        console.log('[ContextualMemory] Memory state not available')
        return []
      }

      // 检查记忆功能是否激活
      if (!memoryState.isActive && !memoryState.shortMemoryActive) {
        console.log('[ContextualMemory] Memory features are not active')
        return []
      }

      // 获取最近的消息作为上下文
      const recentMessages = messages.slice(-5)
      if (recentMessages.length === 0) {
        console.log('[ContextualMemory] No recent messages available')
        return []
      }

      // 构建上下文查询文本
      const contextQuery = this._buildContextQuery(recentMessages)
      console.log(`[ContextualMemory] Context query: ${contextQuery}`)

      // 并行获取长期记忆和短期记忆的推荐
      const [longTermRecommendations, shortTermRecommendations] = await Promise.all([
        this._getLongTermMemoryRecommendations(contextQuery, topicId),
        this._getShortTermMemoryRecommendations(contextQuery, topicId)
      ])

      // 合并并排序推荐结果
      const allRecommendations = [...longTermRecommendations, ...shortTermRecommendations]

      // 按相关性分数排序
      allRecommendations.sort((a, b) => b.relevanceScore - a.relevanceScore)

      // 限制返回数量
      const limitedRecommendations = allRecommendations.slice(0, limit)

      // 记录性能指标
      const endTime = performance.now()
      const latency = endTime - startTime
      store.dispatch(addMemoryRetrievalLatency(latency))

      console.log(
        `[ContextualMemory] Found ${limitedRecommendations.length} recommendations in ${latency.toFixed(2)}ms`
      )

      return limitedRecommendations
    } catch (error) {
      console.error('[ContextualMemory] Error getting contextual memory recommendations:', error)
      return []
    }
  }

  /**
   * 基于当前对话主题自动提取相关记忆
   * @param topicId - 当前对话的话题ID
   * @param limit - 返回的最大记忆数量
   * @returns 与当前主题相关的记忆列表
   */
  async getTopicRelatedMemories(topicId: string, limit: number = 10): Promise<MemoryRecommendation[]> {
    console.log(`[ContextualMemory] Getting topic-related memories for topic ${topicId}`)

    try {
      // 获取当前状态
      const state = store.getState()
      const memoryState = state.memory
      const messagesState = state.messages

      if (!memoryState || !messagesState) {
        console.log('[ContextualMemory] Required state not available')
        return []
      }

      // 获取话题信息
      // 使用TopicManager获取话题
      let topicQuery = ''
      try {
        const topic = await TopicManager.getTopic(topicId)
        if (!topic) {
          console.log(`[ContextualMemory] Topic ${topicId} not found`)
          return []
        }

        // 使用话题ID作为查询
        // 注意：TopicManager.getTopic返回的类型只有id和messages属性
        topicQuery = `Topic ${topicId}`
        if (!topicQuery.trim()) {
          console.log('[ContextualMemory] No topic information available for query')
          return []
        }
      } catch (error) {
        console.error(`[ContextualMemory] Error getting topic ${topicId}:`, error)
        return []
      }

      console.log(`[ContextualMemory] Topic query: ${topicQuery}`)

      // 并行获取长期记忆和短期记忆的推荐
      const [longTermRecommendations, shortTermRecommendations] = await Promise.all([
        this._getLongTermMemoryRecommendations(topicQuery, topicId),
        this._getShortTermMemoryRecommendations(topicQuery, topicId)
      ])

      // 合并并排序推荐结果
      const allRecommendations = [...longTermRecommendations, ...shortTermRecommendations]

      // 按相关性分数排序
      allRecommendations.sort((a, b) => b.relevanceScore - a.relevanceScore)

      // 限制返回数量
      const limitedRecommendations = allRecommendations.slice(0, limit)

      console.log(`[ContextualMemory] Found ${limitedRecommendations.length} topic-related memories`)

      return limitedRecommendations
    } catch (error) {
      console.error('[ContextualMemory] Error getting topic-related memories:', error)
      return []
    }
  }

  /**
   * 使用语义搜索查找与查询相关的记忆
   * @param query - 搜索查询
   * @param limit - 返回的最大记忆数量
   * @returns 与查询相关的记忆列表
   */
  async searchMemoriesBySemantics(query: string, limit: number = 10): Promise<MemoryRecommendation[]> {
    console.log(`[ContextualMemory] Semantic search for: ${query}`)

    try {
      // 获取当前状态
      const state = store.getState()
      const memoryState = state.memory

      if (!memoryState) {
        console.log('[ContextualMemory] Memory state not available')
        return []
      }

      // 并行获取长期记忆和短期记忆的推荐
      const [longTermRecommendations, shortTermRecommendations] = await Promise.all([
        this._getLongTermMemoryRecommendations(query),
        this._getShortTermMemoryRecommendations(query)
      ])

      // 合并并排序推荐结果
      const allRecommendations = [...longTermRecommendations, ...shortTermRecommendations]

      // 按相关性分数排序
      allRecommendations.sort((a, b) => b.relevanceScore - a.relevanceScore)

      // 限制返回数量
      const limitedRecommendations = allRecommendations.slice(0, limit)

      console.log(`[ContextualMemory] Found ${limitedRecommendations.length} memories matching query`)

      return limitedRecommendations
    } catch (error) {
      console.error('[ContextualMemory] Error searching memories by semantics:', error)
      return []
    }
  }

  /**
   * 使用AI分析当前对话上下文，提取关键信息并推荐相关记忆
   * @param messages - 当前对话的消息列表
   * @param limit - 返回的最大记忆数量
   * @returns 基于AI分析的相关记忆推荐
   */
  async getAIEnhancedMemoryRecommendations(messages: Message[], limit: number = 5): Promise<MemoryRecommendation[]> {
    console.log('[ContextualMemory] Getting AI-enhanced memory recommendations')

    try {
      // 获取当前状态
      const state = store.getState()
      const memoryState = state.memory

      if (!memoryState) {
        console.log('[ContextualMemory] Memory state not available')
        return []
      }

      // 获取分析模型
      const analyzeModel = memoryState.analyzeModel
      if (!analyzeModel) {
        console.log('[ContextualMemory] No analyze model set')
        return []
      }

      // 获取最近的消息作为上下文
      const recentMessages = messages.slice(-10)
      if (recentMessages.length === 0) {
        console.log('[ContextualMemory] No recent messages available')
        return []
      }

      // 构建对话内容
      const conversation = recentMessages.map((msg) => `${msg.role || 'user'}: ${msg.content || ''}`).join('\n')

      // 从Redux状态中获取自定义提示词
      const customContextualPrompt = store.getState().memory?.contextualMemoryPrompt

      // 构建提示词
      const prompt =
        customContextualPrompt ||
        `
请分析以下对话内容，提取出关键信息和主题，以便我可以找到相关的记忆。

请提供：
1. 对话的主要主题
2. 用户可能关心的关键信息点
3. 可能与此对话相关的背景知识或上下文

请以简洁的关键词和短语形式回答，每行一个要点，不要使用编号或项目符号。

对话内容:
${conversation}
`

      // 调用AI生成文本
      console.log('[ContextualMemory] Calling AI for context analysis...')
      const result = await fetchGenerate({
        prompt: prompt,
        content: conversation,
        modelId: analyzeModel
      })

      if (!result || typeof result !== 'string' || result.trim() === '') {
        console.log('[ContextualMemory] No valid result from AI analysis')
        return []
      }

      // 提取关键信息
      const keyPoints = result
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && !line.startsWith('-'))

      console.log('[ContextualMemory] Extracted key points:', keyPoints)

      // 使用提取的关键信息作为查询
      const enhancedQuery = keyPoints.join(' ')

      // 获取相关记忆
      return await this.searchMemoriesBySemantics(enhancedQuery, limit)
    } catch (error) {
      console.error('[ContextualMemory] Error getting AI-enhanced memory recommendations:', error)
      return []
    }
  }

  /**
   * 构建上下文查询文本
   * @param messages - 消息列表
   * @returns 构建的查询文本
   * @private
   */
  private _buildContextQuery(messages: Message[]): string {
    // 提取最近消息的内容
    const messageContents = messages.map((msg) => msg.content || '').filter((content) => content.trim() !== '')

    // 如果没有有效内容，返回空字符串
    if (messageContents.length === 0) {
      return ''
    }

    // 合并消息内容，最多使用最近的3条消息
    return messageContents.slice(-3).join(' ')
  }

  /**
   * 获取与查询相关的长期记忆推荐
   * @param query - 查询文本
   * @param topicId - 可选的话题ID，用于过滤记忆
   * @returns 长期记忆推荐列表
   * @private
   */
  private async _getLongTermMemoryRecommendations(query: string, topicId?: string): Promise<MemoryRecommendation[]> {
    // 获取当前状态
    const state = store.getState()
    const memoryState = state.memory

    // 检查长期记忆功能是否激活
    if (!memoryState || !memoryState.isActive) {
      return []
    }

    // 获取所有激活的记忆列表
    const activeListIds = memoryState.memoryLists.filter((list) => list.isActive).map((list) => list.id)

    if (activeListIds.length === 0) {
      return []
    }

    // 获取激活列表中的记忆
    const memories = memoryState.memories.filter((memory) => activeListIds.includes(memory.listId))

    if (memories.length === 0) {
      return []
    }

    // 使用向量服务查找相似记忆
    const results = await vectorService.findSimilarMemoriesToQuery(
      query,
      memories,
      20, // 获取更多结果，后续会进一步优化排序
      0.5 // 降低阈值以获取更多潜在相关记忆
    )

    // 转换为推荐格式
    const recommendations: MemoryRecommendation[] = results.map((result) => ({
      memory: result.memory as Memory,
      relevanceScore: result.similarity,
      source: 'long-term',
      matchReason: '语义相似'
    }))

    // 应用高级排序优化
    return this._optimizeRelevanceRanking(recommendations, query, topicId)
  }

  /**
   * 获取与查询相关的短期记忆推荐
   * @param query - 查询文本
   * @param topicId - 可选的话题ID，用于过滤记忆
   * @returns 短期记忆推荐列表
   * @private
   */
  private async _getShortTermMemoryRecommendations(query: string, topicId?: string): Promise<MemoryRecommendation[]> {
    // 获取当前状态
    const state = store.getState()
    const memoryState = state.memory

    // 检查短期记忆功能是否激活
    if (!memoryState || !memoryState.shortMemoryActive) {
      return []
    }

    // 获取短期记忆
    let shortMemories = memoryState.shortMemories

    // 如果指定了话题ID，只获取该话题的短期记忆
    if (topicId) {
      shortMemories = shortMemories.filter((memory) => memory.topicId === topicId)
    }

    if (shortMemories.length === 0) {
      return []
    }

    // 使用向量服务查找相似记忆
    const results = await vectorService.findSimilarMemoriesToQuery(
      query,
      shortMemories,
      20, // 获取更多结果，后续会进一步优化排序
      0.5 // 降低阈值以获取更多潜在相关记忆
    )

    // 转换为推荐格式
    const recommendations: MemoryRecommendation[] = results.map((result) => ({
      memory: result.memory as ShortMemory,
      relevanceScore: result.similarity,
      source: 'short-term',
      matchReason: '与当前对话相关'
    }))

    // 应用高级排序优化
    return this._optimizeRelevanceRanking(recommendations, query, topicId)
  }

  /**
   * 优化记忆推荐的相关性排序
   * @param recommendations - 初始推荐列表
   * @param query - 查询文本
   * @param topicId - 可选的话题ID
   * @returns 优化排序后的推荐列表
   * @private
   */
  private _optimizeRelevanceRanking(
    recommendations: MemoryRecommendation[],
    query: string,
    topicId?: string
  ): MemoryRecommendation[] {
    if (recommendations.length === 0) {
      return []
    }

    // 获取当前状态
    const state = store.getState()
    const memoryState = state.memory

    // 应用多因素排序优化
    return recommendations
      .map((rec) => {
        const memory = rec.memory
        let adjustedScore = rec.relevanceScore

        // 1. 考虑记忆的重要性
        if (memory.importance && memoryState.priorityManagementEnabled) {
          adjustedScore *= 1 + memory.importance * 0.5 // 重要性最多提升50%的分数
        }

        // 2. 考虑记忆的鲜度
        if (memory.freshness && memoryState.freshnessEnabled) {
          adjustedScore *= 1 + memory.freshness * 0.3 // 鲜度最多提升30%的分数
        }

        // 3. 考虑记忆的衰减因子
        if (memory.decayFactor && memoryState.decayEnabled) {
          adjustedScore *= memory.decayFactor // 直接应用衰减因子
        }

        // 4. 如果记忆与当前话题相关，提高分数
        if (topicId && memory.topicId === topicId) {
          adjustedScore *= 1.2 // 提高20%的分数
        }

        // 5. 考虑访问频率，常用的记忆可能更相关
        if (memory.accessCount && memory.accessCount > 0) {
          // 访问次数越多，提升越大，但有上限
          const accessBoost = Math.min(memory.accessCount / 10, 0.2) // 最多提升20%
          adjustedScore *= 1 + accessBoost
        }

        // 6. 考虑关键词匹配
        if (memory.keywords && memory.keywords.length > 0) {
          const queryLower = query.toLowerCase()
          const keywordMatches = memory.keywords.filter((keyword) => queryLower.includes(keyword.toLowerCase())).length

          if (keywordMatches > 0) {
            // 关键词匹配越多，提升越大
            const keywordBoost = Math.min(keywordMatches * 0.1, 0.3) // 最多提升30%
            adjustedScore *= 1 + keywordBoost
          }
        }

        // 返回调整后的推荐
        return {
          ...rec,
          relevanceScore: adjustedScore
        }
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore) // 按调整后的分数重新排序
  }
}

// 导出 ContextualMemoryService 的单例
export const contextualMemoryService = new ContextualMemoryService()
