import { LinkOutlined } from '@ant-design/icons'
import { useRuntime } from '@renderer/hooks/useRuntime'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { findMessageById } from '@renderer/services/MessagesService'
import { Message } from '@renderer/types'
import { Button, Modal, Tooltip } from 'antd'
import { t } from 'i18next'
import { useState } from 'react'
import styled from 'styled-components'

// 添加引用消息的弹窗组件
const ReferenceModal: React.FC<{ message: Message | null; visible: boolean; onClose: () => void }> = ({
  message,
  visible,
  onClose
}) => {
  if (!message) return null

  return (
    <Modal title={`引用消息`} open={visible} onCancel={onClose} footer={null} width={600}>
      <ReferenceContent>
        <div className="message-role">{message.role === 'user' ? t('common.you') : 'AI'}</div>
        <div className="message-content">{message.content}</div>
        <div className="message-time">{new Date(message.createdAt).toLocaleString()}</div>
      </ReferenceContent>
    </Modal>
  )
}

const ReferenceContent = styled.div`
  padding: 10px;

  .message-role {
    font-weight: bold;
    margin-bottom: 5px;
  }

  .message-content {
    white-space: pre-wrap;
    word-break: break-word;
    margin-bottom: 10px;
  }

  .message-time {
    font-size: 12px;
    color: var(--color-text-3);
    text-align: right;
  }
`

const MessgeTokens: React.FC<{ message: Message; isLastMessage: boolean }> = ({ message, isLastMessage }) => {
  const { generating } = useRuntime()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [referencedMessage, setReferencedMessage] = useState<Message | null>(null)

  // 渲染引用消息弹窗
  const renderReferenceModal = () => {
    return <ReferenceModal message={referencedMessage} visible={isModalVisible} onClose={handleModalClose} />
  }

  const locateMessage = () => {
    EventEmitter.emit(EVENT_NAMES.LOCATE_MESSAGE + ':' + message.id, false)
  }

  const showReferenceModal = async (e: React.MouseEvent) => {
    e.stopPropagation() // 防止触发父元素的点击事件

    try {
      // 复制ID到剪贴板，便于用户手动使用
      navigator.clipboard.writeText(message.id)

      // 查找原始消息
      const originalMessage = await findMessageById(message.id)
      if (originalMessage) {
        setReferencedMessage(originalMessage)
        setIsModalVisible(true)
      }
    } catch (error) {
      console.error('Failed to find referenced message:', error)
      window.message.error({
        content: t('message.reference.error') || '无法找到原始消息',
        key: 'reference-message-error'
      })
    }
  }

  const handleModalClose = () => {
    setIsModalVisible(false)
  }

  if (!message.usage) {
    return <div />
  }

  if (message.role === 'user') {
    return (
      <MessageMetadata className="message-tokens" onClick={locateMessage}>
        <span className="tokens">Tokens: {message?.usage?.total_tokens}</span>
        <Tooltip title={t('message.reference') || '引用消息'}>
          <Button
            type="text"
            size="small"
            icon={<LinkOutlined />}
            onClick={showReferenceModal}
            className="reference-button"
          />
        </Tooltip>
      </MessageMetadata>
    )
  }

  if (isLastMessage && generating) {
    return <div />
  }

  if (message.role === 'assistant') {
    let metrixs = ''
    let hasMetrics = false

    if (message?.metrics?.completion_tokens && message?.metrics?.time_completion_millsec) {
      hasMetrics = true
      metrixs = t('settings.messages.metrics', {
        time_first_token_millsec: message?.metrics?.time_first_token_millsec,
        token_speed: (message?.metrics?.completion_tokens / (message?.metrics?.time_completion_millsec / 1000)).toFixed(
          0
        )
      })
    }

    return (
      <MessageMetadata className={`message-tokens ${hasMetrics ? 'has-metrics' : ''}`} onClick={locateMessage}>
        <span className="metrics">{metrixs}</span>
        <span className="tokens">
          Tokens: {message?.usage?.total_tokens} ↑{message?.usage?.prompt_tokens} ↓{message?.usage?.completion_tokens}
        </span>
        <Tooltip title={t('message.reference') || '引用消息'}>
          <Button
            type="text"
            size="small"
            icon={<LinkOutlined />}
            onClick={showReferenceModal}
            className="reference-button"
          />
        </Tooltip>
      </MessageMetadata>
    )
  }

  return (
    <>
      {renderReferenceModal()}
      {null}
    </>
  )
}

const MessageMetadata = styled.div`
  font-size: 11px;
  color: var(--color-text-2);
  user-select: text;
  margin: 2px 0;
  cursor: pointer;
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;

  .metrics {
    display: none;
  }

  .tokens {
    display: block;
  }

  &.has-metrics:hover {
    .metrics {
      display: block;
    }

    .tokens {
      display: none;
    }
  }

  .reference-button {
    padding: 0;
    height: 16px;
    width: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-2);
    opacity: 0.7;

    &:hover {
      opacity: 1;
      color: var(--color-primary);
    }

    .anticon {
      font-size: 12px;
    }
  }
`

export default MessgeTokens
