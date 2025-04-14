import { DeleteOutlined } from '@ant-design/icons'
import { addShortMemoryItem } from '@renderer/services/MemoryService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import store from '@renderer/store'
import { deleteShortMemory, setShortMemoryActive } from '@renderer/store/memory'
import { Button, Empty, Input, List, Switch, Tooltip, Typography } from 'antd'
import _ from 'lodash'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
      // 先从当前状态中获取要删除的记忆之外的所有记忆
      const state = store.getState().memory
      const filteredShortMemories = state.shortMemories.filter((memory) => memory.id !== id)

      // 执行删除操作
      dispatch(deleteShortMemory(id))

      // 直接使用 window.api.memory.saveData 方法保存过滤后的列表
      try {
        // 加载当前文件数据
        const currentData = await window.api.memory.loadData()

        // 替换 shortMemories 数组
        const newData = {
          ...currentData,
          shortMemories: filteredShortMemories
        }

        // 使用 true 参数强制覆盖文件
        const result = await window.api.memory.saveData(newData, true)

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4}>{t('settings.memory.shortMemory')}</Title>
        <Tooltip title={t('settings.memory.toggleShortMemoryActive')}>
          <Switch checked={shortMemoryActive} onChange={handleToggleActive} />
        </Tooltip>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Input.TextArea
          value={newMemoryContent}
          onChange={(e) => setNewMemoryContent(e.target.value)}
          placeholder={t('settings.memory.addShortMemoryPlaceholder')}
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={!shortMemoryActive || !currentTopicId}
        />
        <Button
          type="primary"
          onClick={() => handleAddMemory()}
          style={{ marginTop: 8 }}
          disabled={!shortMemoryActive || !newMemoryContent.trim() || !currentTopicId}>
          {t('settings.memory.addShortMemory')}
        </Button>
      </div>

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
                  title={<div style={{ wordBreak: 'break-word' }}>{memory.content}</div>}
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

export default ShortMemoryManager
