import { useSettings } from '@renderer/hooks/useSettings'
import agentService, { AgentState } from '@renderer/services/AgentService'
import { useAppDispatch } from '@renderer/store' // Import useAppDispatch
import { setAgentAutoExecutionCount, setEnableAgentMode, setShowAgentTaskList } from '@renderer/store/settings' // Import new actions
import { FC, useEffect, useState } from 'react'

import AgentModePanel from './AgentModePanel'

interface Props {
  messageId?: string // 将 messageId 设为可选参数
  scrollToMessage?: (messageId: string) => void // 添加 scrollToMessage prop
}

const AgentModePanelContainer: FC<Props> = ({
  /* messageId - 未使用但保留作为API */
  scrollToMessage // 解构 scrollToMessage prop
}) => {
  const { enableAgentMode, showAgentTaskList, agentAutoExecutionCount } = useSettings()
  const dispatch = useAppDispatch() // 获取 dispatch 函数
  const [agentState, setAgentState] = useState<AgentState>(agentService.getState())

  // 添加设置 Agent 任务列表显示状态的函数
  const handleSetShowAgentTaskList = (show: boolean) => {
    console.log('更新任务列表显示状态:', show)
    dispatch(setShowAgentTaskList(show))
  }

  // 添加设置 Agent 自动执行次数的函数
  const handleSetAgentAutoExecutionCount = (count: number) => {
    dispatch(setAgentAutoExecutionCount(count))
  }

  useEffect(() => {
    // 监听Agent状态变化
    const handleAgentStateChange = (state: AgentState) => {
      setAgentState({ ...state })
      // 添加调试日志
      console.log('AgentModePanelContainer - Agent状态更新:', {
        isRunning: state.isRunning,
        tasksCount: state.tasks.length,
        tasks: state.tasks
      })
    }

    agentService.addListener(handleAgentStateChange)

    return () => {
      agentService.removeListener(handleAgentStateChange)
    }
  }, [])

  // 添加调试日志，监控关键状态变化
  useEffect(() => {
    console.log('AgentModePanelContainer 状态检查:', {
      enableAgentMode,
      showAgentTaskList,
      agentAutoExecutionCount,
      tasks: agentState.tasks,
      isRunning: agentState.isRunning
    })
  }, [enableAgentMode, showAgentTaskList, agentAutoExecutionCount, agentState])

  // 始终显示面板，即使未启用Agent模式或没有任务
  // 注释掉原来的条件渲染逻辑
  // if (!enableAgentMode || agentState.tasks.length === 0) {
  //   return null
  // }

  // 确保在模态对话框中显示面板时，Agent模式已启用
  useEffect(() => {
    if (!enableAgentMode) {
      dispatch(setEnableAgentMode(true))
    }
  }, [dispatch, enableAgentMode])

  const handleTaskClick = (taskId: string, messageId: string) => {
    console.log('任务点击:', { taskId, messageId })
    const taskIndex = agentState.tasks.findIndex((task) => task.id === taskId)
    if (taskIndex !== -1) {
      agentService.setCurrentTask(taskIndex)
    }
    // 如果提供了 scrollToMessage 函数和 messageId，则滚动到对应消息
    if (scrollToMessage && messageId) {
      scrollToMessage(messageId)
    }
  }

  const handleFinish = () => {
    agentService.stopAgent()
  }

  return (
    <AgentModePanel
      tasks={agentState.tasks}
      onTaskClick={handleTaskClick}
      onFinish={handleFinish}
      isRunning={agentState.isRunning}
      scrollToMessage={scrollToMessage} // 传递 scrollToMessage prop
      showAgentTaskList={showAgentTaskList} // 传递 showAgentTaskList 设置
      agentAutoExecutionCount={agentAutoExecutionCount} // 传递 agentAutoExecutionCount 设置
      onSetShowAgentTaskList={handleSetShowAgentTaskList} // 传递设置 showAgentTaskList 的函数
      onSetAgentAutoExecutionCount={handleSetAgentAutoExecutionCount} // 传递设置 agentAutoExecutionCount 的函数
    />
  )
}

export default AgentModePanelContainer
