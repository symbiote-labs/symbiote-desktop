import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import store, { RootState } from '@renderer/store'
import { nanoid } from 'nanoid'

// 记忆列表接口
export interface MemoryList {
  id: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
  isActive: boolean // 是否在对话中使用该记忆列表
}

// 记忆项接口
export interface Memory {
  id: string
  content: string
  createdAt: string
  source?: string // 来源，例如"自动分析"或"手动添加"
  category?: string // 分类，例如"用户偏好"、"技术需求"等
  listId: string // 所属的记忆列表ID
  analyzedMessageIds?: string[] // 记录该记忆是从哪些消息中分析出来的
  lastMessageId?: string // 分析时的最后一条消息的ID，用于跟踪分析进度
  topicId?: string // 关联的对话话题ID，用于跟踪该记忆来自哪个话题
  vector?: number[] // 记忆的向量表示，用于语义搜索
  entities?: string[] // 记忆中提取的实体
  keywords?: string[] // 记忆中提取的关键词
  importance?: number // 记忆的重要性评分（0-1）
  accessCount?: number // 记忆被访问的次数
  lastAccessedAt?: string // 记忆最后被访问的时间
  decayFactor?: number // 记忆衰减因子（0-1），值越小衰减越大
  freshness?: number // 记忆鲜度评分（0-1），基于创建时间和最后访问时间
}

// 短记忆项接口
export interface ShortMemory {
  id: string
  content: string
  createdAt: string
  topicId: string // 关联的对话话题ID
  analyzedMessageIds?: string[] // 记录该记忆是从哪些消息中分析出来的
  lastMessageId?: string // 分析时的最后一条消息的ID，用于跟踪分析进度
  vector?: number[] // 记忆的向量表示，用于语义搜索
  entities?: string[] // 记忆中提取的实体
  keywords?: string[] // 记忆中提取的关键词
  importance?: number // 记忆的重要性评分（0-1）
  accessCount?: number // 记忆被访问的次数
  lastAccessedAt?: string // 记忆最后被访问的时间
  decayFactor?: number // 记忆衰减因子（0-1），值越小衰减越快
  freshness?: number // 记忆鲜度评分（0-1），基于创建时间和最后访问时间
}

// 助手记忆项接口
export interface AssistantMemory {
  id: string
  content: string
  createdAt: string
  assistantId: string // 关联的助手ID
  analyzedMessageIds?: string[] // 记录该记忆是从哪些消息中分析出来的
  lastMessageId?: string // 分析时的最后一条消息的ID，用于跟踪分析进度
  vector?: number[] // 记忆的向量表示，用于语义搜索
  entities?: string[] // 记忆中提取的实体
  keywords?: string[] // 记忆中提取的关键词
  importance?: number // 记忆的重要性评分（0-1）
  accessCount?: number // 记忆被访问的次数
  lastAccessedAt?: string // 记忆最后被访问的时间
  decayFactor?: number // 记忆衰减因子（0-1），值越小衰减越快
  freshness?: number // 记忆鲜度评分（0-1），基于创建时间和最后访问时间
}

// 分析统计数据接口
export interface AnalysisStats {
  totalAnalyses: number // 总分析次数
  successfulAnalyses: number // 成功分析次数（生成了新记忆）
  newMemoriesGenerated: number // 生成的新记忆数量
  averageAnalysisTime: number // 平均分析时间（毫秒）
  lastAnalysisTime: number // 上次分析时间戳
}

// 性能指标接口
export interface PerformanceMetrics {
  analysisLatency: number[] // 最近的分析延迟时间（毫秒）
  memoryRetrievalLatency: number[] // 最近的记忆检索延迟时间（毫秒）
  memoryCount: number // 当前记忆数量
  shortMemoryCount: number // 当前短期记忆数量
  lastPerformanceCheck: number // 上次性能检查时间
}

// 用户关注点接口
export interface UserInterest {
  topic: string // 关注主题
  weight: number // 权重（0-1）
  lastUpdated: string // 上次更新时间
}

// 记忆推荐结果接口
export interface MemoryRecommendation {
  memoryId: string
  relevanceScore: number
  source: 'long-term' | 'short-term' | 'assistant'
  matchReason?: string
}

export interface MemoryState {
  memoryLists: MemoryList[] // 记忆列表
  memories: Memory[] // 所有记忆项
  shortMemories: ShortMemory[] // 短记忆项
  assistantMemories: AssistantMemory[] // 助手记忆项
  currentListId: string | null // 当前选中的记忆列表ID
  isActive: boolean // 记忆功能是否激活
  shortMemoryActive: boolean // 短记忆功能是否激活
  assistantMemoryActive: boolean // 助手记忆功能是否激活
  autoAnalyze: boolean // 是否自动分析
  filterSensitiveInfo: boolean // 是否过滤敏感信息
  analyzeModel: string | null // 用于长期记忆分析的模型ID
  shortMemoryAnalyzeModel: string | null // 用于短期记忆分析的模型ID
  assistantMemoryAnalyzeModel: string | null // 用于助手记忆分析的模型ID
  historicalContextAnalyzeModel: string | null // 用于历史对话上下文分析的模型ID
  vectorizeModel: string | null // 用于向量化的模型ID
  lastAnalyzeTime: number | null // 上次分析时间
  isAnalyzing: boolean // 是否正在分析

  // 提示词相关
  longTermMemoryPrompt: string | null // 长期记忆分析提示词
  shortTermMemoryPrompt: string | null // 短期记忆分析提示词
  assistantMemoryPrompt: string | null // 助手记忆分析提示词
  contextualMemoryPrompt: string | null // 上下文记忆分析提示词
  historicalContextPrompt: string | null // 历史对话上下文分析提示词

  // 自适应分析相关
  adaptiveAnalysisEnabled: boolean // 是否启用自适应分析
  analysisFrequency: number // 分析频率（消息数）
  analysisDepth: 'low' | 'medium' | 'high' // 分析深度
  analysisStats: AnalysisStats // 分析统计数据

  // 用户关注点相关
  interestTrackingEnabled: boolean // 是否启用兴趣跟踪
  userInterests: UserInterest[] // 用户关注点

  // 性能监控相关
  monitoringEnabled: boolean // 是否启用性能监控
  performanceMetrics: PerformanceMetrics // 性能指标

  // 智能优先级与时效性管理相关
  priorityManagementEnabled: boolean // 是否启用智能优先级管理
  decayEnabled: boolean // 是否启用记忆衰减功能
  freshnessEnabled: boolean // 是否启用记忆鲜度评估
  decayRate: number // 记忆衰减速率（0-1）
  lastPriorityUpdate: number // 上次优先级更新时间

