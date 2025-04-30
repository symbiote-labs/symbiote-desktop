import { useSettings } from '@renderer/hooks/useSettings'
import agentService from '@renderer/services/AgentService'
import { useAppDispatch } from '@renderer/store'
import { setAgentModeMaxApiRequests, setEnableAgentMode } from '@renderer/store/settings'
import { Button, Flex, InputNumber, Space, Switch, Tooltip } from 'antd' // Import Switch and Tooltip
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import AgentTaskList, { AgentTask } from './AgentTaskList'

interface Props {
  tasks: AgentTask[]
  onTaskClick?: (taskId: string, messageId: string) => void // 修改参数类型为 taskId 和 messageId
  onFinish?: () => void
  isRunning: boolean
  scrollToMessage?: (messageId: string) => void // 添加 scrollToMessage prop
  showAgentTaskList: boolean // 添加 showAgentTaskList prop
  agentAutoExecutionCount: number // 添加 agentAutoExecutionCount prop
  onSetShowAgentTaskList: (show: boolean) => void // 添加设置 showAgentTaskList 的函数 prop
  onSetAgentAutoExecutionCount: (count: number) => void // 添加设置 agentAutoExecutionCount 的函数 prop
}

const AgentModePanel: FC<Props> = ({
  tasks,
  onTaskClick,
  onFinish,
  isRunning,
  scrollToMessage,
  showAgentTaskList, // 解构新的 prop
  agentAutoExecutionCount, // 解构新的 prop
  onSetShowAgentTaskList, // 解构新的 prop
  onSetAgentAutoExecutionCount // 解构新的 prop
}) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { agentModeMaxApiRequests } = useSettings()
  const [maxRequests, setMaxRequests] = useState(agentModeMaxApiRequests)

  // 添加调试日志，监控AgentModePanel的props和渲染条件
  useEffect(() => {
    console.log('AgentModePanel 渲染检查:', {
      tasksLength: tasks.length,
      taskStatuses: tasks.map((t) => t.status),
      showAgentTaskList,
      isRunning,
      渲染条件: showAgentTaskList && tasks.length > 0
    })
  }, [tasks, showAgentTaskList, isRunning])

  // 在每次渲染时记录渲染条件
  useEffect(() => {
    console.log('任务列表渲染条件检查:', {
      showAgentTaskList,
      tasksLength: tasks.length,
      应该渲染: showAgentTaskList && tasks.length > 0
    })
  }, [showAgentTaskList, tasks.length])

  const handleMaxRequestsChange = (value: any) => {
    // 确保值是数字
    const numValue = typeof value === 'number' ? value : agentModeMaxApiRequests
    setMaxRequests(numValue)
    dispatch(setAgentModeMaxApiRequests(numValue))
  }

  const handleFinish = () => {
    if (onFinish) {
      onFinish()
    }
    dispatch(setEnableAgentMode(false))
  }

  // 修改 handleTaskClick 函数以接收 taskId 和 messageId
  const handleTaskClick = (taskId: string, messageId: string) => {
    if (onTaskClick) {
      onTaskClick(taskId, messageId)
    }
  }

  // 处理 Agent 任务列表显示开关变化
  const handleShowTaskListChange = (checked: boolean) => {
    console.log('显示任务列表状态变更:', checked)
    onSetShowAgentTaskList(checked)
  }

  // 处理 Agent 自动执行次数变化
  const handleAutoExecutionCountChange = (value: any) => {
    // 确保值是数字
    const numValue = typeof value === 'number' ? value : agentAutoExecutionCount
    onSetAgentAutoExecutionCount(numValue)
  }

  // 处理清空任务列表
  const handleClearTasks = () => {
    console.log('清空任务列表')
    // 调用 agentService 的 clearTasks 方法清空任务列表
    agentService.clearTasks()
  }

  return (
    <Container>
      <Header>
        <Title>{t('agent.mode.title')}</Title>
        <Description>{t('agent.mode.description')}</Description>
      </Header>
      {/* 根据 showAgentTaskList 的值和是否有任务条件渲染 AgentTaskList */}
      {showAgentTaskList && tasks.length > 0 && (
        <>
          <Flex justify="space-between" align="center" style={{ padding: '8px 16px' }}>
            <div>
              {t('agent.tasks.count', {
                completed: tasks.filter((t) => t.status === 'completed').length,
                total: tasks.length
              })}
            </div>
            <Tooltip title={t('agent.tasks.clear_tooltip')} arrow>
              <Button size="small" onClick={handleClearTasks}>
                {t('agent.tasks.clear')}
              </Button>
            </Tooltip>
          </Flex>
          <AgentTaskList tasks={tasks} onTaskClick={handleTaskClick} scrollToMessage={scrollToMessage} />
        </>
      )}
      {/* 如果应该显示但没有任务，显示提示信息 */}
      {showAgentTaskList && tasks.length === 0 && (
        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-2)' }}>
          {t('agent.tasks.no_running_tasks')}
        </div>
      )}
      <ControlPanel>
        <Flex justify="space-between" align="center">
          <Space size="middle">
            <Tooltip title={t('agent.tasks.show_list_tooltip')} arrow>
              <Space size="small">
                <label>{t('agent.tasks.show_list')}:</label>
                <Switch checked={showAgentTaskList} onChange={handleShowTaskListChange} size="small" />
              </Space>
            </Tooltip>
            <Tooltip title={t('agent.mode.auto_execution_count_tooltip')} arrow>
              <Space size="small">
                <label>{t('agent.mode.auto_execution_count')}:</label>
                <StyledInputNumber
                  min={1}
                  max={100} // 可以根据需要调整最大值
                  value={agentAutoExecutionCount}
                  onChange={handleAutoExecutionCountChange}
                  disabled={isRunning}
                  size="small"
                />
              </Space>
            </Tooltip>
            <Tooltip title={t('agent.mode.max_requests_tooltip')} arrow>
              <Space size="small">
                <label>{t('agent.mode.max_requests')}:</label>
                <StyledInputNumber
                  min={1}
                  max={50}
                  value={maxRequests}
                  onChange={handleMaxRequestsChange}
                  disabled={isRunning}
                  size="small"
                />
              </Space>
            </Tooltip>
          </Space>
          <Button type="primary" onClick={handleFinish} disabled={isRunning} size="small">
            {isRunning ? t('agent.mode.running') : t('agent.mode.finish')}
          </Button>
        </Flex>
      </ControlPanel>
    </Container>
  )
}

const Container = styled.div`
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-bg-1);
  border: 1px solid var(--color-border);
`

const Header = styled.div`
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
`

const Title = styled.h3`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 500;
`

const Description = styled.p`
  margin: 0;
  font-size: 13px;
  color: var(--color-text-2);
`

const ControlPanel = styled.div`
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
`

const StyledInputNumber = styled(InputNumber)`
  width: 80px;
`

export default AgentModePanel
