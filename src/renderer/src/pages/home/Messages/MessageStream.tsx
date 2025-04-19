import { useAppSelector } from '@renderer/store'
import { selectStreamMessage } from '@renderer/store/messages'
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

  // 获取常规消息，使用选择器减少不必要的重新渲染
  const regularMessage = useAppSelector((state) => {
    // 如果是用户消息，直接使用传入的_message
    if (_message.role === 'user') {
      return _message
    }

    // 对于助手消息，从store中查找最新状态
    const topicMessages = state.messages?.messagesByTopic?.[_message.topicId]
    if (!topicMessages) return _message

    return topicMessages.find((m) => m.id === _message.id) || _message
  })

  // 使用useMemo缓存计算结果
  const { isStreaming, message } = useMemo(() => {
    const isStreaming = !!(streamMessage && streamMessage.id === _message.id);
    const message = isStreaming ? streamMessage : regularMessage;
    return { isStreaming, message };
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

// 使用自定义比较函数的memo包装组件，只在关键属性变化时重新渲染
export default memo(MessageStream, (prevProps, nextProps) => {
  // 只在关键属性变化时重新渲染
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.status === nextProps.message.status &&
    prevProps.topic.id === nextProps.topic.id
  );
})
