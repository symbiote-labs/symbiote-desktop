import { useMemoryService } from '@renderer/services/MemoryService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { clearShortMemories } from '@renderer/store/memory'
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

  // 获取当前对话
  const currentTopic = useAppSelector((state) => state.messages?.currentTopic?.id)
  const messages = useAppSelector((state) => {
    if (!currentTopic || !state.messages?.messagesByTopic) {
      return []
    }
    return state.messages.messagesByTopic[currentTopic] || []
  })

  // 存储上一次的话题ID
  const previousTopicRef = useRef<string | null>(null)

  // 添加一个 ref 来存储上次分析时的消息数量
  const lastAnalyzedCountRef = useRef(0)

  // 当对话更新时，触发记忆分析
  useEffect(() => {
    if (isActive && autoAnalyze && analyzeModel && messages.length > 0) {
      // 检查是否有新消息需要分析
      const newMessagesCount = messages.length - lastAnalyzedCountRef.current

      // 当有 5 条或更多新消息，或者消息数量是 5 的倍数且从未分析过时触发分析
      if (newMessagesCount >= 5 || (messages.length % 5 === 0 && lastAnalyzedCountRef.current === 0)) {
        console.log(`[Memory Analysis] Triggering analysis with ${newMessagesCount} new messages`)
        // 将当前话题ID传递给分析函数
        analyzeAndAddMemories(currentTopic)
        lastAnalyzedCountRef.current = messages.length
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
    previousTopicRef.current = currentTopic
  }, [currentTopic, shortMemoryActive, dispatch])

  return <>{children}</>
}

export default MemoryProvider
