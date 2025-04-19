import { DeleteOutlined } from '@ant-design/icons'
import { addAssistantMemoryItem } from '@renderer/services/MemoryService'
import store, { useAppDispatch, useAppSelector } from '@renderer/store'
import { deleteAssistantMemory } from '@renderer/store/memory'
import { Button, Empty, Input, List, Modal, Tooltip, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Provider } from 'react-redux'
import styled from 'styled-components'

const { Text } = Typography

const StyledModal = styled(Modal)`
  .ant-modal-content {
    background-color: ${(props) => props.theme.popupBackground};
    color: ${(props) => props.theme.textColor};
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .ant-modal-header {
    background-color: transparent;
    border-bottom: none;
  }

  .ant-modal-title {
    color: ${(props) => props.theme.textColor};
  }

  .ant-modal-close {
    color: ${(props) => props.theme.textColor};
  }

  .ant-modal-body {
    padding: 16px 24px;
  }

  .ant-modal-footer {
    border-top: none;
  }
`

const MemoryInput = styled(Input.TextArea)`
  margin-bottom: 16px;
  border-radius: 6px;
  background-color: ${(props) => props.theme.inputBackground};
  color: ${(props) => props.theme.textColor};
  border-color: ${(props) => props.theme.borderColor};

  &:focus,
  &:hover {
    border-color: ${(props) => props.theme.primaryColor};
  }
`

const MemoryList = styled(List)`
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
  border-radius: 6px;
  border: 1px solid ${(props) => props.theme.borderColor};
  background-color: ${(props) => props.theme.cardBackground};

  .ant-list-item {
    padding: 12px 16px;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
  }

  .ant-list-item:last-child {
    border-bottom: none;
  }

  .ant-list-item-meta-title {
    color: ${(props) => props.theme.textColor};
  }

  .ant-list-item-meta-description {
    color: ${(props) => props.theme.secondaryTextColor};
  }
`

const EmptyContainer = styled(Empty)`
  padding: 24px;
  .ant-empty-description {
    color: ${(props) => props.theme.secondaryTextColor};
  }
`

interface AssistantMemoryPopupProps {
  open: boolean
  onClose: () => void
  assistantId: string
}

const AssistantMemoryPopup = ({ open, onClose, assistantId }: AssistantMemoryPopupProps) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  // 获取助手记忆状态
  const assistantMemoryActive = useAppSelector((state) => state.memory?.assistantMemoryActive || false)
  const assistantMemories = useAppSelector((state) => {
    const allAssistantMemories = state.memory?.assistantMemories || []
    // 只显示当前助手的记忆
    return assistantId ? allAssistantMemories.filter((memory) => memory.assistantId === assistantId) : []
  })

  // 添加助手记忆的状态
  const [newMemoryContent, setNewMemoryContent] = useState('')

  // 添加新的助手记忆
  const handleAddMemory = useCallback(() => {
    if (newMemoryContent.trim() && assistantId) {
      addAssistantMemoryItem(newMemoryContent.trim(), assistantId)
      setNewMemoryContent('') // 清空输入框
    }
  }, [newMemoryContent, assistantId])

  // 删除助手记忆
  const handleDeleteMemory = useCallback(
    (id: string) => {
      dispatch(deleteAssistantMemory(id))
    },
    [dispatch]
  )

  return (
    <StyledModal
      title={t('settings.memory.assistantMemory') || '助手记忆'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}>
      <div>
        <Text type="secondary">
          {t('settings.memory.assistantMemoryDescription') ||
            '助手记忆是与特定助手关联的记忆，可以帮助助手记住重要信息。'}
        </Text>

        <div style={{ marginTop: 16 }}>
          <MemoryInput
            value={newMemoryContent}
            onChange={(e) => setNewMemoryContent(e.target.value)}
            placeholder={t('settings.memory.addAssistantMemoryPlaceholder') || '添加助手记忆...'}
            autoSize={{ minRows: 2, maxRows: 4 }}
            disabled={!assistantMemoryActive}
          />
          <Button
            type="primary"
            onClick={handleAddMemory}
            disabled={!assistantMemoryActive || !newMemoryContent.trim()}>
            {t('settings.memory.addAssistantMemory') || '添加助手记忆'}
          </Button>
        </div>

        <div style={{ marginTop: 16 }}>
          {assistantMemories.length > 0 ? (
            <MemoryList
              itemLayout="horizontal"
              dataSource={assistantMemories}
              renderItem={(memory: any) => (
                <List.Item
                  actions={[
                    <Tooltip title={t('settings.memory.delete') || '删除'} key="delete">
                      <Button
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteMemory(memory.id as string)}
                        type="text"
                        danger
                      />
                    </Tooltip>
                  ]}>
                  <List.Item.Meta
                    title={<div style={{ wordBreak: 'break-word' }}>{memory.content as string}</div>}
                    description={new Date(memory.createdAt as string).toLocaleString()}
                  />
                </List.Item>
              )}
            />
          ) : (
            <EmptyContainer
              description={
                !assistantMemoryActive
                  ? t('settings.memory.assistantMemoryDisabled') || '助手记忆功能已禁用'
                  : t('settings.memory.noAssistantMemories') || '无助手记忆'
              }
            />
          )}
        </div>
      </div>
    </StyledModal>
  )
}

// 静态方法，用于显示弹窗
AssistantMemoryPopup.show = (props: Omit<AssistantMemoryPopupProps, 'open' | 'onClose'>) => {
  const div = document.createElement('div')
  document.body.appendChild(div)

  const close = () => {
    Modal.destroyAll()
    if (div && div.parentNode) {
      div.parentNode.removeChild(div)
    }
  }

  Modal.confirm({
    content: (
      <Provider store={store}>
        <AssistantMemoryPopup open={true} onClose={close} {...props} />
      </Provider>
    ),
    icon: null,
    footer: null,
    width: 500,
    closable: true,
    centered: true,
    maskClosable: true,
    className: 'assistant-memory-popup'
  })
}

export default AssistantMemoryPopup
