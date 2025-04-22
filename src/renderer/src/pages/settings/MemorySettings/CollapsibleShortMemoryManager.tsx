import { ClearOutlined, DeleteOutlined } from '@ant-design/icons'
import { TopicManager } from '@renderer/hooks/useTopic'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import store from '@renderer/store'
import { deleteShortMemory } from '@renderer/store/memory'
import { Button, Collapse, Empty, List, Modal, Pagination, Tooltip, Typography } from 'antd'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 定义话题和记忆的接口
interface TopicWithMemories {
  topic: {
    id: string
    name: string
    assistantId: string
    createdAt: string
    updatedAt: string
    messages: any[]
  }
  memories: ShortMemory[]
  currentPage?: number // 当前页码
}

// 短期记忆接口
interface ShortMemory {
  id: string
  content: string
  topicId: string
  createdAt: string
  updatedAt?: string // 可选属性
}

// 记忆项组件的属性
interface MemoryItemProps {
  memory: ShortMemory
  onDelete: (id: string) => void
  t: any
  index: number // 添加索引属性，用于显示序号
}

// 样式组件
const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  width: 100%;
  color: var(--color-text-2);
`

const StyledCollapse = styled(Collapse)`
  width: 100%;
  background-color: transparent;
  border: none;

  .ant-collapse-item {
    margin-bottom: 8px;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    overflow: hidden;
  }

  .ant-collapse-header {
    background-color: var(--color-bg-2);
    padding: 8px 16px !important;
    position: relative;
  }

  /* 确保折叠图标不会遮挡内容 */
  .ant-collapse-expand-icon {
    margin-right: 8px;
  }

  .ant-collapse-content {
    border-top: 1px solid var(--color-border);
  }

  .ant-collapse-content-box {
    padding: 4px 0 !important; /* 减少上下内边距，保持左右为0 */
  }
`

const CollapseHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding-right: 24px; /* 为删除按钮留出空间 */

  /* 左侧内容区域，包含话题名称和记忆数量 */
  > span {
    margin-right: auto;
    display: flex;
    align-items: center;
  }

  /* 删除按钮样式 */
  .ant-btn {
    margin-left: 8px;
  }
`

const MemoryCount = styled.span`
  background-color: var(--color-primary);
  color: white;
  border-radius: 10px;
  padding: 0 8px;
  font-size: 12px;
  margin-left: 8px;
  min-width: 24px;
  text-align: center;
  display: inline-block;
  z-index: 1; /* 确保计数显示在最上层 */
`

const MemoryContent = styled.div`
  word-break: break-word;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 4px;
  padding: 4px 0;
`

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 12px 0;
  border-top: 1px solid var(--color-border);
`

const AnimatedListItem = styled(List.Item)`
  transition: all 0.3s ease;
  padding: 8px 24px; /* 增加左右内边距，减少上下内边距 */
  margin: 4px 0; /* 减少上下外边距 */
  border-bottom: 1px solid var(--color-border);

  &:last-child {
    border-bottom: none;
  }

  &.deleting {
    opacity: 0;
    transform: translateX(100%);
  }

  /* 增加内容区域的内边距 */
  .ant-list-item-meta {
    padding-left: 24px;
  }

  /* 调整内容区域的标题和描述文字间距 */
  .ant-list-item-meta-title {
    margin-bottom: 4px; /* 减少标题和描述之间的间距 */
  }

  .ant-list-item-meta-description {
    padding-left: 4px;
  }
