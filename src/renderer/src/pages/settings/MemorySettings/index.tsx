import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined
} from '@ant-design/icons'
import { useTheme } from '@renderer/context/ThemeProvider'
import { TopicManager } from '@renderer/hooks/useTopic'
import { useMemoryService } from '@renderer/services/MemoryService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  addMemory,
  clearMemories,
  deleteMemory,
  editMemory,
  setAnalyzeModel,
  setAutoAnalyze,
  setMemoryActive
} from '@renderer/store/memory'
import { Topic } from '@renderer/types'
import { Button, Empty, Input, List, message, Modal, Radio, Select, Switch, Tag, Tooltip } from 'antd'
import { FC, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import {
  SettingContainer,
  SettingDivider,
  SettingGroup,
  SettingHelpText,
  SettingRow,
  SettingRowTitle,
  SettingTitle
} from '..'
import MemoryListManager from './MemoryListManager'
import MemoryMindMap from './MemoryMindMap'
import ShortMemoryManager from './ShortMemoryManager'

const MemorySettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { analyzeAndAddMemories } = useMemoryService()

  // 从 Redux 获取记忆状态
  const memories = useAppSelector((state) => state.memory?.memories || [])
  const memoryLists = useAppSelector((state) => state.memory?.memoryLists || [])
  const currentListId = useAppSelector((state) => state.memory?.currentListId || null)
  const isActive = useAppSelector((state) => state.memory?.isActive || false)
  const autoAnalyze = useAppSelector((state) => state.memory?.autoAnalyze || false)
  const analyzeModel = useAppSelector((state) => state.memory?.analyzeModel || null)

  // 从 Redux 获取所有模型，不仅仅是可用的模型
  const providers = useAppSelector((state) => state.llm?.providers || [])

  // 使用 useMemo 缓存模型数组，避免不必要的重新渲染
  const models = useMemo(() => {
    // 获取所有模型，不过滤可用性
    return providers.flatMap((provider) => provider.models || [])
  }, [providers])

  // 使用 useMemo 缓存模型选项数组，避免不必要的重新渲染
  const modelOptions = useMemo(() => {
    if (models.length > 0) {
      return models.map((model) => ({
        label: model.name,
        value: model.id
      }))
    } else {
      return [
        // 默认模型选项
        { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
        { label: 'GPT-4', value: 'gpt-4' },
        { label: 'Claude 3 Opus', value: 'claude-3-opus-20240229' },
        { label: 'Claude 3 Sonnet', value: 'claude-3-sonnet-20240229' },
        { label: 'Claude 3 Haiku', value: 'claude-3-haiku-20240307' }
      ]
    }
  }, [models])

  // 如果没有模型，添加一个默认模型
  useEffect(() => {
    if (models.length === 0 && !analyzeModel) {
      // 设置一个默认模型 ID
      dispatch(setAnalyzeModel('gpt-3.5-turbo'))
    }
  }, [models, analyzeModel, dispatch])

  // 获取助手列表，用于话题信息补充
  const assistants = useAppSelector((state) => state.assistants?.assistants || [])

  // 加载所有话题
  useEffect(() => {
    const loadTopics = async () => {
      try {
        // 从数据库获取所有话题
        const allTopics = await TopicManager.getAllTopics()
        if (allTopics && allTopics.length > 0) {
          // 获取话题的完整信息
          const fullTopics = allTopics.map((dbTopic) => {
            // 尝试从 Redux 中找到完整的话题信息
            for (const assistant of assistants) {
              if (assistant.topics) {
                const topic = assistant.topics.find((t) => t.id === dbTopic.id)
                if (topic) return topic
              }
            }
            // 如果找不到，返回一个基本的话题对象
            return {
              id: dbTopic.id,
              assistantId: '',
              name: `话题 ${dbTopic.id.substring(0, 8)}`,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              messages: dbTopic.messages || []
            }
          })

          // 按更新时间排序，最新的在前
          const sortedTopics = fullTopics.sort((a, b) => {
            return new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
          })
          setTopics(sortedTopics)
        }
      } catch (error) {
        console.error('Failed to load topics:', error)
      }
    }

    loadTopics()
  }, [assistants])

  // 本地状态
  const [isAddModalVisible, setIsAddModalVisible] = useState(false)
  const [isEditModalVisible, setIsEditModalVisible] = useState(false)
  const [isClearModalVisible, setIsClearModalVisible] = useState(false)
  const [newMemory, setNewMemory] = useState('')
  const [editingMemory, setEditingMemory] = useState<{ id: string; content: string } | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'mindmap'>('list')
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // 处理添加记忆
  const handleAddMemory = () => {
    if (newMemory.trim()) {
      dispatch(
        addMemory({
          content: newMemory.trim(),
          listId: currentListId || undefined
        })
      )
      setNewMemory('')
      setIsAddModalVisible(false)
      message.success(t('settings.memory.addSuccess'))
    }
  }

  // 处理编辑记忆
  const handleEditMemory = () => {
    if (editingMemory && editingMemory.content.trim()) {
      dispatch(
        editMemory({
          id: editingMemory.id,
          content: editingMemory.content.trim()
        })
      )
      setEditingMemory(null)
      setIsEditModalVisible(false)
      message.success(t('settings.memory.editSuccess'))
    }
  }

  // 处理删除记忆
  const handleDeleteMemory = (id: string) => {
    dispatch(deleteMemory(id))
    message.success(t('settings.memory.deleteSuccess'))
  }

  // 处理清空记忆
  const handleClearMemories = () => {
    dispatch(clearMemories(currentListId || undefined))
    setIsClearModalVisible(false)
    message.success(t('settings.memory.clearSuccess'))
  }

  // 处理切换记忆功能
  const handleToggleMemory = (checked: boolean) => {
    dispatch(setMemoryActive(checked))
  }

  // 处理切换自动分析
  const handleToggleAutoAnalyze = (checked: boolean) => {
    dispatch(setAutoAnalyze(checked))
  }

  // 处理选择分析模型
  const handleSelectModel = (modelId: string) => {
    dispatch(setAnalyzeModel(modelId))
  }

  // 手动触发分析
  const handleManualAnalyze = () => {
    if (isActive && analyzeModel) {
      message.info(t('settings.memory.startingAnalysis') || '开始分析...')
      // 如果选择了话题，则分析选定的话题，否则分析当前话题
      analyzeAndAddMemories(selectedTopicId || undefined)
    } else {
      message.warning(t('settings.memory.cannotAnalyze') || '无法分析，请检查设置')
    }
  }

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>{t('settings.memory.title')}</SettingTitle>
        <SettingHelpText>{t('settings.memory.description')}</SettingHelpText>
        <SettingDivider />

        {/* 记忆功能开关 */}
        <SettingRow>
          <SettingRowTitle>{t('settings.memory.enableMemory')}</SettingRowTitle>
          <Switch checked={isActive} onChange={handleToggleMemory} />
        </SettingRow>

        {/* 自动分析开关 */}
        <SettingRow>
          <SettingRowTitle>{t('settings.memory.enableAutoAnalyze')}</SettingRowTitle>
          <Switch checked={autoAnalyze} onChange={handleToggleAutoAnalyze} disabled={!isActive} />
        </SettingRow>

        {/* 分析模型选择 */}
        {autoAnalyze && isActive && (
          <SettingRow>
            <SettingRowTitle>{t('settings.memory.analyzeModel')}</SettingRowTitle>
            <Select
              style={{ width: 250 }}
              value={analyzeModel}
              onChange={handleSelectModel}
              placeholder={t('settings.memory.selectModel')}
              options={modelOptions}
            />
          </SettingRow>
        )}

        {/* 话题选择 */}
        {isActive && (
          <SettingRow>
            <SettingRowTitle>{t('settings.memory.selectTopic') || '选择话题'}</SettingRowTitle>
            <Select
              style={{ width: 350 }}
              value={selectedTopicId}
              onChange={(value) => setSelectedTopicId(value)}
              placeholder={t('settings.memory.selectTopicPlaceholder') || '选择要分析的话题'}
              allowClear
              showSearch
              filterOption={(input, option) => (option?.label as string).toLowerCase().includes(input.toLowerCase())}
              options={topics.map((topic) => ({
                label: topic.name || `话题 ${topic.id.substring(0, 8)}`,
                value: topic.id
              }))}
              popupMatchSelectWidth={false}
            />
          </SettingRow>
        )}

        {/* 手动分析按钮 */}
        {isActive && (
          <SettingRow>
            <SettingRowTitle>{t('settings.memory.manualAnalyze') || '手动分析'}</SettingRowTitle>
            <Button onClick={handleManualAnalyze} disabled={!analyzeModel} icon={<SearchOutlined />}>
              {t('settings.memory.analyzeNow') || '立即分析'}
            </Button>
          </SettingRow>
        )}

        <SettingDivider />

        {/* 短记忆管理器 */}
        <ShortMemoryManager />

        <SettingDivider />

        {/* 记忆列表管理器 */}
        <MemoryListManager
          onSelectList={() => {
            // 当选择了一个记忆列表时，重置分类筛选器
            setCategoryFilter(null)
          }}
        />

        <SettingDivider />

        {/* 记忆列表标题和操作按钮 */}
        <MemoryListHeader>
          <SettingTitle>{t('settings.memory.memoriesList')}</SettingTitle>
          <ButtonGroup>
            <Radio.Group
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              buttonStyle="solid"
              style={{ marginRight: 16 }}>
              <Radio.Button value="list">
                <UnorderedListOutlined /> {t('settings.memory.listView')}
              </Radio.Button>
              <Radio.Button value="mindmap">
                <AppstoreOutlined /> {t('settings.memory.mindmapView')}
              </Radio.Button>
            </Radio.Group>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsAddModalVisible(true)}
              disabled={!isActive}>
              {t('settings.memory.addMemory')}
            </Button>
            <Button danger onClick={() => setIsClearModalVisible(true)} disabled={!isActive || memories.length === 0}>
              {t('settings.memory.clearAll')}
            </Button>
          </ButtonGroup>
        </MemoryListHeader>

        {/* 分类筛选器 */}
        {memories.length > 0 && (
          <CategoryFilterContainer>
            <span>{t('settings.memory.filterByCategory') || '按分类筛选：'}</span>
            <div>
              <Tag
                color={categoryFilter === null ? 'blue' : undefined}
                style={{ cursor: 'pointer', marginRight: 8 }}
                onClick={() => setCategoryFilter(null)}>
                {t('settings.memory.allCategories') || '全部'}
              </Tag>
              {Array.from(new Set(memories.filter((m) => m.category).map((m) => m.category))).map((category) => (
                <Tag
                  key={category}
                  color={categoryFilter === category ? 'blue' : undefined}
                  style={{ cursor: 'pointer', marginRight: 8 }}
                  onClick={() => setCategoryFilter(category || null)}>
                  {category || t('settings.memory.uncategorized') || '未分类'}
                </Tag>
              ))}
            </div>
          </CategoryFilterContainer>
        )}

        {/* 记忆列表 */}
        <MemoryListContainer>
          {viewMode === 'list' ? (
            memories.length > 0 ? (
              <List
                itemLayout="horizontal"
                style={{ minHeight: '700px' }}
                dataSource={memories
                  .filter((memory) => (currentListId ? memory.listId === currentListId : true))
                  .filter((memory) => categoryFilter === null || memory.category === categoryFilter)}
                renderItem={(memory) => (
                  <List.Item
                    actions={[
                      <Tooltip key="edit" title={t('common.edit')}>
                        <Button
                          icon={<EditOutlined />}
                          type="text"
                          onClick={() => {
                            setEditingMemory({ id: memory.id, content: memory.content })
                            setIsEditModalVisible(true)
                          }}
                          disabled={!isActive}
                        />
                      </Tooltip>,
                      <Tooltip key="delete" title={t('common.delete')}>
                        <Button
                          icon={<DeleteOutlined />}
                          type="text"
                          danger
                          onClick={() => handleDeleteMemory(memory.id)}
                          disabled={!isActive}
                        />
                      </Tooltip>
                    ]}>
                    <List.Item.Meta
                      title={
                        <div>
                          {memory.category && (
                            <Tag color="blue" style={{ marginRight: 8 }}>
                              {memory.category}
                            </Tag>
                          )}
                          {memory.content}
                        </div>
                      }
                      description={
                        <MemoryItemMeta>
                          <span>{new Date(memory.createdAt).toLocaleString()}</span>
                          {memory.source && <span>{memory.source}</span>}
                        </MemoryItemMeta>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description={t('settings.memory.noMemories')} />
            )
          ) : (
            <MemoryMindMapContainer>
              <MemoryMindMap
                memories={memories.filter((memory) => (currentListId ? memory.listId === currentListId : true))}
                onEditMemory={(id) => {
                  const memory = memories.find((m) => m.id === id)
                  if (memory) {
                    setEditingMemory({ id: memory.id, content: memory.content })
                    setIsEditModalVisible(true)
                  }
                }}
                onDeleteMemory={handleDeleteMemory}
              />
            </MemoryMindMapContainer>
          )}
        </MemoryListContainer>
      </SettingGroup>

      {/* 添加记忆对话框 */}
      <Modal
        title={t('settings.memory.addMemory')}
        open={isAddModalVisible}
        onOk={handleAddMemory}
        onCancel={() => setIsAddModalVisible(false)}
        okButtonProps={{ disabled: !newMemory.trim() }}>
        <Input.TextArea
          rows={4}
          value={newMemory}
          onChange={(e) => setNewMemory(e.target.value)}
          placeholder={t('settings.memory.memoryPlaceholder')}
        />
      </Modal>

      {/* 编辑记忆对话框 */}
      <Modal
        title={t('settings.memory.editMemory')}
        open={isEditModalVisible}
        onOk={handleEditMemory}
        onCancel={() => setIsEditModalVisible(false)}
        okButtonProps={{ disabled: !editingMemory?.content.trim() }}>
        <Input.TextArea
          rows={4}
          value={editingMemory?.content || ''}
          onChange={(e) => setEditingMemory((prev) => (prev ? { ...prev, content: e.target.value } : null))}
          placeholder={t('settings.memory.memoryPlaceholder')}
        />
      </Modal>

      {/* 清空记忆确认对话框 */}
      <Modal
        title={t('settings.memory.clearConfirmTitle')}
        open={isClearModalVisible}
        onOk={handleClearMemories}
        onCancel={() => setIsClearModalVisible(false)}
        okButtonProps={{ danger: true }}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}>
        <p>
          {currentListId
            ? t('settings.memory.clearConfirmContentList', {
                name: memoryLists.find((list) => list.id === currentListId)?.name || ''
              })
            : t('settings.memory.clearConfirmContent')}
        </p>
      </Modal>
    </SettingContainer>
  )
}

const MemoryListHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`

const MemoryListContainer = styled.div`
  max-height: 800px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 8px;

  /* 确保容器高度可以自适应 */
  &:has(.ant-list) {
    height: auto;
  }
`

const MemoryItemMeta = styled.div`
  display: flex;
  justify-content: space-between;
  color: var(--color-text-3);
  font-size: 12px;
`

const MemoryMindMapContainer = styled.div`
  width: 100%;
  height: 800px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
`

const CategoryFilterContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 8px;

  > span {
    margin-right: 8px;
    font-weight: 500;
  }

  > div {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
`

export default MemorySettings
