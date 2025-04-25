import { CheckOutlined, LoadingOutlined, WarningOutlined } from '@ant-design/icons'
import { Collapse } from 'antd'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export interface AgentTask {
  id: string
  title: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: string
  messageId: string // 添加 messageId 字段
}

interface Props {
  tasks: AgentTask[]
  onTaskClick?: (taskId: string, messageId: string) => void // 修改参数类型为 taskId 和 messageId
  scrollToMessage?: (messageId: string) => void // 添加 scrollToMessage 属性
}

const AgentTaskList: FC<Props> = ({ tasks, onTaskClick, scrollToMessage }) => {
  const { t } = useTranslation()
  const [activeKeys, setActiveKeys] = useState<string[]>([])

  // 任务点击处理函数
  const handleTaskClick = (taskId: string, messageId: string) => {
    if (onTaskClick) {
      onTaskClick(taskId, messageId) // 调用 onTaskClick 传递 taskId 和 messageId
    }
    if (scrollToMessage && messageId) {
      scrollToMessage(messageId) // 调用 scrollToMessage 传递 messageId
    }
  }

  const collapseItems = useMemo(() => {
    return tasks.map((task) => {
      const isRunning = task.status === 'running'
      const isCompleted = task.status === 'completed'
      const hasError = task.status === 'error'

      return {
        key: task.id,
        label: (
          <TaskTitleLabel
            onClick={(e) => {
              e.stopPropagation() // 阻止事件冒泡，避免触发 Collapse 的展开/折叠
              handleTaskClick(task.id, task.messageId) // 传递 taskId 和 messageId
            }}>
            <TitleContent>
              <TaskName>{task.title}</TaskName>
              <StatusIndicator $isRunning={isRunning} $hasError={hasError}>
                {isRunning
                  ? t('agent.task.running')
                  : hasError
                    ? t('agent.task.error')
                    : isCompleted
                      ? t('agent.task.completed')
                      : t('agent.task.pending')}
                {isRunning && <LoadingOutlined spin style={{ marginLeft: 6 }} />}
                {isCompleted && <CheckOutlined style={{ marginLeft: 6 }} />}
                {hasError && <WarningOutlined style={{ marginLeft: 6 }} />}
              </StatusIndicator>
            </TitleContent>
          </TaskTitleLabel>
        ),
        children: (
          <TaskContent>
            <TaskDescription>{task.description}</TaskDescription>
            {task.result && <TaskResult>{task.result}</TaskResult>}
          </TaskContent>
        )
      }
    })
  }, [tasks, t, handleTaskClick]) // 添加 handleTaskClick 到依赖数组

  if (tasks.length === 0) return null

  return (
    <TasksContainer className="agent-tasks-container">
      <TasksHeader>
        <TasksTitle>{t('agent.tasks.title')}</TasksTitle>
        <TasksCount>
          {t('agent.tasks.count', {
            completed: tasks.filter((t) => t.status === 'completed').length,
            total: tasks.length
          })}
        </TasksCount>
      </TasksHeader>
      <Collapse
        bordered={false}
        activeKey={activeKeys}
        onChange={(keys) => setActiveKeys(keys as string[])}
        items={collapseItems}
      />
    </TasksContainer>
  )
}

const TasksContainer = styled.div`
  margin-bottom: 15px;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-bg-1);
  border: 1px solid var(--color-border);
`

const TasksHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
`

const TasksTitle = styled.div`
  font-weight: 500;
  font-size: 14px;
`

const TasksCount = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
`

const TaskTitleLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`

const TitleContent = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const TaskName = styled.span`
  font-weight: 500;
`

const StatusIndicator = styled.span<{ $isRunning: boolean; $hasError?: boolean }>`
  color: ${(props) => {
    if (props.$hasError) return 'var(--color-error, #ff4d4f)'
    if (props.$isRunning) return 'var(--color-primary)'
    return 'var(--color-success, #52c41a)'
  }};
  font-size: 11px;
  display: flex;
  align-items: center;
  opacity: 0.85;
  border-left: 1px solid var(--color-border);
  padding-left: 8px;
`

const TaskContent = styled.div`
  padding: 12px 16px;
`

const TaskDescription = styled.div`
  margin-bottom: 8px;
  font-size: 13px;
`

const TaskResult = styled.div`
  background-color: var(--color-bg-2);
  padding: 8px;
  border-radius: 4px;
  font-family: 'Ubuntu Mono', monospace;
  font-size: 12px;
  white-space: pre-wrap;
`

export default AgentTaskList
