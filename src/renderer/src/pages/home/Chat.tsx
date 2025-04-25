import ChatWorkspacePanel from '@renderer/components/ChatWorkspacePanel'
import { QuickPanelProvider } from '@renderer/components/QuickPanel'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useSettings } from '@renderer/hooks/useSettings'
import { useShowTopics } from '@renderer/hooks/useStore'
import agentService, { AgentState } from '@renderer/services/AgentService' // Import agentService and AgentState
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { AgentTask, Assistant, Topic } from '@renderer/types' // Import AgentTask
import { Flex } from 'antd'
import { FC, memo, useEffect, useMemo, useRef, useState } from 'react' // Import useRef
import styled from 'styled-components'

import Inputbar from './Inputbar/Inputbar'
import Messages, { MessagesRef } from './Messages/Messages' // Import MessagesRef
import Tabs from './Tabs'

interface Props {
  assistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  setActiveAssistant: (assistant: Assistant) => void
}

const Chat: FC<Props> = (props) => {
  // 使用传入的 assistant 对象，避免重复获取
  // 如果 useAssistant 提供了额外的功能或状态更新，则保留此调用
  const { assistant } = useAssistant(props.assistant.id)
  const { topicPosition, messageStyle } = useSettings()
  const { showTopics } = useShowTopics()
  const [isWorkspacePanelVisible, setIsWorkspacePanelVisible] = useState(false) // Add state for panel visibility
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>(agentService.getState().tasks) // Add state for agent tasks

  // 创建 Messages 组件的 ref
  const messagesRef = useRef<MessagesRef>(null)

  useEffect(() => {
    // 监听Agent状态变化
    const handleAgentStateChange = (state: AgentState) => {
      setAgentTasks(state.tasks)
    }

    agentService.addListener(handleAgentStateChange)

    return () => {
      agentService.removeListener(handleAgentStateChange)
    }
  }, [])

  // Function to toggle the workspace panel
  const toggleWorkspacePanel = () => {
    setIsWorkspacePanelVisible(!isWorkspacePanelVisible)
  }

  // 使用 useMemo 优化渲染，只有当相关依赖变化时才重新创建元素
  const messagesComponent = useMemo(
    () => (
      <Messages
        key={props.activeTopic.id}
        assistant={assistant}
        topic={props.activeTopic}
        setActiveTopic={props.setActiveTopic}
        ref={messagesRef} // 将 ref 传递给 Messages 组件
      />
    ),
    [props.activeTopic.id, assistant, props.setActiveTopic]
  )

  const inputbarComponent = useMemo(
    () => (
      <QuickPanelProvider>
        <Inputbar
          assistant={assistant}
          setActiveTopic={props.setActiveTopic}
          topic={props.activeTopic}
          onToggleWorkspacePanel={toggleWorkspacePanel} // Pass toggle function to Inputbar
          agentTasks={agentTasks} // Pass agentTasks to Inputbar
          // 传递 scrollToMessage 函数
          scrollToMessage={messagesRef.current?.scrollToMessage}
        />
      </QuickPanelProvider>
    ),
    [
      assistant,
      props.setActiveTopic,
      props.activeTopic,
      toggleWorkspacePanel,
      agentTasks,
      messagesRef.current?.scrollToMessage
    ] // Add scrollToMessage to dependencies
  )

  const tabsComponent = useMemo(() => {
    if (topicPosition !== 'right' || !showTopics) return null

    return (
      <Tabs
        activeAssistant={assistant}
        activeTopic={props.activeTopic}
        setActiveAssistant={props.setActiveAssistant}
        setActiveTopic={props.setActiveTopic}
        position="right"
      />
    )
  }, [topicPosition, showTopics, assistant, props.activeTopic, props.setActiveAssistant, props.setActiveTopic])

  // 处理从工作区发送文件内容到聊天输入框
  const handleSendFileToChat = (content: string) => {
    // Emit an event to set the chat input value
    EventEmitter.emit(EVENT_NAMES.SET_CHAT_INPUT, content)
    // Optionally, close the workspace panel after sending
    // toggleWorkspacePanel(); // Or use onClose() if passed down correctly for this purpose
    setIsWorkspacePanelVisible(false) // Close the panel
    console.log('Emitted SET_CHAT_INPUT event with content.')
  }

  // 处理从工作区发送文件作为附件
  const handleSendFileAsAttachment = (file: any) => {
    // 触发事件发送文件附件
    EventEmitter.emit(EVENT_NAMES.SEND_FILE_ATTACHMENT, file)
    // 关闭工作区面板
    setIsWorkspacePanelVisible(false)
    console.log('已发送文件作为附件:', file.name)
  }

  return (
    <Container id="chat" className={messageStyle}>
      <Main id="chat-main" vertical flex={1} justify="space-between">
        {messagesComponent}
        {inputbarComponent}
      </Main>
      {tabsComponent}
      <ChatWorkspacePanel
        visible={isWorkspacePanelVisible} // Pass state to visible prop
        onClose={toggleWorkspacePanel} // Pass toggle function as onClose prop
        onSendToChat={handleSendFileToChat}
        onSendFileToChat={handleSendFileAsAttachment}
      />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: row;
  height: 100%;
  flex: 1;
  justify-content: space-between;
`

const Main = styled(Flex)`
  height: calc(100vh - var(--navbar-height));
  // 设置为containing block，方便子元素fixed定位
  transform: translateZ(0);
`

export default memo(Chat)
