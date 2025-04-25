import { createSelector } from '@reduxjs/toolkit'
import { useMemoryService } from '@renderer/services/MemoryService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import store from '@renderer/store'
import {
  clearShortMemories,
  loadLongTermMemoryData,
  loadMemoryData,
  setAdaptiveAnalysisEnabled,
  setAnalysisDepth,
  setAnalysisFrequency,
  setAutoAnalyze,
  setAutoRecommendMemories,
  setContextualRecommendationEnabled,
  setCurrentMemoryList,
  setDecayEnabled,
  setDecayRate,
  setFreshnessEnabled,
  setInterestTrackingEnabled,
  setMemoryActive,
  setMonitoringEnabled,
  setPriorityManagementEnabled,
  setRecommendationThreshold,
  setShortMemoryActive
} from '@renderer/store/memory'
import { FC, ReactNode, useEffect, useRef } from 'react'

interface MemoryProviderProps {
  children: ReactNode
}

/**
 * 记忆功能提供者组件
 * 这个组件负责初始化记忆功能并在适当的时候触发记忆分析
 */
const MemoryProvider: FC<MemoryProviderProps> = ({ children }) => {
  console.log('[MemoryProvider] Initializing memory provider')
  const { analyzeAndAddMemories } = useMemoryService()
  const dispatch = useAppDispatch()

  // 从 Redux 获取记忆状态
  const isActive = useAppSelector((state) => state.memory?.isActive || false)
  const autoAnalyze = useAppSelector((state) => state.memory?.autoAnalyze || false)
  const analyzeModel = useAppSelector((state) => state.memory?.analyzeModel || null)
  const shortMemoryActive = useAppSelector((state) => state.memory?.shortMemoryActive || false)

  // 直接从 Redux 获取当前话题 ID，不使用可能导致警告的选择器
  const currentTopic = useAppSelector((state) => state.messages?.currentTopic?.id)

  // 创建记忆化选择器，只保留有实际转换逻辑的选择器
  const selectMessagesForTopic = createSelector(
    [(state) => state.messages?.messagesByTopic, (_state, topicId) => topicId],
    (messagesByTopic, topicId) => {
      if (!topicId || !messagesByTopic) {
        return []
      }
      return messagesByTopic[topicId] || []
    }
  )

  // 获取当前话题的消息
  const messages = useAppSelector((state) => selectMessagesForTopic(state, currentTopic))

  // 存储上一次的话题ID
  const previousTopicRef = useRef<string | null>(null)

  // 添加一个 ref 来存储上次分析时的消息数量
  const lastAnalyzedCountRef = useRef(0)

  // 在组件挂载时加载记忆数据和设置
  useEffect(() => {
    console.log('[MemoryProvider] Loading memory data from file')
    // 使用Redux Thunk加载短期记忆数据
    dispatch(loadMemoryData())
      .then((result) => {
        if (result.payload) {
          console.log('[MemoryProvider] Short-term memory data loaded successfully via Redux Thunk')

          // 更新所有设置
          const data = result.payload

          // 基本设置
          if (data.isActive !== undefined) dispatch(setMemoryActive(data.isActive))
          if (data.shortMemoryActive !== undefined) dispatch(setShortMemoryActive(data.shortMemoryActive))
          if (data.autoAnalyze !== undefined) dispatch(setAutoAnalyze(data.autoAnalyze))

          // 自适应分析相关
          if (data.adaptiveAnalysisEnabled !== undefined)
            dispatch(setAdaptiveAnalysisEnabled(data.adaptiveAnalysisEnabled))
          if (data.analysisFrequency !== undefined) dispatch(setAnalysisFrequency(data.analysisFrequency))
          if (data.analysisDepth !== undefined) dispatch(setAnalysisDepth(data.analysisDepth))

          // 用户关注点相关
          if (data.interestTrackingEnabled !== undefined)
            dispatch(setInterestTrackingEnabled(data.interestTrackingEnabled))

          // 性能监控相关
          if (data.monitoringEnabled !== undefined) dispatch(setMonitoringEnabled(data.monitoringEnabled))

          // 智能优先级与时效性管理相关
          if (data.priorityManagementEnabled !== undefined)
            dispatch(setPriorityManagementEnabled(data.priorityManagementEnabled))
          if (data.decayEnabled !== undefined) dispatch(setDecayEnabled(data.decayEnabled))
          if (data.freshnessEnabled !== undefined) dispatch(setFreshnessEnabled(data.freshnessEnabled))
          if (data.decayRate !== undefined) dispatch(setDecayRate(data.decayRate))

          // 上下文感知记忆推荐相关
          if (data.contextualRecommendationEnabled !== undefined)
            dispatch(setContextualRecommendationEnabled(data.contextualRecommendationEnabled))
          if (data.autoRecommendMemories !== undefined) dispatch(setAutoRecommendMemories(data.autoRecommendMemories))
          if (data.recommendationThreshold !== undefined)
            dispatch(setRecommendationThreshold(data.recommendationThreshold))

          console.log('[MemoryProvider] Memory settings loaded successfully')
        } else {
          console.log('[MemoryProvider] No short-term memory data loaded or loading failed')
        }
      })
      .catch((error) => {
        console.error('[MemoryProvider] Error loading short-term memory data:', error)
      })

    // 使用Redux Thunk加载长期记忆数据
    dispatch(loadLongTermMemoryData())
      .then((result) => {
        if (result.payload) {
          console.log('[MemoryProvider] Long-term memory data loaded successfully via Redux Thunk')

          // 确保在长期记忆数据加载后，检查并设置当前记忆列表
          setTimeout(() => {
            const state = store.getState().memory
            if (!state.currentListId && state.memoryLists && state.memoryLists.length > 0) {
              // 先尝试找到一个isActive为true的列表
              const activeList = state.memoryLists.find((list) => list.isActive)
              if (activeList) {
                console.log('[MemoryProvider] Auto-selecting active memory list:', activeList.name)
                dispatch(setCurrentMemoryList(activeList.id))
              } else {
                // 如果没有激活的列表，使用第一个列表
                console.log('[MemoryProvider] Auto-selecting first memory list:', state.memoryLists[0].name)
                dispatch(setCurrentMemoryList(state.memoryLists[0].id))
              }
            }
          }, 500) // 添加一个小延迟，确保状态已更新
        } else {
          console.log('[MemoryProvider] No long-term memory data loaded or loading failed')
        }
      })
      .catch((error) => {
        console.error('[MemoryProvider] Error loading long-term memory data:', error)
      })
  }, [dispatch])

  // 当对话更新时，触发记忆分析
  useEffect(() => {
    if (isActive && autoAnalyze && analyzeModel && messages.length > 0) {
      // 获取当前的分析频率
      const memoryState = store.getState().memory || {}
      const analysisFrequency = memoryState.analysisFrequency || 5
      const adaptiveAnalysisEnabled = memoryState.adaptiveAnalysisEnabled || false

      // 检查是否有新消息需要分析
      const newMessagesCount = messages.length - lastAnalyzedCountRef.current

      // 使用自适应分析频率
      if (
        newMessagesCount >= analysisFrequency ||
        (messages.length % analysisFrequency === 0 && lastAnalyzedCountRef.current === 0)
      ) {
        console.log(
          `[Memory Analysis] Triggering analysis with ${newMessagesCount} new messages (frequency: ${analysisFrequency})`
        )

        // 将当前话题ID传递给分析函数
        analyzeAndAddMemories(currentTopic)
        lastAnalyzedCountRef.current = messages.length

        // 性能监控：记录当前分析触发时的消息数量
        if (adaptiveAnalysisEnabled) {
          console.log(`[Memory Analysis] Adaptive analysis enabled, current frequency: ${analysisFrequency}`)
        }
      }
    }
  }, [isActive, autoAnalyze, analyzeModel, messages.length, analyzeAndAddMemories, currentTopic])

  // 当对话话题切换时，清除上一个话题的短记忆
  useEffect(() => {
    // 如果短记忆功能激活且当前话题发生变化
    if (shortMemoryActive && currentTopic !== previousTopicRef.current && previousTopicRef.current) {
      console.log(`[Memory] Topic changed from ${previousTopicRef.current} to ${currentTopic}, clearing short memories`)
      // 清除上一个话题的短记忆
      dispatch(clearShortMemories(previousTopicRef.current))
    }

    // 更新上一次的话题ID
    previousTopicRef.current = currentTopic || null
  }, [currentTopic, shortMemoryActive, dispatch])

  // 监控记忆列表变化，确保总是有一个选中的记忆列表
  useEffect(() => {
    // 立即检查一次
    const checkAndSetMemoryList = () => {
      const state = store.getState().memory
      if (state.memoryLists && state.memoryLists.length > 0) {
        // 如果没有选中的记忆列表，或者选中的列表不存在
        if (!state.currentListId || !state.memoryLists.some((list) => list.id === state.currentListId)) {
          // 先尝试找到一个isActive为true的列表
          const activeList = state.memoryLists.find((list) => list.isActive)
          if (activeList) {
            console.log('[MemoryProvider] Setting active memory list:', activeList.name)
            dispatch(setCurrentMemoryList(activeList.id))
          } else if (state.memoryLists.length > 0) {
            // 如果没有激活的列表，使用第一个列表
            console.log('[MemoryProvider] Setting first memory list:', state.memoryLists[0].name)
            dispatch(setCurrentMemoryList(state.memoryLists[0].id))
          }
        }
      }
    }

    // 立即检查一次
    checkAndSetMemoryList()

    // 设置定时器，每秒检查一次，持续5秒
    const intervalId = setInterval(checkAndSetMemoryList, 1000)
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId)
    }, 5000)

    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
    }
  }, [dispatch])

  return <>{children}</>
}

export default MemoryProvider
