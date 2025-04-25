import { useSettings } from '@renderer/hooks/useSettings'
import { useAppDispatch } from '@renderer/store'
import { setEnableAgentMode } from '@renderer/store/settings'
import { AgentTask } from '@renderer/types' // 导入 AgentTask 类型
import { Tooltip } from 'antd'
import { Bot } from 'lucide-react'
import { FC, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'

import AgentModePanelContainer from '../Messages/AgentModePanelContainer' // 导入 AgentModePanelContainer 组件

export interface AgentModeButtonRef {
  toggleAgentMode: () => void
}

interface Props {
  ref?: React.RefObject<AgentModeButtonRef | null>
  ToolbarButton: any
  agentTasks: AgentTask[] // 添加 agentTasks 属性，用于接收 Agent 任务列表
  scrollToMessage?: (messageId: string) => void // 添加 scrollToMessage 属性
}

const AgentModeButton: FC<Props> = ({ ref, ToolbarButton, scrollToMessage }) => {
  // 解构 scrollToMessage 属性
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { enableAgentMode } = useSettings() // 获取 Agent 模式的当前状态

  // 切换 Agent 模式的状态
  const toggleAgentMode = () => {
    dispatch(setEnableAgentMode(!enableAgentMode))
  }

  // 处理按钮点击事件
  const handleButtonClick = () => {
    if (enableAgentMode) {
      // 如果 Agent 模式已启用，显示 Agent 设置面板
      window.modal.confirm({
        title: t('agent.mode.title'),
        content: <AgentModePanelContainer scrollToMessage={scrollToMessage} />,
        icon: null,
        footer: null,
        width: 600,
        closable: true,
        centered: true,
        maskClosable: true,
        className: 'agent-mode-panel-modal'
      })
    } else {
      // 如果 Agent 模式未启用，启用 Agent 模式
      toggleAgentMode()

      // 启用后立即显示 Agent 设置面板
      setTimeout(() => {
        window.modal.confirm({
          title: t('agent.mode.title'),
          content: <AgentModePanelContainer scrollToMessage={scrollToMessage} />,
          icon: null,
          footer: null,
          width: 600,
          closable: true,
          centered: true,
          maskClosable: true,
          className: 'agent-mode-panel-modal'
        })
      }, 100) // 短暂延迟确保状态已更新
    }
  }

  useImperativeHandle(ref, () => ({
    toggleAgentMode // 暴露 toggleAgentMode 函数，如果外部需要调用
  }))

  return (
    <Tooltip placement="top" title={t('chat.input.agent_mode')} arrow>
      {/* 将 onClick 事件绑定到 handleButtonClick */}
      <ToolbarButton type="text" onClick={handleButtonClick}>
        <Bot size={18} color={enableAgentMode ? 'var(--color-primary)' : 'var(--color-icon)'} />
      </ToolbarButton>
    </Tooltip>
  )
}

export default AgentModeButton