`

// 记忆项组件
const MemoryItem = memo(({ memory, onDelete, t, index }: MemoryItemProps) => {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    // 添加小延迟，让动画有时间播放
    setTimeout(() => {
      onDelete(memory.id)
    }, 300)
  }

  return (
    <AnimatedListItem
      className={isDeleting ? 'deleting' : ''}
      actions={[
        <Tooltip title={t('settings.memory.delete')} key="delete">
          <Button icon={<DeleteOutlined />} onClick={handleDelete} type="text" danger />
        </Tooltip>
      ]}>
      <List.Item.Meta
        title={
          <MemoryContent>
            <strong>{index + 1}. </strong>
            {memory.content}
          </MemoryContent>
        }
        description={new Date(memory.createdAt).toLocaleString()}
      />
    </AnimatedListItem>
  )
})

// 主组件
const CollapsibleShortMemoryManager = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  // 获取短期记忆
  const shortMemories = useAppSelector((state) => state.memory?.shortMemories || [])

  // 本地状态
  const [loading, setLoading] = useState(true)
  const [topicsWithMemories, setTopicsWithMemories] = useState<TopicWithMemories[]>([])
  const [activeKeys, setActiveKeys] = useState<string[]>([])

  // 加载所有话题和对应的短期记忆
  useEffect(() => {
    const loadTopicsWithMemories = async () => {
      try {
        setLoading(true)
        // 从数据库获取所有话题
        const allTopics = await TopicManager.getAllTopics()

        // 获取所有助手及其话题，确保我们使用与左侧列表相同的话题名称
        const assistants = store.getState().assistants?.assistants || []
        const allAssistantTopics = assistants.flatMap((assistant) => assistant.topics || [])

        if (allTopics && allTopics.length > 0) {
          // 创建话题和记忆的映射
          const topicsMemories: TopicWithMemories[] = []

          for (const dbTopic of allTopics) {
            // 获取该话题的短期记忆
            const topicMemories = shortMemories.filter((memory) => memory.topicId === dbTopic.id)

            // 只添加有短期记忆的话题
            if (topicMemories.length > 0) {
              // 首先尝试从助手的话题列表中找到完整的话题信息
              let topicInfo = allAssistantTopics.find((topic) => topic.id === dbTopic.id)

              // 如果在助手话题中找不到，则尝试从数据库获取
              if (!topicInfo) {
                try {
                  const fullTopic = await TopicManager.getTopic(dbTopic.id)
                  if (fullTopic) {
                    // 数据库中的话题可能没有name属性，所以需要手动构造
                    // 使用默认的话题名称格式
                    const topicName = `话题 ${dbTopic.id.substring(0, 8)}`
                    topicInfo = {
                      id: dbTopic.id,
                      assistantId: '',
                      name: topicName,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      messages: []
                    }
                  }
                } catch (error) {
                  console.error(`Failed to get topic name for ${dbTopic.id}:`, error)
                }
              }

              // 如果还是找不到，使用默认名称
              if (!topicInfo) {
                topicInfo = {
                  id: dbTopic.id,
                  assistantId: '',
                  name: `话题 ${dbTopic.id.substring(0, 8)}`,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  messages: []
                }
              }

              topicsMemories.push({
                topic: topicInfo,
                memories: topicMemories,
                currentPage: 1 // 初始化为第一页
              })
            }
          }

          // 按更新时间排序，最新的在前
          const sortedTopicsMemories = topicsMemories.sort((a, b) => {
            // 使用最新记忆的时间进行排序
            const aLatestMemory = a.memories.sort(
              (m1, m2) => new Date(m2.createdAt).getTime() - new Date(m1.createdAt).getTime()
            )[0]

            const bLatestMemory = b.memories.sort(
              (m1, m2) => new Date(m2.createdAt).getTime() - new Date(m1.createdAt).getTime()
            )[0]

            return new Date(bLatestMemory.createdAt).getTime() - new Date(aLatestMemory.createdAt).getTime()
          })

          setTopicsWithMemories(sortedTopicsMemories)
        }
      } catch (error) {
        console.error('Failed to load topics with memories:', error)
      } finally {
        setLoading(false)
      }
    }

    if (shortMemories.length > 0) {
      loadTopicsWithMemories()
    } else {
      setTopicsWithMemories([])
      setLoading(false)
    }
  }, [shortMemories.length])

  // 处理折叠面板变化
  const handleCollapseChange = (keys: string | string[]) => {
    setActiveKeys(Array.isArray(keys) ? keys : [keys])
  }

  // 处理分页变化
  const handlePageChange = useCallback((page: number, topicId: string) => {
    setTopicsWithMemories((prev) =>
      prev.map((item) => (item.topic.id === topicId ? { ...item, currentPage: page } : item))
    )
  }, [])

  // 删除话题下的所有短期记忆
  const handleDeleteTopicMemories = useCallback(
    async (topicId: string) => {
      // 显示确认对话框
      Modal.confirm({
        title: t('settings.memory.confirmDeleteAll'),
        content: t('settings.memory.confirmDeleteAllContent'),
        okText: t('settings.memory.delete'),
        cancelText: t('settings.memory.cancel'),
        onOk: async () => {
          // 获取该话题的所有记忆
          const state = store.getState().memory
          const topicMemories = state.shortMemories.filter((memory) => memory.topicId === topicId)
          const memoryIds = topicMemories.map((memory) => memory.id)

          // 过滤掉要删除的记忆
          const filteredShortMemories = state.shortMemories.filter((memory) => memory.topicId !== topicId)

          // 更新本地状态
          setTopicsWithMemories((prev) => prev.filter((item) => item.topic.id !== topicId))

          // 更新 Redux store
          for (const id of memoryIds) {
            dispatch(deleteShortMemory(id))
          }

          // 保存到本地存储
          try {
            const currentData = await window.api.memory.loadData()
            const newData = {
              ...currentData,
              shortMemories: filteredShortMemories
            }
            const result = await window.api.memory.saveData(newData, true)

            if (result) {
              console.log(`[CollapsibleShortMemoryManager] Successfully deleted all memories for topic ${topicId}`)
            } else {
              console.error(`[CollapsibleShortMemoryManager] Failed to delete all memories for topic ${topicId}`)
            }
          } catch (error) {
            console.error('[CollapsibleShortMemoryManager] Failed to delete all memories:', error)
          }
        }
      })
    },
    [dispatch, t]
  )

  // 删除短记忆 - 直接删除无需确认
  const handleDeleteMemory = useCallback(
    async (id: string) => {
      // 在本地更新topicsWithMemories，避免触发useEffect
      setTopicsWithMemories((prev) => {
        return prev
          .map((item) => {
            // 如果该话题包含要删除的记忆，则更新该话题的记忆列表
            if (item.memories.some((memory) => memory.id === id)) {
              return {
                ...item,
                memories: item.memories.filter((memory) => memory.id !== id)
              }
            }
            return item
          })
          .filter((item) => item.memories.length > 0) // 移除没有记忆的话题
      })

      // 执行删除操作
      dispatch(deleteShortMemory(id))

      // 使用主进程的 deleteShortMemoryById 方法删除记忆
      try {
        const result = await window.api.memory.deleteShortMemoryById(id)

        if (result) {
          console.log(`[CollapsibleShortMemoryManager] Successfully deleted short memory with ID ${id}`)
          // 使用App组件而不是静态方法，避免触发重新渲染
          // message.success(t('settings.memory.deleteSuccess') || '删除成功')
        } else {
          console.error(`[CollapsibleShortMemoryManager] Failed to delete short memory with ID ${id}`)
          // message.error(t('settings.memory.deleteError') || '删除失败')
        }
      } catch (error) {
        console.error('[CollapsibleShortMemoryManager] Failed to delete short memory:', error)
        // message.error(t('settings.memory.deleteError') || '删除失败')
      }
    },
    [dispatch]
  )

  return (
    <div>
      <Typography.Title level={4}>
        {t('settings.memory.shortMemoriesByTopic') || '按话题分组的短期记忆'}
      </Typography.Title>

      {loading ? (
        <LoadingContainer>{t('settings.memory.loading') || '加载中...'}</LoadingContainer>
      ) : topicsWithMemories.length > 0 ? (
        <StyledCollapse
          activeKey={activeKeys}
          onChange={handleCollapseChange}
          items={topicsWithMemories.map(({ topic, memories, currentPage }) => ({
            key: topic.id,
            label: (
              <CollapseHeader>
                <span>
                  {topic.name}
                  <MemoryCount>{memories.length}</MemoryCount>
                </span>
                <Tooltip title={t('settings.memory.confirmDeleteAll')}>
                  <Button
                    icon={<ClearOutlined />}
                    onClick={(e) => {
                      e.stopPropagation() // 阻止事件冒泡，避免触发折叠面板的展开/收起
                      handleDeleteTopicMemories(topic.id)
                    }}
                    type="text"
                    danger
                    size="small"
                  />
                </Tooltip>
              </CollapseHeader>
            ),
            children: (
              <div>
                <List
                  itemLayout="horizontal"
                  dataSource={memories.slice(
                    (currentPage ? currentPage - 1 : 0) * 15,
                    (currentPage ? currentPage - 1 : 0) * 15 + 15
                  )}
                  style={{ padding: '4px 0' }}
                  renderItem={(memory, index) => (
                    <MemoryItem
                      key={memory.id}
                      memory={memory}
                      onDelete={handleDeleteMemory}
                      t={t}
                      index={(currentPage ? currentPage - 1 : 0) * 15 + index}
                    />
                  )}
                />
                {memories.length > 15 && (
                  <PaginationContainer>
                    <Pagination
                      current={currentPage || 1}
                      onChange={(page) => handlePageChange(page, topic.id)}
                      total={memories.length}
                      pageSize={15}
                      size="small"
                      showSizeChanger={false}
                    />
                  </PaginationContainer>
                )}
              </div>
            )
          }))}
        />
      ) : (
        <Empty description={t('settings.memory.noShortMemories') || '没有短期记忆'} />
      )}
    </div>
  )
}

export default CollapsibleShortMemoryManager