  // 上下文感知记忆推荐相关
  contextualRecommendationEnabled: boolean // 是否启用上下文感知记忆推荐
  autoRecommendMemories: boolean // 是否自动推荐记忆
  recommendationThreshold: number // 推荐阈值（0-1）
  currentRecommendations: MemoryRecommendation[] // 当前的记忆推荐
  isRecommending: boolean // 是否正在推荐记忆
  lastRecommendTime: number | null // 上次推荐时间
}

// 创建默认记忆列表
const defaultList: MemoryList = {
  id: nanoid(),
  name: '默认记忆',
  description: '系统默认的记忆列表',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  isActive: true
}

const initialState: MemoryState = {
  memoryLists: [defaultList],
  memories: [],
  shortMemories: [], // 初始化空的短记忆数组
  assistantMemories: [], // 初始化空的助手记忆数组
  currentListId: defaultList.id,
  isActive: true,
  shortMemoryActive: true, // 默认启用短记忆功能
  assistantMemoryActive: true, // 默认启用助手记忆功能
  autoAnalyze: true,
  filterSensitiveInfo: true, // 默认启用敏感信息过滤
  analyzeModel: 'gpt-3.5-turbo', // 设置默认长期记忆分析模型
  shortMemoryAnalyzeModel: 'gpt-3.5-turbo', // 设置默认短期记忆分析模型
  assistantMemoryAnalyzeModel: 'gpt-3.5-turbo', // 设置默认助手记忆分析模型
  historicalContextAnalyzeModel: 'gpt-3.5-turbo', // 设置默认历史对话上下文分析模型
  vectorizeModel: 'gpt-3.5-turbo', // 设置默认向量化模型
  lastAnalyzeTime: null,
  isAnalyzing: false,

  // 提示词相关 - 默认为null，将在服务中使用默认提示词
  longTermMemoryPrompt: null,
  shortTermMemoryPrompt: null,
  assistantMemoryPrompt: null,
  contextualMemoryPrompt: null,
  historicalContextPrompt: null,

  // 自适应分析相关
  adaptiveAnalysisEnabled: true, // 默认启用自适应分析
  analysisFrequency: 5, // 默认每5条消息分析一次
  analysisDepth: 'medium', // 默认分析深度
  analysisStats: {
    totalAnalyses: 0,
    successfulAnalyses: 0,
    newMemoriesGenerated: 0,
    averageAnalysisTime: 0,
    lastAnalysisTime: 0
  },

  // 用户关注点相关
  interestTrackingEnabled: true, // 默认启用兴趣跟踪
  userInterests: [],

  // 性能监控相关
  monitoringEnabled: true, // 默认启用性能监控
  performanceMetrics: {
    analysisLatency: [],
    memoryRetrievalLatency: [],
    memoryCount: 0,
    shortMemoryCount: 0,
    lastPerformanceCheck: Date.now()
  },

  // 智能优先级与时效性管理相关
  priorityManagementEnabled: true, // 默认启用智能优先级管理
  decayEnabled: true, // 默认启用记忆衰减功能
  freshnessEnabled: true, // 默认启用记忆鲜度评估
  decayRate: 0.05, // 默认衰减速率，每天减少5%
  lastPriorityUpdate: Date.now(), // 初始化为当前时间

  // 上下文感知记忆推荐相关
  contextualRecommendationEnabled: true, // 默认启用上下文感知记忆推荐
  autoRecommendMemories: true, // 默认自动推荐记忆
  recommendationThreshold: 0.7, // 默认推荐阈值
  currentRecommendations: [], // 初始化空的推荐列表
  isRecommending: false, // 初始化为非推荐状态
  lastRecommendTime: null // 初始化为空
}

