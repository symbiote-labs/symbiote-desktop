import { useAppSelector } from '@renderer/store'
import { selectRegularMessage, selectStreamMessage } from '@renderer/store/messages'
import { Assistant, Message, Topic } from '@renderer/types'
import { memo, useMemo } from 'react'
import styled from 'styled-components'

import MessageItem from './Message'

interface MessageStreamProps {
  message: Message
  topic: Topic
  assistant?: Assistant
  index?: number
  hidePresetMessages?: boolean
  isGrouped?: boolean
  style?: React.CSSProperties
}

const MessageStreamContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const MessageStream: React.FC<MessageStreamProps> = ({
  message: _message,
  topic,
  assistant,
  index,
  hidePresetMessages,
  isGrouped,
  style
}) => {
  // 获取流式消息，使用选择器减少不必要的重新渲染
  const streamMessage = useAppSelector((state) => selectStreamMessage(state, _message.topicId, _message.id))

  // 获取常规消息，使用记忆化选择器减少不必要的重新渲染
  const regularMessage = useAppSelector((state) => selectRegularMessage(state, _message.topicId, _message.id, _message))

  // 使用useMemo缓存计算结果
  const { isStreaming, message } = useMemo(() => {
    const isStreaming = !!(streamMessage && streamMessage.id === _message.id)
    const message = isStreaming ? streamMessage : regularMessage
    return { isStreaming, message }
  }, [streamMessage, regularMessage, _message.id])
  return (
    <MessageStreamContainer>
      <MessageItem
        message={message}
        topic={topic}
        assistant={assistant}
        index={index}
        hidePresetMessages={hidePresetMessages}
        isGrouped={isGrouped}
        style={style}
        isStreaming={isStreaming}
      />
    </MessageStreamContainer>
  )
}

// 使用 React.memo 包装组件，使用默认的浅层比较
// 这样可以确保所有属性变化都能触发重新渲染
// 对于这种组件，默认的浅层比较通常更安全和简单
export default memo(MessageStream)
