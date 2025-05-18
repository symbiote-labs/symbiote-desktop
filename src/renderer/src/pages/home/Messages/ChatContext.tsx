import { RootState } from '@renderer/store'
import { messageBlocksSelectors } from '@renderer/store/messageBlock'
import { newMessagesActions, selectMessagesForTopic } from '@renderer/store/newMessage'
import { Topic } from '@renderer/types'
import { Modal } from 'antd'
import { createContext, FC, ReactNode, use, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

interface ChatContextProps {
  isMultiSelectMode: boolean
  toggleMultiSelectMode: (value: boolean) => void
  handleMultiSelectAction: (actionType: string, messageIds: string[]) => void
  activeTopic: Topic
}

const ChatContext = createContext<ChatContextProps | undefined>(undefined)

export const useChatContext = () => {
  const context = use(ChatContext)
  if (!context) {
    throw new Error('useChatContext 必须在 ChatProvider 内使用')
  }
  return context
}

interface ChatProviderProps {
  children: ReactNode
  activeTopic: Topic
}

export const ChatProvider: FC<ChatProviderProps> = ({ children, activeTopic }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false)
  const [messagesToDelete, setMessagesToDelete] = useState<string[]>([])

  const messages = useSelector((state: RootState) => selectMessagesForTopic(state, activeTopic.id))
  const messageBlocks = useSelector(messageBlocksSelectors.selectEntities)

  const toggleMultiSelectMode = (value: boolean) => {
    setIsMultiSelectMode(value)
  }

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
          toggleMultiSelectMode(false)
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
          toggleMultiSelectMode(false)
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
          topicId: activeTopic.id,
          messageIds: messagesToDelete
        })
      )
      window.message.success(t('message.delete.success'))
      setMessagesToDelete([])
      toggleMultiSelectMode(false)
    } catch (error) {
      console.error('Failed to delete messages:', error)
      window.message.error(t('message.delete.failed'))
    } finally {
      setConfirmDeleteVisible(false)
    }
  }

  const cancelDelete = () => {
    setConfirmDeleteVisible(false)
    setMessagesToDelete([])
  }

  const value = {
    isMultiSelectMode,
    toggleMultiSelectMode,
    handleMultiSelectAction,
    activeTopic
  }

  return (
    <ChatContext value={value}>
      {children}
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
    </ChatContext>
  )
}