const memorySlice = createSlice({
  name: 'memory',
  initialState,
  reducers: {
    // 添加新记忆
    addMemory: (
      state,
      action: PayloadAction<{
        content: string
        source?: string
        category?: string
        listId?: string
        analyzedMessageIds?: string[]
        lastMessageId?: string
        topicId?: string
        importance?: number // 新增重要性评分
        keywords?: string[] // 新增关键词
      }>
    ) => {
      // 确保 memoryLists 存在
      if (!state.memoryLists) {
        state.memoryLists = [defaultList]
      }

      // 使用指定的列表ID或当前选中的列表ID
      const listId =
        action.payload.listId ||
        state.currentListId ||
        (state.memoryLists.length > 0 ? state.memoryLists[0].id : defaultList.id)

      const newMemory: Memory = {
        id: nanoid(),
        content: action.payload.content,
        createdAt: new Date().toISOString(),
        source: action.payload.source || '手动添加',
        category: action.payload.category,
        listId: listId,
        analyzedMessageIds: action.payload.analyzedMessageIds,
        lastMessageId: action.payload.lastMessageId,
        topicId: action.payload.topicId,
        importance: action.payload.importance, // 添加重要性评分
        keywords: action.payload.keywords // 添加关键词
      }

      // 确保 memories 存在
      if (!state.memories) {
        state.memories = []
      }
      state.memories.push(newMemory)

      // 更新记忆列表的更新时间
      const list = state.memoryLists.find((list) => list.id === listId)
      if (list) {
        list.updatedAt = new Date().toISOString()
      }
    },

    // 删除记忆
    deleteMemory: (state, action: PayloadAction<string>) => {
      // 确保 memories 存在
      if (!state.memories) {
        state.memories = []
        return
      }
      state.memories = state.memories.filter((memory) => memory.id !== action.payload)
    },

    // 编辑记忆
    editMemory: (state, action: PayloadAction<{ id: string; content: string }>) => {
      // 确保 memories 存在
      if (!state.memories) {
        state.memories = []
        return
      }

      const memory = state.memories.find((m) => m.id === action.payload.id)
      if (memory) {
        memory.content = action.payload.content
      }
    },

    // 设置记忆功能是否激活
    setMemoryActive: (state, action: PayloadAction<boolean>) => {
      state.isActive = action.payload
    },

    // 设置是否自动分析
    setAutoAnalyze: (state, action: PayloadAction<boolean>) => {
      state.autoAnalyze = action.payload
    },

    // 设置是否过滤敏感信息
    setFilterSensitiveInfo: (state, action: PayloadAction<boolean>) => {
      state.filterSensitiveInfo = action.payload
    },

    // 设置长期记忆分析模型
    setAnalyzeModel: (state, action: PayloadAction<string | null>) => {
      state.analyzeModel = action.payload
    },

    // 设置短期记忆分析模型
    setShortMemoryAnalyzeModel: (state, action: PayloadAction<string | null>) => {
      state.shortMemoryAnalyzeModel = action.payload
    },

    // 设置助手记忆分析模型
    setAssistantMemoryAnalyzeModel: (state, action: PayloadAction<string | null>) => {
      state.assistantMemoryAnalyzeModel = action.payload
    },

    // 设置历史对话上下文分析模型
    setHistoricalContextAnalyzeModel: (state, action: PayloadAction<string | null>) => {
      state.historicalContextAnalyzeModel = action.payload
    },
    // 设置向量化模型
    setVectorizeModel: (state, action: PayloadAction<string | null>) => {
      state.vectorizeModel = action.payload
    },

    // 设置长期记忆分析提示词
    setLongTermMemoryPrompt: (state, action: PayloadAction<string | null>) => {
      state.longTermMemoryPrompt = action.payload
    },

    // 设置短期记忆分析提示词
    setShortTermMemoryPrompt: (state, action: PayloadAction<string | null>) => {
      state.shortTermMemoryPrompt = action.payload
    },

    // 设置助手记忆分析提示词
    setAssistantMemoryPrompt: (state, action: PayloadAction<string | null>) => {
      state.assistantMemoryPrompt = action.payload
    },

    // 设置上下文记忆分析提示词
    setContextualMemoryPrompt: (state, action: PayloadAction<string | null>) => {
      state.contextualMemoryPrompt = action.payload
    },

    // 设置历史对话上下文分析提示词
    setHistoricalContextPrompt: (state, action: PayloadAction<string | null>) => {
      state.historicalContextPrompt = action.payload
    },

    // 设置分析状态
    setAnalyzing: (state, action: PayloadAction<boolean>) => {
      state.isAnalyzing = action.payload
      if (action.payload) {
        state.lastAnalyzeTime = Date.now()
      }
    },

    // 批量添加记忆（用于导入）
    importMemories: (state, action: PayloadAction<{ memories: Memory[]; listId?: string }>) => {
      // 确保 memoryLists 存在
      if (!state.memoryLists) {
        state.memoryLists = [defaultList]
      }

      const listId =
        action.payload.listId ||
        state.currentListId ||
        (state.memoryLists.length > 0 ? state.memoryLists[0].id : defaultList.id)

      // 确保 memories 存在
      if (!state.memories) {
        state.memories = []
      }

      // 合并记忆，避免重复
      const existingContents = new Set(state.memories.map((m) => m.content))
      const newMemories = action.payload.memories
        .filter((m) => !existingContents.has(m.content))
        .map((m) => ({ ...m, listId })) // 确保所有导入的记忆都有正确的列表ID

      state.memories = [...state.memories, ...newMemories]

      // 更新记忆列表的更新时间
      const list = state.memoryLists.find((list) => list.id === listId)
      if (list) {
        list.updatedAt = new Date().toISOString()
      }
    },

    // 清空指定列表的记忆
    clearMemories: (state, action: PayloadAction<string | undefined>) => {
      // 确保 memories 存在
      if (!state.memories) {
        state.memories = []
        return
      }

      const listId = action.payload || state.currentListId

      if (listId) {
        // 清空指定列表的记忆
        state.memories = state.memories.filter((memory) => memory.listId !== listId)
      } else {
        // 清空所有记忆
        state.memories = []
      }
    },

    // 添加新的记忆列表
    addMemoryList: (state, action: PayloadAction<{ name: string; description?: string; isActive?: boolean }>) => {
      const newList: MemoryList = {
        id: nanoid(),
        name: action.payload.name,
        description: action.payload.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: action.payload.isActive ?? false
      }
      // 确保 memoryLists 存在
      if (!state.memoryLists) {
        state.memoryLists = []
      }
      state.memoryLists.push(newList)
    },

    // 删除记忆列表
    deleteMemoryList: (state, action: PayloadAction<string>) => {
      // 确保 memoryLists 存在
      if (!state.memoryLists) {
        state.memoryLists = []
        return
      }

      // 删除列表
      state.memoryLists = state.memoryLists.filter((list) => list.id !== action.payload)

      // 删除该列表下的所有记忆
      if (state.memories) {
        state.memories = state.memories.filter((memory) => memory.listId !== action.payload)
      }

      // 如果删除的是当前选中的列表，则切换到第一个列表
      if (state.currentListId === action.payload) {
        state.currentListId = state.memoryLists.length > 0 ? state.memoryLists[0].id : null
      }
    },

    // 编辑记忆列表
    editMemoryList: (state, action: PayloadAction<{ id: string; name?: string; description?: string }>) => {
      // 确保 memoryLists 存在
      if (!state.memoryLists) {
        state.memoryLists = []
        return
      }

      const list = state.memoryLists.find((list) => list.id === action.payload.id)
      if (list) {
        if (action.payload.name) list.name = action.payload.name
        if (action.payload.description !== undefined) list.description = action.payload.description
        list.updatedAt = new Date().toISOString()
      }
    },

    // 设置当前选中的记忆列表
    setCurrentMemoryList: (state, action: PayloadAction<string>) => {
      // 确保 memoryLists 存在
      if (!state.memoryLists) {
        state.memoryLists = []
      }
      state.currentListId = action.payload
    },

    // 切换记忆列表的激活状态
    toggleMemoryListActive: (state, action: PayloadAction<{ id: string; isActive: boolean }>) => {
      // 确保 memoryLists 存在
      if (!state.memoryLists) {
        state.memoryLists = []
        return
      }

      const list = state.memoryLists.find((list) => list.id === action.payload.id)
      if (list) {
        list.isActive = action.payload.isActive
        list.updatedAt = new Date().toISOString()
      }
    },

    // 添加短记忆
    addShortMemory: (
      state,
      action: PayloadAction<{
        content: string
        topicId: string
        analyzedMessageIds?: string[]
        lastMessageId?: string
        importance?: number // 新增重要性评分
        keywords?: string[] // 新增关键词
      }>
    ) => {
      const newShortMemory: ShortMemory = {
        id: nanoid(),
        content: action.payload.content,
        createdAt: new Date().toISOString(),
        topicId: action.payload.topicId,
        analyzedMessageIds: action.payload.analyzedMessageIds,
        lastMessageId: action.payload.lastMessageId,
        importance: action.payload.importance, // 添加重要性评分
        keywords: action.payload.keywords // 添加关键词
      }

      // 确保 shortMemories 存在
      if (!state.shortMemories) {
        state.shortMemories = []
      }

      state.shortMemories.push(newShortMemory)
    },

    // 添加助手记忆
    addAssistantMemory: (
      state,
      action: PayloadAction<{
        content: string
        assistantId: string
        analyzedMessageIds?: string[]
        lastMessageId?: string
        importance?: number // 重要性评分
        keywords?: string[] // 关键词
      }>
    ) => {
      const newAssistantMemory: AssistantMemory = {
        id: nanoid(),
        content: action.payload.content,
        createdAt: new Date().toISOString(),
        assistantId: action.payload.assistantId,
        analyzedMessageIds: action.payload.analyzedMessageIds,
        lastMessageId: action.payload.lastMessageId,
        importance: action.payload.importance,
        keywords: action.payload.keywords
      }

      // 确保 assistantMemories 存在
      if (!state.assistantMemories) {
        state.assistantMemories = []
      }

      state.assistantMemories.push(newAssistantMemory)
    },

    // 删除短记忆
    deleteShortMemory: (state, action: PayloadAction<string>) => {
      // 确保 shortMemories 存在
      if (!state.shortMemories) {
        state.shortMemories = []
        return
      }

      // 找到要删除的记忆
      const memoryToDelete = state.shortMemories.find((memory) => memory.id === action.payload)

      // 如果找到了要删除的记忆，并且它有分析过的消息ID
      if (memoryToDelete && memoryToDelete.analyzedMessageIds && memoryToDelete.analyzedMessageIds.length > 0) {
        // 获取要删除的记忆的消息ID
        const messageIdsToCheck = new Set(memoryToDelete.analyzedMessageIds)

        // 检查其他记忆是否也引用了这些消息ID
        // 创建一个映射，记录每个消息ID被引用的次数
        const messageIdReferences = new Map<string, number>()

        // 统计所有记忆中每个消息ID的引用次数
        state.shortMemories.forEach((memory) => {
          if (memory.id !== action.payload && memory.analyzedMessageIds) {
            // 排除要删除的记忆
            memory.analyzedMessageIds.forEach((msgId) => {
              if (messageIdsToCheck.has(msgId)) {
                // 只关注要删除的记忆中的消息ID
                messageIdReferences.set(msgId, (messageIdReferences.get(msgId) || 0) + 1)
              }
            })
          }
        })

        // 找出没有被其他记忆引用的消息ID
        const unusedMessageIds = Array.from(messageIdsToCheck).filter((msgId) => !messageIdReferences.has(msgId))

        if (unusedMessageIds.length > 0) {
          console.log(
            `[Memory] Found ${unusedMessageIds.length} message IDs that are no longer referenced by any memory`
          )

          // 将这些消息ID标记为未分析，以便下次分析时重新分析这些消息
          // 注意：我们不需要显式地清除标记，因为分析逻辑会检查消息ID是否在任何记忆的analyzedMessageIds中
          // 如果消息ID不再被任何记忆引用，它将自动被视为未分析
        }

        // 记录日志，方便调试
        console.log(`[Memory] Deleting short memory with ${messageIdsToCheck.size} analyzed message IDs`)
      }

      // 删除记忆
      state.shortMemories = state.shortMemories.filter((memory) => memory.id !== action.payload)
    },

    // 清空指定话题的短记忆
    clearShortMemories: (state, action: PayloadAction<string | undefined>) => {
      // 确保 shortMemories 存在
      if (!state.shortMemories) {
        state.shortMemories = []
        return
      }

      const topicId = action.payload

      if (topicId) {
        // 清空指定话题的短记忆
        state.shortMemories = state.shortMemories.filter((memory) => memory.topicId !== topicId)
      } else {
        // 清空所有短记忆
        state.shortMemories = []
      }
    },

    // 删除助手记忆
    deleteAssistantMemory: (state, action: PayloadAction<string>) => {
      // 确保 assistantMemories 存在
      if (!state.assistantMemories) {
        state.assistantMemories = []
        return
      }

      // 找到要删除的记忆
      const memoryToDelete = state.assistantMemories.find((memory) => memory.id === action.payload)

      // 如果找到了要删除的记忆，并且它有分析过的消息ID
      if (memoryToDelete && memoryToDelete.analyzedMessageIds && memoryToDelete.analyzedMessageIds.length > 0) {
        // 记录日志，方便调试
        console.log(
          `[Memory] Deleting assistant memory with ${memoryToDelete.analyzedMessageIds.length} analyzed message IDs`
        )
      }

      // 删除记忆
      state.assistantMemories = state.assistantMemories.filter((memory) => memory.id !== action.payload)
    },

    // 清空指定助手的记忆
    clearAssistantMemories: (state, action: PayloadAction<string | undefined>) => {
      // 确保 assistantMemories 存在
      if (!state.assistantMemories) {
        state.assistantMemories = []
        return
      }

      const assistantId = action.payload

      if (assistantId) {
        // 清空指定助手的记忆
        state.assistantMemories = state.assistantMemories.filter((memory) => memory.assistantId !== assistantId)
      } else {
        // 清空所有助手记忆
        state.assistantMemories = []
      }
    },

    // 设置短记忆功能是否激活
    setShortMemoryActive: (state, action: PayloadAction<boolean>) => {
      state.shortMemoryActive = action.payload
    },

    // 设置助手记忆功能是否激活
    setAssistantMemoryActive: (state, action: PayloadAction<boolean>) => {
      state.assistantMemoryActive = action.payload
    },

    // 自适应分析相关的reducer
    setAdaptiveAnalysisEnabled: (state, action: PayloadAction<boolean>) => {
      state.adaptiveAnalysisEnabled = action.payload
    },

    setAnalysisFrequency: (state, action: PayloadAction<number>) => {
      state.analysisFrequency = action.payload
    },

    setAnalysisDepth: (state, action: PayloadAction<'low' | 'medium' | 'high'>) => {
      state.analysisDepth = action.payload
    },

    updateAnalysisStats: (state, action: PayloadAction<Partial<AnalysisStats>>) => {
      state.analysisStats = { ...state.analysisStats, ...action.payload }
    },

    // 用户关注点相关的reducer
    setInterestTrackingEnabled: (state, action: PayloadAction<boolean>) => {
      state.interestTrackingEnabled = action.payload
    },

    updateUserInterest: (state, action: PayloadAction<UserInterest>) => {
      const index = state.userInterests.findIndex((i) => i.topic === action.payload.topic)
      if (index >= 0) {
        state.userInterests[index] = action.payload
      } else {
        state.userInterests.push(action.payload)
      }
    },

    // 性能监控相关的reducer
    setMonitoringEnabled: (state, action: PayloadAction<boolean>) => {
      state.monitoringEnabled = action.payload
    },

    updatePerformanceMetrics: (state, action: PayloadAction<Partial<PerformanceMetrics>>) => {
      state.performanceMetrics = { ...state.performanceMetrics, ...action.payload }
    },

    addAnalysisLatency: (state, action: PayloadAction<number>) => {
      // 确保 performanceMetrics 存在
      if (!state.performanceMetrics) {
        state.performanceMetrics = {
          analysisLatency: [],
          memoryRetrievalLatency: [],
          memoryCount: 0,
          shortMemoryCount: 0,
          lastPerformanceCheck: Date.now()
        }
      }

      // 确保 analysisLatency 存在
      if (!state.performanceMetrics.analysisLatency) {
        state.performanceMetrics.analysisLatency = []
      }

      const latencies = [...state.performanceMetrics.analysisLatency, action.payload].slice(-10) // 保留最近10次
      state.performanceMetrics.analysisLatency = latencies
    },

    addMemoryRetrievalLatency: (state, action: PayloadAction<number>) => {
      // 确保 performanceMetrics 存在
      if (!state.performanceMetrics) {
        state.performanceMetrics = {
          analysisLatency: [],
          memoryRetrievalLatency: [],
          memoryCount: 0,
          shortMemoryCount: 0,
          lastPerformanceCheck: Date.now()
        }
      }

      // 确保 memoryRetrievalLatency 存在
      if (!state.performanceMetrics.memoryRetrievalLatency) {
        state.performanceMetrics.memoryRetrievalLatency = []
      }

      const latencies = [...state.performanceMetrics.memoryRetrievalLatency, action.payload].slice(-10) // 保留最近10次
      state.performanceMetrics.memoryRetrievalLatency = latencies
    },

    // 智能优先级与时效性管理相关的reducer
    setPriorityManagementEnabled: (state, action: PayloadAction<boolean>) => {
      state.priorityManagementEnabled = action.payload
    },

    setDecayEnabled: (state, action: PayloadAction<boolean>) => {
      state.decayEnabled = action.payload
    },

    setFreshnessEnabled: (state, action: PayloadAction<boolean>) => {
      state.freshnessEnabled = action.payload
    },

    setDecayRate: (state, action: PayloadAction<number>) => {
      state.decayRate = action.payload
    },

    // 更新记忆优先级
    updateMemoryPriorities: (state) => {
      const now = Date.now()

      // 更新长期记忆优先级
      if (state.memories && state.memories.length > 0) {
        state.memories.forEach((memory) => {
          // 计算时间衰减因子
          if (state.decayEnabled && memory.lastAccessedAt) {
            const daysSinceLastAccess = (now - new Date(memory.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
            const decayFactor = Math.max(0, 1 - daysSinceLastAccess * state.decayRate)
            memory.decayFactor = decayFactor
          } else {
            memory.decayFactor = 1 // 无衰减
          }

          // 计算鲜度评分
          if (state.freshnessEnabled) {
            const daysSinceCreation = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            const lastAccessDays = memory.lastAccessedAt
              ? (now - new Date(memory.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
              : daysSinceCreation

            // 鲜度评分结合创建时间和最后访问时间
            const creationFreshness = Math.max(0, 1 - daysSinceCreation / 30) // 30天内创建的记忆较新
            const accessFreshness = Math.max(0, 1 - lastAccessDays / 7) // 7天内访问的记忆较新
            memory.freshness = creationFreshness * 0.3 + accessFreshness * 0.7 // 加权平均
          }
        })
      }

      // 更新短期记忆优先级
      if (state.shortMemories && state.shortMemories.length > 0) {
        state.shortMemories.forEach((memory) => {
          // 计算时间衰减因子
          if (state.decayEnabled && memory.lastAccessedAt) {
            const hoursSinceLastAccess = (now - new Date(memory.lastAccessedAt).getTime()) / (1000 * 60 * 60)
            const decayFactor = Math.max(0, 1 - hoursSinceLastAccess * state.decayRate * 4) // 短期记忆衰减更快
            memory.decayFactor = decayFactor
          } else {
            memory.decayFactor = 1 // 无衰减
          }

          // 计算鲜度评分
          if (state.freshnessEnabled) {
            const hoursSinceCreation = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60)
            const lastAccessHours = memory.lastAccessedAt
              ? (now - new Date(memory.lastAccessedAt).getTime()) / (1000 * 60 * 60)
              : hoursSinceCreation

            // 短期记忆的鲜度评分更注重最近性
            const creationFreshness = Math.max(0, 1 - hoursSinceCreation / 24) // 24小时内创建的记忆较新
            const accessFreshness = Math.max(0, 1 - lastAccessHours / 6) // 6小时内访问的记忆较新
            memory.freshness = creationFreshness * 0.2 + accessFreshness * 0.8 // 加权平均，更注重访问时间
          }
        })
      }

      // 更新助手记忆优先级
      if (state.assistantMemories && state.assistantMemories.length > 0) {
        state.assistantMemories.forEach((memory) => {
          // 计算时间衰减因子
          if (state.decayEnabled && memory.lastAccessedAt) {
            const daysSinceLastAccess = (now - new Date(memory.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
            const decayFactor = Math.max(0, 1 - daysSinceLastAccess * state.decayRate * 2) // 助手记忆衰减速度介于长期和短期记忆之间
            memory.decayFactor = decayFactor
          } else {
            memory.decayFactor = 1 // 无衰减
          }

          // 计算鲜度评分
          if (state.freshnessEnabled) {
            const daysSinceCreation = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            const lastAccessDays = memory.lastAccessedAt
              ? (now - new Date(memory.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
              : daysSinceCreation

            // 助手记忆的鲜度评分
            const creationFreshness = Math.max(0, 1 - daysSinceCreation / 15) // 15天内创建的记忆较新
            const accessFreshness = Math.max(0, 1 - lastAccessDays / 3) // 3天内访问的记忆较新
            memory.freshness = creationFreshness * 0.3 + accessFreshness * 0.7 // 加权平均
          }
        })
      }

      state.lastPriorityUpdate = now
    },

    // 更新记忆鲜度
    updateMemoryFreshness: (state) => {
      if (!state.freshnessEnabled) return

      const now = Date.now()

      // 更新长期记忆鲜度
      if (state.memories && state.memories.length > 0) {
        state.memories.forEach((memory) => {
          const daysSinceCreation = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          const lastAccessDays = memory.lastAccessedAt
            ? (now - new Date(memory.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
            : daysSinceCreation

          const creationFreshness = Math.max(0, 1 - daysSinceCreation / 30)
          const accessFreshness = Math.max(0, 1 - lastAccessDays / 7)
          memory.freshness = creationFreshness * 0.3 + accessFreshness * 0.7
        })
      }

      // 更新短期记忆鲜度
      if (state.shortMemories && state.shortMemories.length > 0) {
        state.shortMemories.forEach((memory) => {
          const hoursSinceCreation = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60)
          const lastAccessHours = memory.lastAccessedAt
            ? (now - new Date(memory.lastAccessedAt).getTime()) / (1000 * 60 * 60)
            : hoursSinceCreation

          const creationFreshness = Math.max(0, 1 - hoursSinceCreation / 24)
          const accessFreshness = Math.max(0, 1 - lastAccessHours / 6)
          memory.freshness = creationFreshness * 0.2 + accessFreshness * 0.8
        })
      }

      // 更新助手记忆鲜度
      if (state.assistantMemories && state.assistantMemories.length > 0) {
        state.assistantMemories.forEach((memory) => {
          const daysSinceCreation = (now - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          const lastAccessDays = memory.lastAccessedAt
            ? (now - new Date(memory.lastAccessedAt).getTime()) / (1000 * 60 * 60 * 24)
            : daysSinceCreation

          const creationFreshness = Math.max(0, 1 - daysSinceCreation / 15)
          const accessFreshness = Math.max(0, 1 - lastAccessDays / 3)
          memory.freshness = creationFreshness * 0.3 + accessFreshness * 0.7
        })
      }
    },

    // 记录记忆访问
    accessMemory: (
      state,
      action: PayloadAction<{ id: string; isShortMemory?: boolean; isAssistantMemory?: boolean }>
    ) => {
      const { id, isShortMemory, isAssistantMemory } = action.payload
      const now = new Date().toISOString()

      if (isShortMemory) {
        // 更新短期记忆访问信息
        const memory = state.shortMemories?.find((m) => m.id === id)
        if (memory) {
          memory.accessCount = (memory.accessCount || 0) + 1
          memory.lastAccessedAt = now
        }
      } else if (isAssistantMemory) {
        // 更新助手记忆访问信息
        const memory = state.assistantMemories?.find((m) => m.id === id)
        if (memory) {
          memory.accessCount = (memory.accessCount || 0) + 1
          memory.lastAccessedAt = now
        }
      } else {
        // 更新长期记忆访问信息
        const memory = state.memories?.find((m) => m.id === id)
        if (memory) {
          memory.accessCount = (memory.accessCount || 0) + 1
          memory.lastAccessedAt = now
        }
      }
    },

    // 设置上下文感知记忆推荐是否启用
    setContextualRecommendationEnabled: (state, action: PayloadAction<boolean>) => {
      state.contextualRecommendationEnabled = action.payload
    },

    // 直接设置记忆数组（用于重置分析标记等操作）
    setMemories: (state, action: PayloadAction<Memory[]>) => {
      state.memories = action.payload
    },

    // 设置是否自动推荐记忆
    setAutoRecommendMemories: (state, action: PayloadAction<boolean>) => {
      state.autoRecommendMemories = action.payload
    },

    // 设置推荐阈值
    setRecommendationThreshold: (state, action: PayloadAction<number>) => {
      state.recommendationThreshold = action.payload
    },

    // 更新当前的记忆推荐
    updateCurrentRecommendations: (state, action: PayloadAction<MemoryRecommendation[]>) => {
      state.currentRecommendations = action.payload
      state.lastRecommendTime = Date.now()
    },

    // 设置是否正在推荐记忆
    setRecommending: (state, action: PayloadAction<boolean>) => {
      state.isRecommending = action.payload
    },

    // 清除当前的记忆推荐
    clearCurrentRecommendations: (state) => {
      state.currentRecommendations = []
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadMemoryData.fulfilled, (state, action) => {
        if (action.payload) {
          // 更新状态中的记忆数据
          state.memoryLists = action.payload.memoryLists || state.memoryLists
          state.shortMemories = action.payload.shortMemories || state.shortMemories

          // 助手记忆数据
          if (action.payload.assistantMemories) {
            state.assistantMemories = action.payload.assistantMemories
            console.log('[Memory Reducer] Loaded assistant memories:', action.payload.assistantMemories.length)
          }

          // 助手记忆功能状态
          if (action.payload.assistantMemoryActive !== undefined) {
            state.assistantMemoryActive = action.payload.assistantMemoryActive
            console.log('[Memory Reducer] Loaded assistant memory active state:', action.payload.assistantMemoryActive)
          }

          // 更新模型选择
          if (action.payload.analyzeModel) {
            state.analyzeModel = action.payload.analyzeModel
            console.log('[Memory Reducer] Loaded analyze model:', action.payload.analyzeModel)
          }

          if (action.payload.shortMemoryAnalyzeModel) {
            state.shortMemoryAnalyzeModel = action.payload.shortMemoryAnalyzeModel
            console.log('[Memory Reducer] Loaded short memory analyze model:', action.payload.shortMemoryAnalyzeModel)
          }

          // 助手记忆分析模型
          if (action.payload.assistantMemoryAnalyzeModel) {
            state.assistantMemoryAnalyzeModel = action.payload.assistantMemoryAnalyzeModel
            console.log(
              '[Memory Reducer] Loaded assistant memory analyze model:',
              action.payload.assistantMemoryAnalyzeModel
            )
          }

          // 更新提示词状态
          if (action.payload.longTermMemoryPrompt !== undefined) {
            state.longTermMemoryPrompt = action.payload.longTermMemoryPrompt
            console.log('[Memory Reducer] Loaded longTermMemoryPrompt')
          }
          if (action.payload.shortTermMemoryPrompt !== undefined) {
            state.shortTermMemoryPrompt = action.payload.shortTermMemoryPrompt
            console.log('[Memory Reducer] Loaded shortTermMemoryPrompt')
          }
          if (action.payload.assistantMemoryPrompt !== undefined) {
            state.assistantMemoryPrompt = action.payload.assistantMemoryPrompt
            console.log('[Memory Reducer] Loaded assistantMemoryPrompt')
          }
          if (action.payload.contextualMemoryPrompt !== undefined) {
            state.contextualMemoryPrompt = action.payload.contextualMemoryPrompt
            console.log('[Memory Reducer] Loaded contextualMemoryPrompt')
          }
          if (action.payload.historicalContextPrompt !== undefined) {
            state.historicalContextPrompt = action.payload.historicalContextPrompt
            console.log('[Memory Reducer] Loaded historicalContextPrompt')
          }

          console.log('Short-term memory data loaded into state')
        }
      })
      .addCase(loadLongTermMemoryData.fulfilled, (state, action) => {
        if (action.payload) {
          // 更新状态中的长期记忆数据
          state.memoryLists = action.payload.memoryLists || state.memoryLists
          state.memories = action.payload.memories || state.memories

          // 更新模型选择
          if (action.payload.analyzeModel) {
            state.analyzeModel = action.payload.analyzeModel
            console.log('[Memory Reducer] Loaded long-term analyze model:', action.payload.analyzeModel)
          }

          // 自动选择默认的记忆列表
          if (!state.currentListId && state.memoryLists && state.memoryLists.length > 0) {
            // 先尝试找到一个isActive为true的列表
            const activeList = state.memoryLists.find((list) => list.isActive)
            if (activeList) {
              state.currentListId = activeList.id
              console.log('[Memory Reducer] Auto-selected active memory list:', activeList.name)
            } else {
              // 如果没有激活的列表，使用第一个列表
              state.currentListId = state.memoryLists[0].id
              console.log('[Memory Reducer] Auto-selected first memory list:', state.memoryLists[0].name)
            }
          }

          console.log('Long-term memory data loaded into state')

          if (action.payload.historicalContextAnalyzeModel) {
            state.historicalContextAnalyzeModel = action.payload.historicalContextAnalyzeModel
            console.log(
              '[Memory Reducer] Loaded historical context analyze model:',
              action.payload.historicalContextAnalyzeModel
            )
          } else {
            // 如果文件中没有historicalContextAnalyzeModel，使用shortMemoryAnalyzeModel或analyzeModel作为默认值
            state.historicalContextAnalyzeModel = state.shortMemoryAnalyzeModel || state.analyzeModel
            console.log(
              '[Memory Reducer] Using default model for historical context:',
              state.historicalContextAnalyzeModel
            )
          }

          if (action.payload.vectorizeModel) {
            state.vectorizeModel = action.payload.vectorizeModel
            console.log('[Memory Reducer] Loaded vectorize model:', action.payload.vectorizeModel)
          }

          console.log('Memory data loaded into state')
        }
      })
  }
})

export const {
  addMemory,
  deleteMemory,
  editMemory,
  setMemoryActive,
  setAutoAnalyze,
  setFilterSensitiveInfo,
  setAnalyzeModel,
  setShortMemoryAnalyzeModel,
  setAssistantMemoryAnalyzeModel,
  setHistoricalContextAnalyzeModel,
  setVectorizeModel,
  setAnalyzing,
  setLongTermMemoryPrompt,
  setShortTermMemoryPrompt,
  setAssistantMemoryPrompt,
  setContextualMemoryPrompt,
  setHistoricalContextPrompt,
  importMemories,
  clearMemories,
  addMemoryList,
  deleteMemoryList,
  editMemoryList,
  setCurrentMemoryList,
  toggleMemoryListActive,
  setMemories,
  // 短记忆相关的action
  addShortMemory,
  deleteShortMemory,
  clearShortMemories,
  setShortMemoryActive,
  // 助手记忆相关的action
  addAssistantMemory,
  deleteAssistantMemory,
  clearAssistantMemories,
  setAssistantMemoryActive,

  // 自适应分析相关的action
  setAdaptiveAnalysisEnabled,
  setAnalysisFrequency,
  setAnalysisDepth,
  updateAnalysisStats,

  // 用户关注点相关的action
  setInterestTrackingEnabled,
  updateUserInterest,

  // 性能监控相关的action
  setMonitoringEnabled,
  updatePerformanceMetrics,
  addAnalysisLatency,
  addMemoryRetrievalLatency,

  // 智能优先级与时效性管理相关的action
  setPriorityManagementEnabled,
  setDecayEnabled,
  setFreshnessEnabled,
  setDecayRate,
  updateMemoryPriorities,
  updateMemoryFreshness,
  accessMemory,

  // 上下文感知记忆推荐相关的action
  setContextualRecommendationEnabled,
  setAutoRecommendMemories,
  setRecommendationThreshold,
  updateCurrentRecommendations,
  setRecommending,
  clearCurrentRecommendations
} = memorySlice.actions

// 加载记忆数据的异步 thunk
export const loadMemoryData = createAsyncThunk(
  'memory/loadData',
  async () => {
    try {
      // log.info('Loading memory data from file...') // Removed direct log call from renderer
      const data = await window.api.memory.loadData()
      // log.info('Memory data loaded successfully') // Removed direct log call from renderer
      return data
    } catch (error) {
      console.error('Failed to load memory data:', error) // Use console.error instead of log.error
      return null // Ensure the thunk returns null on error
    }
  } // <-- Add missing closing brace for the async function
)

// 保存记忆数据的异步 thunk
export const saveMemoryData = createAsyncThunk(
  'memory/saveData',
  async (data: Partial<MemoryState> & { forceOverwrite?: boolean }) => {
    const { forceOverwrite, ...memoryData } = data
    try {
      console.log('[Memory] Saving memory data to file...', Object.keys(data))

      // 直接将传入的部分数据发送给主进程，不再合并完整状态
      console.log('[Memory] Sending partial memory data to main process:', memoryData)
      const result = await window.api.memory.saveData(memoryData, forceOverwrite)
      if (result) {
        console.log('[Memory] Partial memory data saved successfully via main process')
      } else {
        console.error('[Memory] Main process failed to save partial memory data')
      }
      return result
    } catch (error) {
      console.error('[Memory] Failed to save memory data:', error)
      return false
    }
  }
)

// 加载长期记忆数据的异步 thunk
export const loadLongTermMemoryData = createAsyncThunk('memory/loadLongTermData', async () => {
  try {
    console.log('[Long-term Memory] Loading long-term memory data from file...')
    const data = await window.api.memory.loadLongTermData()
    console.log('[Long-term Memory] Long-term memory data loaded successfully')
    return data
  } catch (error) {
    console.error('[Long-term Memory] Failed to load long-term memory data:', error)
    return null
  }
})

// 保存长期记忆数据的异步 thunk
export const saveLongTermMemoryData = createAsyncThunk(
  'memory/saveLongTermData',
  async (data: Partial<MemoryState> & { forceOverwrite?: boolean }) => {
    const { forceOverwrite, ...memoryData } = data
    try {
      console.log('[Long-term Memory] Saving long-term memory data to file...', Object.keys(data))

      // 如果是强制覆盖模式，直接使用传入的数据，不合并当前状态
      if (forceOverwrite) {
        console.log('[Long-term Memory] Force overwrite mode enabled, using provided data directly')
        const result = await window.api.memory.saveLongTermData(memoryData, forceOverwrite)
        console.log('[Long-term Memory] Long-term memory data saved successfully (force overwrite)')
        return result
      }

      // 非强制覆盖模式，确保数据完整性
      const state = store.getState().memory

      // 保存所有设置，而不仅仅是特定字段
      // 创建一个包含所有设置的对象
      const completeData = {
        // 基本设置
        isActive: memoryData.isActive !== undefined ? memoryData.isActive : state.isActive,
        autoAnalyze: memoryData.autoAnalyze !== undefined ? memoryData.autoAnalyze : state.autoAnalyze,
        filterSensitiveInfo:
          memoryData.filterSensitiveInfo !== undefined ? memoryData.filterSensitiveInfo : state.filterSensitiveInfo,

        // 模型选择
        analyzeModel: memoryData.analyzeModel || state.analyzeModel,

        // 提示词相关
        longTermMemoryPrompt:
          memoryData.longTermMemoryPrompt !== undefined ? memoryData.longTermMemoryPrompt : state.longTermMemoryPrompt,

        // 记忆数据
        memoryLists: memoryData.memoryLists || state.memoryLists,
        memories: memoryData.memories || state.memories,
        currentListId: memoryData.currentListId || state.currentListId,

        // 自适应分析相关
        adaptiveAnalysisEnabled:
          memoryData.adaptiveAnalysisEnabled !== undefined
            ? memoryData.adaptiveAnalysisEnabled
            : state.adaptiveAnalysisEnabled,
        analysisFrequency:
          memoryData.analysisFrequency !== undefined ? memoryData.analysisFrequency : state.analysisFrequency,
        analysisDepth: memoryData.analysisDepth || state.analysisDepth,

        // 用户关注点相关
        interestTrackingEnabled:
          memoryData.interestTrackingEnabled !== undefined
            ? memoryData.interestTrackingEnabled
            : state.interestTrackingEnabled,

        // 性能监控相关
        monitoringEnabled:
          memoryData.monitoringEnabled !== undefined ? memoryData.monitoringEnabled : state.monitoringEnabled,

        // 智能优先级与时效性管理相关
        priorityManagementEnabled:
          memoryData.priorityManagementEnabled !== undefined
            ? memoryData.priorityManagementEnabled
            : state.priorityManagementEnabled,
        decayEnabled: memoryData.decayEnabled !== undefined ? memoryData.decayEnabled : state.decayEnabled,
        freshnessEnabled:
          memoryData.freshnessEnabled !== undefined ? memoryData.freshnessEnabled : state.freshnessEnabled,
        decayRate: memoryData.decayRate !== undefined ? memoryData.decayRate : state.decayRate,

        // 上下文感知记忆推荐相关
        contextualRecommendationEnabled:
          memoryData.contextualRecommendationEnabled !== undefined
            ? memoryData.contextualRecommendationEnabled
            : state.contextualRecommendationEnabled,
        autoRecommendMemories:
          memoryData.autoRecommendMemories !== undefined
            ? memoryData.autoRecommendMemories
            : state.autoRecommendMemories,
        recommendationThreshold:
          memoryData.recommendationThreshold !== undefined
            ? memoryData.recommendationThreshold
            : state.recommendationThreshold
      }

      const result = await window.api.memory.saveLongTermData(completeData, forceOverwrite)
      console.log('[Long-term Memory] Long-term memory data saved successfully')
      return result
    } catch (error) {
      console.error('[Long-term Memory] Failed to save long-term memory data:', error)
      return false
    }
  }
)

// 保存所有记忆设置的函数
export const saveAllMemorySettings = createAsyncThunk('memory/saveAllSettings', async (_, { dispatch, getState }) => {
  try {
    const state = (getState() as RootState).memory

    // 创建一个包含所有设置的对象，但不包含记忆内容和记忆列表
    const settings = {
      // 基本设置
      isActive: state.isActive,
      shortMemoryActive: state.shortMemoryActive,
      assistantMemoryActive: state.assistantMemoryActive,
      autoAnalyze: state.autoAnalyze,

      // 模型选择
      analyzeModel: state.analyzeModel,
      shortMemoryAnalyzeModel: state.shortMemoryAnalyzeModel,
      assistantMemoryAnalyzeModel: state.assistantMemoryAnalyzeModel,
      historicalContextAnalyzeModel: state.historicalContextAnalyzeModel,
      vectorizeModel: state.vectorizeModel,

      // 提示词相关
      longTermMemoryPrompt: state.longTermMemoryPrompt,
      shortTermMemoryPrompt: state.shortTermMemoryPrompt,
      assistantMemoryPrompt: state.assistantMemoryPrompt,
      contextualMemoryPrompt: state.contextualMemoryPrompt,
      historicalContextPrompt: state.historicalContextPrompt,

      // 记忆数据
      assistantMemories: state.assistantMemories,

      // 自适应分析相关
      adaptiveAnalysisEnabled: state.adaptiveAnalysisEnabled,
      analysisFrequency: state.analysisFrequency,
      analysisDepth: state.analysisDepth,

      // 用户关注点相关
      interestTrackingEnabled: state.interestTrackingEnabled,

      // 性能监控相关
      monitoringEnabled: state.monitoringEnabled,

      // 智能优先级与时效性管理相关
      priorityManagementEnabled: state.priorityManagementEnabled,
      decayEnabled: state.decayEnabled,
      freshnessEnabled: state.freshnessEnabled,
      decayRate: state.decayRate,

      // 上下文感知记忆推荐相关
      contextualRecommendationEnabled: state.contextualRecommendationEnabled,
      autoRecommendMemories: state.autoRecommendMemories,
      recommendationThreshold: state.recommendationThreshold
    }

    const result = await dispatch(saveMemoryData(settings)).unwrap()
    console.log('[Memory] All memory settings saved successfully')
    return result
  } catch (error) {
    console.error('[Memory] Failed to save all memory settings:', error)
    throw error
  }
})

// Middleware removed to prevent duplicate saves triggered by batch additions.
// Explicit saves should be handled where needed, e.g., at the end of analysis functions.
export default memorySlice.reducer
