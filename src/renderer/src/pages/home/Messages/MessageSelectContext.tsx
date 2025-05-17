import { RootState } from '@renderer/store'
import { messageBlocksSelectors } from '@renderer/store/messageBlock'
import { newMessagesActions, selectMessagesForTopic } from '@renderer/store/newMessage'
import { Topic } from '@renderer/types'
import { Modal } from 'antd'
import { createContext, FC, ReactNode, use, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'

interface MultiSelectContextType {
  isMultiSelectMode: boolean
  toggleMultiSelectMode: (value: boolean) => void
  selectedMessageIds: string[]
  handleMessageSelection: (messageId: string, selected: boolean) => void
  handleAction: (action: string) => void
}

const MultiSelectContext = createContext<MultiSelectContextType | undefined>(undefined)

export const useMultiSelect = () => {
  const context = use(MultiSelectContext)
  if (!context) {
    throw new Error('useMultiSelect必须在MultiSelectProvider内使用')
  }
  return context
}

interface MultiSelectProviderProps {
  children: ReactNode
  topic: Topic
}

export const MultiSelectProvider: FC<MultiSelectProviderProps> = ({ children, topic }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState<string[]>([])
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false)

  // 获取消息和消息块
  const messages = useSelector((state: RootState) => selectMessagesForTopic(state, topic.id))
  const messageBlocks = useSelector(messageBlocksSelectors.selectEntities)

  const toggleMultiSelectMode = (value: boolean) => {
    setIsMultiSelectMode(value)
    if (!value) setSelectedMessageIds([])
  }

  const handleMessageSelection = (messageId: string, selected: boolean) => {
    setSelectedMessageIds((prev) => (selected ? [...prev, messageId] : prev.filter((id) => id !== messageId)))
  }

  // 处理保存、复制、删除等操作
  const handleAction = (action: string) => {
    if (selectedMessageIds.length === 0) {
      window.message.warning(t('chat.multiple.select.empty'))
      return
    }

    switch (action) {
      case 'delete':
        setConfirmDeleteVisible(true)
        break
      case 'save': {
        const assistantMessages = messages.filter((msg) => selectedMessageIds.includes(msg.id))
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
        const assistantMessages = messages.filter((msg) => selectedMessageIds.includes(msg.id))
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
    }
  }

  const confirmDelete = () => {
    try {
      dispatch(
        newMessagesActions.removeMessages({
          topicId: topic.id,
          messageIds: selectedMessageIds
        })
      )
      window.message.success(t('message.delete.success'))
      toggleMultiSelectMode(false)
    } catch (error) {
      console.error('删除消息失败:', error)
      window.message.error(t('message.delete.failed'))
    } finally {
      setConfirmDeleteVisible(false)
    }
  }

  return (
    <MultiSelectContext
      value={{
        isMultiSelectMode,
        toggleMultiSelectMode,
        selectedMessageIds,
        handleMessageSelection,
        handleAction
      }}>
      {children}

      <Modal
        title={t('message.delete.confirm.title')}
        open={confirmDeleteVisible}
        onOk={confirmDelete}
        onCancel={() => setConfirmDeleteVisible(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        okButtonProps={{ danger: true }}
        centered={true}>
        <p>{t('message.delete.confirm.content', { count: selectedMessageIds.length })}</p>
      </Modal>
    </MultiSelectContext>
  )
}
