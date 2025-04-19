import { DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { Box } from '@renderer/components/Layout'
import { TopView } from '@renderer/components/TopView'
import { addAssistantMemoryItem } from '@renderer/services/MemoryService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import store from '@renderer/store'
import { deleteAssistantMemory } from '@renderer/store/memory'
import { Button, Card, Col, Empty, Input, List, message, Modal, Row, Statistic, Tooltip } from 'antd'
import _ from 'lodash'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createSelector } from 'reselect'
import styled from 'styled-components'

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
`

const MemoryContent = styled.div`
  word-break: break-word;
`

interface ShowParams {
  assistantId: string
}

interface Props extends ShowParams {
  resolve: (data: any) => void
}

const PopupContainer: React.FC<Props> = ({ assistantId, resolve }) => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const [open, setOpen] = useState(true)

  // 创建记忆选择器 - 使用createSelector进行记忆化
  const selectAssistantMemoriesByAssistantId = useMemo(
    () =>
      createSelector(
        [(state) => state.memory?.assistantMemories || [], (_state, assistantId) => assistantId],
        (assistantMemories, assistantId) => {
          return assistantId ? assistantMemories.filter((memory) => memory.assistantId === assistantId) : []
        }
      ),
    []
  )

  // 获取助手记忆状态
  const assistantMemoryActive = useAppSelector((state) => state.memory?.assistantMemoryActive || false)

  // 定义助手记忆类型
  interface AssistantMemory {
    id: string
    content: string
    assistantId: string
    createdAt: string
  }

  const assistantMemories = useAppSelector((state) =>
    selectAssistantMemoriesByAssistantId(state, assistantId)
  ) as AssistantMemory[]

  // 获取分析统计数据
  const totalAnalyses = useAppSelector((state) => state.memory?.analysisStats?.totalAnalyses || 0)
  const successfulAnalyses = useAppSelector((state) => state.memory?.analysisStats?.successfulAnalyses || 0)
  const successRate = totalAnalyses ? (successfulAnalyses / totalAnalyses) * 100 : 0
  const avgAnalysisTime = useAppSelector((state) => state.memory?.analysisStats?.averageAnalysisTime || 0)

  // 添加助手记忆的状态
  const [newMemoryContent, setNewMemoryContent] = useState('')

  // 添加新的助手记忆 - 使用防抖减少频繁更新
  const handleAddMemory = useCallback(
    _.debounce(() => {
      if (newMemoryContent.trim() && assistantId) {
        addAssistantMemoryItem(newMemoryContent.trim(), assistantId)
        setNewMemoryContent('') // 清空输入框
      }
    }, 300),
    [newMemoryContent, assistantId]
  )

  // 删除助手记忆 - 直接删除无需确认，使用节流避免频繁删除操作
  const handleDeleteMemory = useCallback(
    _.throttle(async (id: string) => {
      // 先从当前状态中获取要删除的记忆之外的所有记忆
      const state = store.getState().memory
      const filteredAssistantMemories = state.assistantMemories.filter((memory) => memory.id !== id)

      // 执行删除操作
      dispatch(deleteAssistantMemory(id))

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
          console.log(`[AssistantMemoryPopup] Successfully deleted assistant memory with ID ${id}`)
          message.success(t('settings.memory.deleteSuccess') || '删除成功')
        } else {
          console.error(`[AssistantMemoryPopup] Failed to delete assistant memory with ID ${id}`)
          message.error(t('settings.memory.deleteError') || '删除失败')
        }
      } catch (error) {
        console.error('[AssistantMemoryPopup] Failed to delete assistant memory:', error)
        message.error(t('settings.memory.deleteError') || '删除失败')
      }
    }, 500),
    [dispatch, t]
  )

  const onClose = () => {
    setOpen(false)
  }

  const afterClose = () => {
    resolve({})
  }

  AssistantMemoryPopup.hide = onClose

  return (
    <Modal
      title={t('settings.memory.assistantMemory') || '助手记忆'}
      open={open}
      onCancel={onClose}
      afterClose={afterClose}
      footer={null}
      width={500}
      centered>
      <Box mb={16}>
        <Input.TextArea
          value={newMemoryContent}
          onChange={(e) => setNewMemoryContent(e.target.value)}
          placeholder={t('settings.memory.addAssistantMemoryPlaceholder') || '添加助手记忆...'}
          autoSize={{ minRows: 2, maxRows: 4 }}
          disabled={!assistantMemoryActive || !assistantId}
        />
        <ButtonGroup>
          <Button
            type="primary"
            onClick={() => handleAddMemory()}
            disabled={!assistantMemoryActive || !newMemoryContent.trim() || !assistantId}>
            {t('settings.memory.addAssistantMemory') || '添加助手记忆'}
          </Button>
        </ButtonGroup>
      </Box>

      {/* 性能监控统计信息 */}
      <Box mb={16}>
        <Card
          size="small"
          title={t('settings.memory.performanceStats') || '系统性能统计'}
          extra={<InfoCircleOutlined />}>
          <Row gutter={16}>
            <Col span={8}>
              <Statistic
                title={t('settings.memory.totalAnalyses') || '总分析次数'}
                value={totalAnalyses}
                precision={0}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={t('settings.memory.successRate') || '成功率'}
                value={successRate}
                precision={1}
                suffix="%"
              />
            </Col>
            <Col span={8}>
              <Statistic
                title={t('settings.memory.avgAnalysisTime') || '平均分析时间'}
                value={avgAnalysisTime}
                precision={0}
                suffix="ms"
              />
            </Col>
          </Row>
        </Card>
      </Box>

      <MemoriesList>
        {assistantMemories.length > 0 ? (
          <List
            itemLayout="horizontal"
            dataSource={assistantMemories}
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
            description={
              !assistantId
                ? t('settings.memory.noCurrentAssistant') || '无当前助手'
                : t('settings.memory.noAssistantMemories') || '无助手记忆'
            }
          />
        )}
      </MemoriesList>
    </Modal>
  )
}

const MemoriesList = styled.div`
  max-height: 300px;
  overflow-y: auto;
`

const TopViewKey = 'AssistantMemoryPopup'

export default class AssistantMemoryPopup {
  static hide: () => void = () => {}
  static show(props: ShowParams) {
    return new Promise<any>((resolve) => {
      TopView.show(
        <PopupContainer
          {...props}
          resolve={(v) => {
            resolve(v)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
