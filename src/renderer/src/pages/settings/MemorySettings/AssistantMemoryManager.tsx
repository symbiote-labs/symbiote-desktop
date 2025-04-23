import { DeleteOutlined } from '@ant-design/icons'
import { addAssistantMemoryItem } from '@renderer/services/MemoryService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import store from '@renderer/store'
import { deleteAssistantMemory, setAssistantMemoryActive } from '@renderer/store/memory'
import { Button, Empty, Input, List, Select, Switch, Tooltip, Typography } from 'antd'
import _ from 'lodash'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Title } = Typography

const StyledSelect = styled(Select<string>)`
  width: 100%;
  margin-bottom: 16px;
`

const AssistantMemoryManager = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  // 获取所有助手
  const assistants = useAppSelector((state) => state.assistants?.assistants || [])

  // 获取当前助手ID
  const currentAssistantId = useAppSelector((state) => state.messages?.currentAssistant?.id)

  // 添加助手选择器状态
  const [selectedAssistantId, setSelectedAssistantId] = useState('')

  // 初始化选中的助手ID
  useEffect(() => {
    if (currentAssistantId && !selectedAssistantId) {
      setSelectedAssistantId(currentAssistantId)
    }
  }, [currentAssistantId, selectedAssistantId])

  // 获取助手记忆状态
  const assistantMemoryActive = useAppSelector((state) => state.memory?.assistantMemoryActive || false)
  const assistantMemories = useAppSelector((state) => {
    const allAssistantMemories = state.memory?.assistantMemories || []
    // 只显示选中助手的记忆
    return selectedAssistantId
      ? allAssistantMemories.filter((memory) => memory.assistantId === selectedAssistantId)
      : []
  })

  // 添加助手记忆的状态
  const [newMemoryContent, setNewMemoryContent] = useState('')

  // 切换助手记忆功能激活状态
  const handleToggleActive = (checked: boolean) => {
    dispatch(setAssistantMemoryActive(checked))
  }

  // 添加新的助手记忆 - 使用防抖减少频繁更新
  const handleAddMemory = useCallback(() => {
    const debouncedAdd = _.debounce(() => {
      if (newMemoryContent.trim() && selectedAssistantId) {
        addAssistantMemoryItem(newMemoryContent.trim(), selectedAssistantId)
        setNewMemoryContent('') // 清空输入框
      }
    }, 300)
    debouncedAdd()
  }, [newMemoryContent, selectedAssistantId])

  // 删除助手记忆 - 直接删除无需确认，使用节流避免频繁删除操作
  const handleDeleteMemory = useCallback(
    (id: string) => {
      const throttledDelete = _.throttle(async (memoryId: string) => {
        // 先从当前状态中获取要删除的记忆之外的所有记忆
        const state = store.getState().memory
        const filteredAssistantMemories = state.assistantMemories.filter((memory) => memory.id !== memoryId)

        // 执行删除操作
        dispatch(deleteAssistantMemory(memoryId))

        // 直接使用 window.api.memory.saveData 方法保存过滤后的列表
        try {
          // 加载当前文件数据
          const currentData = await window.api.memory.loadData()

          // 替换 assistantMemories 数组，保留其他重要设置
          const newData = {
            ...currentData,
            assistantMemories: filteredAssistantMemories,
            assistantMemoryActive: currentData.assistantMemoryActive,
            assistantMemoryAnalyzeModel: currentData.assistantMemoryAnalyzeModel
          }

          // 使用 true 参数强制覆盖文件
          const result = await window.api.memory.saveData(newData, true)

          if (result) {
            console.log(`[AssistantMemoryManager] Successfully deleted assistant memory with ID ${memoryId}`)
            // 移除消息提示，避免触发界面重新渲染
          } else {
            console.error(`[AssistantMemoryManager] Failed to delete assistant memory with ID ${memoryId}`)
          }
        } catch (error) {
          console.error('[AssistantMemoryManager] Failed to delete assistant memory:', error)
        }
      }, 500)
      throttledDelete(id)
    },
    [dispatch]
  )

  return (
    <div className="assistant-memory-manager">
      <HeaderContainer>
        <Title level={4}>{t('settings.memory.assistantMemory') || '助手记忆'}</Title>
        <Tooltip title={t('settings.memory.toggleAssistantMemoryActive') || '切换助手记忆功能'}>
          <Switch checked={assistantMemoryActive} onChange={handleToggleActive} />
        </Tooltip>
      </HeaderContainer>

      {/* 助手选择器 */}
      <SectionContainer>
        <StyledSelect
          value={selectedAssistantId}
          onChange={(value: string) => setSelectedAssistantId(value)}
          placeholder={t('settings.memory.selectAssistant') || '选择助手'}
          disabled={!assistantMemoryActive}>
          {assistants.map((assistant) => (
            <Select.Option key={assistant.id} value={assistant.id}>
              {assistant.name}
            </Select.Option>
          ))}
        </StyledSelect>
      </SectionContainer>

      <SectionContainer>
        <Input.TextArea
          value={newMemoryContent}
          onChange={(e) => setNewMemoryContent(e.target.value)}
          placeholder={t('settings.memory.addAssistantMemoryPlaceholder') || '添加助手记忆...'}
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={!assistantMemoryActive || !selectedAssistantId}
        />
        <AddButton
          type="primary"
          onClick={() => handleAddMemory()}
          disabled={!assistantMemoryActive || !newMemoryContent.trim() || !selectedAssistantId}>
          {t('settings.memory.addAssistantMemory') || '添加助手记忆'}
        </AddButton>
      </SectionContainer>

      <div className="assistant-memories-list">
        {assistantMemories.length > 0 ? (
          <List
            itemLayout="horizontal"
            dataSource={assistantMemories}
            renderItem={(memory) => (
              <List.Item
                actions={[
                  <Tooltip title={t('settings.memory.delete') || '删除'} key="delete">
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
            description={
              !selectedAssistantId
                ? t('settings.memory.selectAssistantFirst') || '请先选择助手'
                : t('settings.memory.noAssistantMemories') || '无助手记忆'
            }
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

export default AssistantMemoryManager
