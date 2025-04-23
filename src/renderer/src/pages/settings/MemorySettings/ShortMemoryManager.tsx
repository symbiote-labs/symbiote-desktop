import { DeleteOutlined } from '@ant-design/icons'
import { addShortMemoryItem } from '@renderer/services/MemoryService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { deleteShortMemory, setShortMemoryActive } from '@renderer/store/memory'
import { Button, Empty, Input, List, Switch, Tooltip, Typography } from 'antd'
import _ from 'lodash'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title } = Typography
// 不再需要确认对话框

const ShortMemoryManager = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  // 获取当前话题ID
  const currentTopicId = useAppSelector((state) => state.messages?.currentTopic?.id)

  // 获取短记忆状态
  const shortMemoryActive = useAppSelector((state) => state.memory?.shortMemoryActive || false)
  const shortMemories = useAppSelector((state) => {
    const allShortMemories = state.memory?.shortMemories || []
    // 只显示当前话题的短记忆
    return currentTopicId ? allShortMemories.filter((memory) => memory.topicId === currentTopicId) : []
  })

  // 添加短记忆的状态
  const [newMemoryContent, setNewMemoryContent] = useState('')

  // 切换短记忆功能激活状态
  const handleToggleActive = (checked: boolean) => {
    dispatch(setShortMemoryActive(checked))
  }

  // 添加新的短记忆 - 使用防抖减少频繁更新
  const handleAddMemory = useCallback(
    _.debounce(() => {
      if (newMemoryContent.trim() && currentTopicId) {
        addShortMemoryItem(newMemoryContent.trim(), currentTopicId)
        setNewMemoryContent('') // 清空输入框
      }
    }, 300),
    [newMemoryContent, currentTopicId]
  )

  // 删除短记忆 - 直接删除无需确认，使用节流避免频繁删除操作
  const handleDeleteMemory = useCallback(
    _.throttle(async (id: string) => {
      // 执行删除操作
      dispatch(deleteShortMemory(id))

      // 使用主进程的 deleteShortMemoryById 方法删除记忆
      try {
        const result = await window.api.memory.deleteShortMemoryById(id)

        if (result) {
          console.log(`[ShortMemoryManager] Successfully deleted short memory with ID ${id}`)
          // 移除消息提示，避免触发界面重新渲染
        } else {
          console.error(`[ShortMemoryManager] Failed to delete short memory with ID ${id}`)
        }
      } catch (error) {
        console.error('[ShortMemoryManager] Failed to delete short memory:', error)
      }
    }, 500),
    [dispatch]
  )

  return (
    <div className="short-memory-manager">
      <HeaderContainer>
        <Title level={4}>{t('settings.memory.shortMemory')}</Title>
        <Tooltip title={t('settings.memory.toggleShortMemoryActive')}>
          <Switch checked={shortMemoryActive} onChange={handleToggleActive} />
        </Tooltip>
      </HeaderContainer>

      <SectionContainer>
        <Input.TextArea
          value={newMemoryContent}
          onChange={(e) => setNewMemoryContent(e.target.value)}
          placeholder={t('settings.memory.addShortMemoryPlaceholder')}
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={!shortMemoryActive || !currentTopicId}
        />
        <AddButton
          type="primary"
          onClick={() => handleAddMemory()}
          disabled={!shortMemoryActive || !newMemoryContent.trim() || !currentTopicId}>
          {t('settings.memory.addShortMemory')}
        </AddButton>
      </SectionContainer>

      <div className="short-memories-list">
        {shortMemories.length > 0 ? (
          <List
            itemLayout="horizontal"
            dataSource={shortMemories}
            renderItem={(memory) => (
              <List.Item
                actions={[
                  <Tooltip title={t('settings.memory.delete')} key="delete">
                    <Button
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteMemory(memory.id)}
                      type="text"
                      danger
                    />
                  </Tooltip>
                ]}>
                <List.Item.Meta
                  title={<MemoryContent>{memory.content}</MemoryContent>}
                  description={new Date(memory.createdAt).toLocaleString()}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty
            description={!currentTopicId ? t('settings.memory.noCurrentTopic') : t('settings.memory.noShortMemories')}
          />
        )}
      </div>
    </div>
  )
}

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const SectionContainer = styled.div`
  margin-bottom: 16px;
`

const AddButton = styled(Button)`
  margin-top: 8px;
`

const MemoryContent = styled.div`
  word-break: break-word;
`

export default ShortMemoryManager
