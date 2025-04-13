import { createSlice, PayloadAction } from '@reduxjs/toolkit'
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
}

// 短记忆项接口
export interface ShortMemory {
  id: string
  content: string
  createdAt: string
  topicId: string // 关联的对话话题ID
  analyzedMessageIds?: string[] // 记录该记忆是从哪些消息中分析出来的
  lastMessageId?: string // 分析时的最后一条消息的ID，用于跟踪分析进度
}

export interface MemoryState {
  memoryLists: MemoryList[] // 记忆列表
  memories: Memory[] // 所有记忆项
  shortMemories: ShortMemory[] // 短记忆项
  currentListId: string | null // 当前选中的记忆列表ID
  isActive: boolean // 记忆功能是否激活
  shortMemoryActive: boolean // 短记忆功能是否激活
  autoAnalyze: boolean // 是否自动分析
  analyzeModel: string | null // 用于长期记忆分析的模型ID
  shortMemoryAnalyzeModel: string | null // 用于短期记忆分析的模型ID
  lastAnalyzeTime: number | null // 上次分析时间
  isAnalyzing: boolean // 是否正在分析
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
  currentListId: defaultList.id,
  isActive: true,
  shortMemoryActive: true, // 默认启用短记忆功能
  autoAnalyze: true,
  analyzeModel: 'gpt-3.5-turbo', // 设置默认长期记忆分析模型
  shortMemoryAnalyzeModel: 'gpt-3.5-turbo', // 设置默认短期记忆分析模型
  lastAnalyzeTime: null,
  isAnalyzing: false
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
        topicId: action.payload.topicId
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

    // 设置长期记忆分析模型
    setAnalyzeModel: (state, action: PayloadAction<string | null>) => {
      state.analyzeModel = action.payload
    },

    // 设置短期记忆分析模型
    setShortMemoryAnalyzeModel: (state, action: PayloadAction<string | null>) => {
      state.shortMemoryAnalyzeModel = action.payload
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
      }>
    ) => {
      const newShortMemory: ShortMemory = {
        id: nanoid(),
        content: action.payload.content,
        createdAt: new Date().toISOString(),
        topicId: action.payload.topicId,
        analyzedMessageIds: action.payload.analyzedMessageIds,
        lastMessageId: action.payload.lastMessageId
      }

      // 确保 shortMemories 存在
      if (!state.shortMemories) {
        state.shortMemories = []
      }

      state.shortMemories.push(newShortMemory)
    },

    // 删除短记忆
    deleteShortMemory: (state, action: PayloadAction<string>) => {
      // 确保 shortMemories 存在
      if (!state.shortMemories) {
        state.shortMemories = []
        return
      }

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

    // 设置短记忆功能是否激活
    setShortMemoryActive: (state, action: PayloadAction<boolean>) => {
      state.shortMemoryActive = action.payload
    }
  }
})

export const {
  addMemory,
  deleteMemory,
  editMemory,
  setMemoryActive,
  setAutoAnalyze,
  setAnalyzeModel,
  setShortMemoryAnalyzeModel,
  setAnalyzing,
  importMemories,
  clearMemories,
  addMemoryList,
  deleteMemoryList,
  editMemoryList,
  setCurrentMemoryList,
  toggleMemoryListActive,
  // 短记忆相关的action
  addShortMemory,
  deleteShortMemory,
  clearShortMemories,
  setShortMemoryActive
} = memorySlice.actions

export default memorySlice.reducer
