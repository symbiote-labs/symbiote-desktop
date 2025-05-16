import MultiSelectActionPopup from '@renderer/components/Popups/MultiSelectionPopup'
import { QuickPanelProvider } from '@renderer/components/QuickPanel'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useSettings } from '@renderer/hooks/useSettings'
import { useShowTopics } from '@renderer/hooks/useStore'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { RootState } from '@renderer/store'
import { messageBlocksSelectors } from '@renderer/store/messageBlock'
import { newMessagesActions, selectMessagesForTopic } from '@renderer/store/newMessage'
import { Assistant, Topic } from '@renderer/types'
import { Flex, Modal } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
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
  const { assistant } = useAssistant(props.assistant.id)
  const { topicPosition, messageStyle } = useSettings()
  const { showTopics } = useShowTopics()
  const { t } = useTranslation()
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false)
  const [messagesToDelete, setMessagesToDelete] = useState<string[]>([])

  const dispatch = useDispatch()
  // 从 Redux 中获取当前主题的消息
  const messages = useSelector((state: RootState) => selectMessagesForTopic(state, props.activeTopic.id))
  // 获取所有消息块
  const messageBlocks = useSelector(messageBlocksSelectors.selectEntities)

  useEffect(() => {
    const handleToggleMultiSelect = (value: boolean) => {
      setIsMultiSelectMode(value)
    }

    EventEmitter.on(EVENT_NAMES.MESSAGE_MULTI_SELECT, handleToggleMultiSelect)

    return () => {
      EventEmitter.off(EVENT_NAMES.MESSAGE_MULTI_SELECT, handleToggleMultiSelect)
    }
  }, [])

  const handleMultiSelectAction = (actionType: string, messageIds: string[]) => {
    if (messageIds.length === 0) {
      window.message.warning(t('chat.multiple.select.empty'))
      return
    }
    switch (actionType) {
      case 'delete':
        setMessagesToDelete(messageIds)
        setConfirmDeleteVisible(true)
        break
      case 'save': {
        const assistantMessages = messages.filter((msg) => messageIds.includes(msg.id))
        if (assistantMessages.length > 0) {
          const contentToSave = assistantMessages
            .map((msg) => {
              return msg.blocks
                .map((blockId) => {
                  const block = messageBlocks[blockId]
                  return block && 'content' in block ? block.content : ''
                })
                .filter(Boolean)
                .join('\n')
                .trim()
            })
            .join('\n\n---\n\n')
          const fileName = `chat_export_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.md`
          window.api.file.save(fileName, contentToSave)
          window.message.success({ content: t('message.save.success.title'), key: 'save-messages' })
          EventEmitter.emit(EVENT_NAMES.MESSAGE_MULTI_SELECT, false)
        } else {
          window.message.warning(t('message.save.no.assistant'))
        }
        break
      }
      case 'copy': {
        const assistantMessages = messages.filter((msg) => messageIds.includes(msg.id))
        if (assistantMessages.length > 0) {
          const contentToCopy = assistantMessages
            .map((msg) => {
              return msg.blocks
                .map((blockId) => {
                  const block = messageBlocks[blockId]
                  return block && 'content' in block ? block.content : ''
                })
                .filter(Boolean)
                .join('\n')
                .trim()
            })
            .join('\n\n---\n\n')
          navigator.clipboard.writeText(contentToCopy)
          window.message.success({ content: t('message.copied'), key: 'copy-messages' })
          EventEmitter.emit(EVENT_NAMES.MESSAGE_MULTI_SELECT, false)
        } else {
          window.message.warning(t('message.copy.no.assistant'))
        }
        break
      }
      default:
        break
    }
  }

  const confirmDelete = async () => {
    try {
      dispatch(
        newMessagesActions.removeMessages({
          topicId: props.activeTopic.id,
          messageIds: messagesToDelete
        })
      )
      window.message.success(t('message.delete.success'))
      setMessagesToDelete([])
      setIsMultiSelectMode(false)
      EventEmitter.emit(EVENT_NAMES.MESSAGE_MULTI_SELECT, false)
    } catch (error) {
      console.error('Failed to delete messages:', error)
      window.message.error(t('message.delete.failed'))
    } finally {
      setConfirmDeleteVisible(false)
      setIsMultiSelectMode(false)
    }
  }

  const cancelDelete = () => {
    setConfirmDeleteVisible(false)
    setMessagesToDelete([])
  }

  return (
    <Container id="chat" className={messageStyle}>
      <Main id="chat-main" vertical flex={1} justify="space-between">
        <Messages
          key={props.activeTopic.id}
          assistant={assistant}
          topic={props.activeTopic}
          setActiveTopic={props.setActiveTopic}
        />
        <QuickPanelProvider>
          {isMultiSelectMode ? (
            <MultiSelectActionPopup
              visible={isMultiSelectMode}
              onClose={() => setIsMultiSelectMode(false)}
              onAction={handleMultiSelectAction}
              topic={props.activeTopic}
            />
          ) : (
            <Inputbar assistant={assistant} setActiveTopic={props.setActiveTopic} topic={props.activeTopic} />
          )}
        </QuickPanelProvider>
      </Main>
      {topicPosition === 'right' && showTopics && (
        <Tabs
          activeAssistant={assistant}
          activeTopic={props.activeTopic}
          setActiveAssistant={props.setActiveAssistant}
          setActiveTopic={props.setActiveTopic}
          position="right"
        />
      )}
      <Modal
        title={t('message.delete.confirm.title')}
        open={confirmDeleteVisible}
        onOk={confirmDelete}
        onCancel={cancelDelete}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
        centered={true}>
        <p>{t('message.delete.confirm.content', { count: messagesToDelete.length })}</p>
      </Modal>
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
  transform: translateZ(0);
`

export default Chat
