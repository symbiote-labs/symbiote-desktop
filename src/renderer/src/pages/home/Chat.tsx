import { QuickPanelProvider } from '@renderer/components/QuickPanel'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useSettings } from '@renderer/hooks/useSettings'
import { useShowTopics } from '@renderer/hooks/useStore'
import { Assistant, Topic } from '@renderer/types'
import { Flex } from 'antd'
import { FC, memo, useMemo } from 'react'
import styled from 'styled-components'

import Inputbar from './Inputbar/Inputbar'
import Messages from './Messages/Messages'
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

  // 使用 useMemo 优化渲染，只有当相关依赖变化时才重新创建元素
  const messagesComponent = useMemo(
    () => (
      <Messages
        key={props.activeTopic.id}
        assistant={assistant}
        topic={props.activeTopic}
        setActiveTopic={props.setActiveTopic}
      />
    ),
    [props.activeTopic.id, assistant, props.setActiveTopic]
  )

  const inputbarComponent = useMemo(
    () => (
      <QuickPanelProvider>
        <Inputbar assistant={assistant} setActiveTopic={props.setActiveTopic} topic={props.activeTopic} />
      </QuickPanelProvider>
    ),
    [assistant, props.setActiveTopic, props.activeTopic]
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

  return (
    <Container id="chat" className={messageStyle}>
      <Main id="chat-main" vertical flex={1} justify="space-between">
        {messagesComponent}
        {inputbarComponent}
      </Main>
      {tabsComponent}
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
