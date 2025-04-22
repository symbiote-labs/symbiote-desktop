import {
  AppstoreOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  UnorderedListOutlined
} from '@ant-design/icons'
import SelectModelPopup from '@renderer/components/Popups/SelectModelPopup'
import { useTheme } from '@renderer/context/ThemeProvider'
import { TopicManager } from '@renderer/hooks/useTopic'
import {
  analyzeAndAddShortMemories,
  resetLongTermMemoryAnalyzedMessageIds,
  useMemoryService
} from '@renderer/services/MemoryService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import store from '@renderer/store' // Import store for direct access
import {
  addMemory,
  clearMemories,
  deleteMemory,
  editMemory,
  saveAllMemorySettings,
  saveLongTermMemoryData,
  saveMemoryData,
  setAnalyzeModel,
  setAnalyzing,
  setAssistantMemoryActive,
  setAssistantMemoryAnalyzeModel,
  setAutoAnalyze,
  setFilterSensitiveInfo,
  setMemoryActive,
  setShortMemoryActive,
  setShortMemoryAnalyzeModel
} from '@renderer/store/memory'
import { Topic } from '@renderer/types'
import { Button, Empty, Input, List, message, Modal, Pagination, Radio, Select, Switch, Tabs, Tag, Tooltip } from 'antd'
import { FC, useEffect, useMemo, useRef, useState } from 'react'
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
import AssistantMemoryManager from './AssistantMemoryManager'
import CollapsibleShortMemoryManager from './CollapsibleShortMemoryManager'
import ContextualRecommendationSettings from './ContextualRecommendationSettings'
import HistoricalContextSettings from './HistoricalContextSettings'
import MemoryDeduplicationPanel from './MemoryDeduplicationPanel'
import MemoryListManager from './MemoryListManager'
import MemoryMindMap from './MemoryMindMap'
import PriorityManagementSettings from './PriorityManagementSettings'
import PromptSettings from './PromptSettings'

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
  const shortMemoryActive = useAppSelector((state) => state.memory?.shortMemoryActive || false)
  const assistantMemoryActive = useAppSelector((state) => state.memory?.assistantMemoryActive || false)
  const autoAnalyze = useAppSelector((state) => state.memory?.autoAnalyze || false)
  const filterSensitiveInfo = useAppSelector((state) => state.memory?.filterSensitiveInfo ?? true) // 默认启用敏感信息过滤
  const analyzeModel = useAppSelector((state) => state.memory?.analyzeModel || null)
  const shortMemoryAnalyzeModel = useAppSelector((state) => state.memory?.shortMemoryAnalyzeModel || null)
  const assistantMemoryAnalyzeModel = useAppSelector((state) => state.memory?.assistantMemoryAnalyzeModel || null)
  const isAnalyzing = useAppSelector((state) => state.memory?.isAnalyzing || false)

  // 从 Redux 获取所有模型，不仅仅是可用的模型
  const providers = useAppSelector((state) => state.llm?.providers || [])

  // 使用 useMemo 缓存模型数组，避免不必要的重新渲染
  const models = useMemo(() => {
    // 只获取已启用的提供商的模型
    return providers
      .filter((provider) => provider.enabled) // 只保留已启用的提供商
      .flatMap((provider) => provider.models || [])
  }, [providers])

  // 我们不再使用modelOptions，因为我们现在使用SelectModelPopup组件

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
  const [currentPage, setCurrentPage] = useState<number>(1)
  const pageSize = 15 // 每页显示15条记忆

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
  const handleDeleteMemory = async (id: string) => {
    // 先从当前状态中获取要删除的记忆之外的所有记忆
    const state = store.getState().memory
    const filteredMemories = state.memories.filter((memory) => memory.id !== id)

    // 执行删除操作
    dispatch(deleteMemory(id))

    // 保存到长期记忆文件，并强制覆盖
    try {
      await dispatch(
        saveLongTermMemoryData({
          memories: filteredMemories, // 直接使用过滤后的数组，而不是使用当前状态
          memoryLists: state.memoryLists,
          currentListId: state.currentListId,
          analyzeModel: state.analyzeModel,
          forceOverwrite: true // 强制覆盖文件，而不是尝试合并
        })
      ).unwrap()
      console.log('[Memory Settings] Long-term memories saved to file after deletion (force overwrite)')

      message.success(t('settings.memory.deleteSuccess'))
    } catch (error) {
      console.error('[Memory Settings] Failed to save long-term memory data after deletion:', error)
    }
  }

  // 保存所有设置
  const handleSaveAllSettings = async () => {
    try {
      const result = await dispatch(saveAllMemorySettings())
      if (result.meta.requestStatus === 'fulfilled') {
        message.success(t('settings.memory.saveAllSettingsSuccess') || '所有设置已成功保存')
        console.log('[Memory Settings] All memory settings saved successfully')
      } else {
        message.error(t('settings.memory.saveAllSettingsError') || '保存设置失败')
        console.error('[Memory Settings] Failed to save all memory settings:', result.payload)
      }
    } catch (error) {
      console.error('[Memory Settings] Failed to save all memory settings:', error)
      message.error(t('settings.memory.saveAllSettingsError') || '保存设置失败')
    }
  }

  // 处理清空记忆
  const handleClearMemories = async () => {
    dispatch(clearMemories(currentListId || undefined))
    setIsClearModalVisible(false)

    // 将清空后的状态保存到长期记忆文件，并强制覆盖
    try {
      // 直接传递空数组作为 memories，确保完全清空
      const state = store.getState().memory
      await dispatch(
        saveLongTermMemoryData({
          memories: [], // 直接使用空数组，而不是使用当前状态
          memoryLists: state.memoryLists,
          currentListId: state.currentListId,
          analyzeModel: state.analyzeModel,
          forceOverwrite: true // 强制覆盖文件，而不是合并
        })
      ).unwrap()
      console.log('[Memory Settings] Long-term memories saved to file after clearing (force overwrite)')
    } catch (error) {
      console.error('[Memory Settings] Failed to save long-term memory data after clearing:', error)
    }

    message.success(t('settings.memory.clearSuccess'))
  }

  // 处理切换记忆功能
  const handleToggleMemory = (checked: boolean) => {
    dispatch(setMemoryActive(checked))
  }

  // 处理切换短期记忆功能
  const handleToggleShortMemory = (checked: boolean) => {
    dispatch(setShortMemoryActive(checked))
  }

  // 处理切换助手记忆功能
  const handleToggleAssistantMemory = (checked: boolean) => {
    dispatch(setAssistantMemoryActive(checked))
  }

  // 处理切换自动分析
  const handleToggleAutoAnalyze = (checked: boolean) => {
    dispatch(setAutoAnalyze(checked))
  }

  // 处理切换敏感信息过滤
  const handleToggleFilterSensitiveInfo = async (checked: boolean) => {
    dispatch(setFilterSensitiveInfo(checked))
    console.log('[Memory Settings] Filter sensitive info set:', checked)

    // 使用Redux Thunk保存到JSON文件
    try {
      await dispatch(saveMemoryData({ filterSensitiveInfo: checked })).unwrap()
      console.log('[Memory Settings] Filter sensitive info saved to file successfully:', checked)
    } catch (error) {
      console.error('[Memory Settings] Failed to save filter sensitive info to file:', error)
    }
  }

  // 处理选择长期记忆分析模型
  const handleSelectModel = async (model: any) => {
    // 保存完整的模型信息，包含供应商
    const modelUniqId = getModelUniqId(model)
    dispatch(setAnalyzeModel(modelUniqId))
    console.log('[Memory Settings] Analyze model set:', modelUniqId, 'Provider:', model.provider)

    // 使用Redux Thunk保存到JSON文件
    try {
      await dispatch(saveMemoryData({ analyzeModel: modelUniqId })).unwrap()
      console.log('[Memory Settings] Analyze model saved to file successfully:', modelUniqId)
    } catch (error) {
      console.error('[Memory Settings] Failed to save analyze model to file:', error)
    }
  }

  // 处理选择短期记忆分析模型
  const handleSelectShortMemoryModel = async (model: any) => {
    // 保存完整的模型信息，包含供应商
    const modelUniqId = getModelUniqId(model)
    dispatch(setShortMemoryAnalyzeModel(modelUniqId))
    console.log('[Memory Settings] Short memory analyze model set:', modelUniqId, 'Provider:', model.provider)

    // 使用Redux Thunk保存到JSON文件
    try {
      await dispatch(saveMemoryData({ shortMemoryAnalyzeModel: modelUniqId })).unwrap()
      console.log('[Memory Settings] Short memory analyze model saved to file successfully:', modelUniqId)
    } catch (error) {
      console.error('[Memory Settings] Failed to save short memory analyze model to file:', error)
    }
  }

  // 处理选择助手记忆分析模型
  const handleSelectAssistantMemoryModel = async (model: any) => {
    // 保存完整的模型信息，包含供应商
    const modelUniqId = getModelUniqId(model)
    dispatch(setAssistantMemoryAnalyzeModel(modelUniqId))
    console.log('[Memory Settings] Assistant memory analyze model set:', modelUniqId, 'Provider:', model.provider)

    // 使用Redux Thunk保存到JSON文件
    try {
      await dispatch(saveMemoryData({ assistantMemoryAnalyzeModel: modelUniqId })).unwrap()
      console.log('[Memory Settings] Assistant memory analyze model saved to file successfully:', modelUniqId)
    } catch (error) {
      console.error('[Memory Settings] Failed to save assistant memory analyze model to file:', error)
    }
  }

  // 手动触发分析
  const handleManualAnalyze = async (isShortMemory: boolean = false) => {
    if (!isActive) {
      message.warning(t('settings.memory.cannotAnalyze') || '无法分析，请检查设置')
      return
    }

    // 如果没有选择话题，提示用户
    if (!selectedTopicId) {
      message.warning(t('settings.memory.selectTopicFirst') || '请先选择要分析的话题')
      return
    }

    message.info(t('settings.memory.startingAnalysis') || '开始分析...')

    if (isShortMemory) {
      // 短期记忆分析
      if (!shortMemoryAnalyzeModel) {
        message.warning(t('settings.memory.noShortMemoryModel') || '未设置短期记忆分析模型')
        return
      }

      try {
        // 调用短期记忆分析函数
        const result = await analyzeAndAddShortMemories(selectedTopicId)

        if (result) {
          message.success(t('settings.memory.shortMemoryAnalysisSuccess') || '短期记忆分析成功')
        } else {
          message.info(t('settings.memory.shortMemoryAnalysisNoNew') || '未发现新的短期记忆')
        }
      } catch (error) {
        console.error('Failed to analyze short memories:', error)
        message.error(t('settings.memory.shortMemoryAnalysisError') || '短期记忆分析失败')
      }
    } else {
      // 长期记忆分析
      if (!analyzeModel) {
        message.warning(t('settings.memory.noAnalyzeModel') || '未设置长期记忆分析模型')
        return
      }

      // 调用长期记忆分析函数，并指定为手动分析
      analyzeAndAddMemories(selectedTopicId, true)
    }
  }

  // 重置分析状态
  const handleResetAnalyzingState = () => {
    dispatch(setAnalyzing(false))
    message.success(t('settings.memory.resetAnalyzingState') || '分析状态已重置')
  }

  // 获取当前选中长期记忆模型的名称
  const getSelectedModelName = () => {
    if (!analyzeModel) return ''

    try {
      // 尝试解析JSON格式的模型ID
      let modelId = analyzeModel

      if (typeof analyzeModel === 'string' && analyzeModel.startsWith('{')) {
        const parsedModel = JSON.parse(analyzeModel)
        modelId = parsedModel.id

        // 遍历所有服务商的模型找到匹配的模型和供应商
        for (const provider of Object.values(providers)) {
          if (provider.id === parsedModel.provider) {
            const model = provider.models.find((m) => m.id === modelId)
            if (model) {
              return `${model.name} | ${provider.name}`
            }
          }
        }

        // 如果没找到匹配的模型，返回模型ID和供应商ID
        return `${modelId} | ${parsedModel.provider}`
      } else {
        // 兼容旧格式，直接根据ID查找
        for (const provider of Object.values(providers)) {
          const model = provider.models.find((m) => m.id === modelId)
          if (model) {
            return `${model.name} | ${provider.name}`
          }
        }
      }
    } catch (error) {
      console.error('Error parsing model ID:', error)
    }

    return analyzeModel
  }

  // 获取当前选中短期记忆模型的名称
  const getSelectedShortMemoryModelName = () => {
    if (!shortMemoryAnalyzeModel) return ''

    try {
      // 尝试解析JSON格式的模型ID
      let modelId = shortMemoryAnalyzeModel

      if (typeof shortMemoryAnalyzeModel === 'string' && shortMemoryAnalyzeModel.startsWith('{')) {
        const parsedModel = JSON.parse(shortMemoryAnalyzeModel)
        modelId = parsedModel.id

        // 遍历所有服务商的模型找到匹配的模型和供应商
        for (const provider of Object.values(providers)) {
          if (provider.id === parsedModel.provider) {
            const model = provider.models.find((m) => m.id === modelId)
            if (model) {
              return `${model.name} | ${provider.name}`
            }
          }
        }

        // 如果没找到匹配的模型，返回模型ID和供应商ID
        return `${modelId} | ${parsedModel.provider}`
      } else {
        // 兼容旧格式，直接根据ID查找
        for (const provider of Object.values(providers)) {
          const model = provider.models.find((m) => m.id === modelId)
          if (model) {
            return `${model.name} | ${provider.name}`
          }
        }
      }
    } catch (error) {
      console.error('Error parsing short memory model ID:', error)
    }

    return shortMemoryAnalyzeModel
  }

  // 获取当前选中助手记忆模型的名称
  const getSelectedAssistantMemoryModelName = () => {
    if (!assistantMemoryAnalyzeModel) return ''

    try {
      // 尝试解析JSON格式的模型ID
      let modelId = assistantMemoryAnalyzeModel

      if (typeof assistantMemoryAnalyzeModel === 'string' && assistantMemoryAnalyzeModel.startsWith('{')) {
        const parsedModel = JSON.parse(assistantMemoryAnalyzeModel)
        modelId = parsedModel.id

        // 遍历所有服务商的模型找到匹配的模型和供应商
        for (const provider of Object.values(providers)) {
          if (provider.id === parsedModel.provider) {
            const model = provider.models.find((m) => m.id === modelId)
            if (model) {
              return `${model.name} | ${provider.name}`
            }
          }
        }

        // 如果没找到匹配的模型，返回模型ID和供应商ID
        return `${modelId} | ${parsedModel.provider}`
      } else {
        // 兼容旧格式，直接根据ID查找
        for (const provider of Object.values(providers)) {
          const model = provider.models.find((m) => m.id === modelId)
          if (model) {
            return `${model.name} | ${provider.name}`
          }
        }
      }
    } catch (error) {
      console.error('Error parsing assistant memory model ID:', error)
    }

    return assistantMemoryAnalyzeModel
  }

  // 获取模型的完整ID，包含供应商信息
  const getModelUniqId = (model: any) => {
    return JSON.stringify({ id: model.id, provider: model.provider })
  }

  // 重置长期记忆分析标记
  const handleResetLongTermMemoryAnalyzedMessageIds = async () => {
    if (!selectedTopicId) {
      message.warning(t('settings.memory.selectTopicFirst') || '请先选择要重置的话题')
      return
    }

    try {
      const result = await resetLongTermMemoryAnalyzedMessageIds(selectedTopicId)
      if (result) {
        message.success(t('settings.memory.resetLongTermMemorySuccess') || '长期记忆分析标记已重置')

        // 重置成功后，自动触发分析
        message.info(t('settings.memory.startingAnalysis') || '开始分析...')
        setTimeout(() => {
          // 使用延时确保重置操作已完成
          analyzeAndAddMemories(selectedTopicId)
        }, 500)
      } else {
        message.info(t('settings.memory.resetLongTermMemoryNoChange') || '没有需要重置的分析标记')
      }
    } catch (error) {
      console.error('Failed to reset long-term memory analyzed message IDs:', error)
      message.error(t('settings.memory.resetLongTermMemoryError') || '重置长期记忆分析标记失败')
    }
  }

  // 添加滚动检测
  const containerRef = useRef<HTMLDivElement>(null)
  const listContainerRef = useRef<HTMLDivElement>(null)

  // 检测滚动状态并添加类
  useEffect(() => {
    const container = containerRef.current
    const listContainer = listContainerRef.current
    if (!container || !listContainer) return

    const checkMainScroll = () => {
      if (container.scrollHeight > container.clientHeight) {
        container.classList.add('scrollable')
      } else {
        container.classList.remove('scrollable')
      }
    }

    const checkListScroll = () => {
      if (listContainer.scrollHeight > listContainer.clientHeight) {
        listContainer.classList.add('scrollable')
      } else {
        listContainer.classList.remove('scrollable')
      }
    }

    // 初始检查
    checkMainScroll()
    checkListScroll()

    // 监听窗口大小变化
    window.addEventListener('resize', () => {
      checkMainScroll()
      checkListScroll()
    })

    // 监听内容变化（使用MutationObserver）
    const mainObserver = new MutationObserver(checkMainScroll)
    mainObserver.observe(container, { childList: true, subtree: true })

    const listObserver = new MutationObserver(checkListScroll)
    listObserver.observe(listContainer, { childList: true, subtree: true })

    // 主容器始终保持可滚动状态
    container.style.overflowY = 'auto'

    // 添加滚动指示器
    const addScrollIndicator = () => {
      const scrollIndicator = document.createElement('div')
      scrollIndicator.className = 'scroll-indicator'
      scrollIndicator.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background-color: var(--color-primary);
        opacity: 0.7;
        pointer-events: none;
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: opacity 0.3s ease;
      `

      // 添加箭头图标
      scrollIndicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="white"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>`

      document.body.appendChild(scrollIndicator)

      // 2秒后淡出
      setTimeout(() => {
        scrollIndicator.style.opacity = '0'
        setTimeout(() => {
          document.body.removeChild(scrollIndicator)
        }, 300)
      }, 2000)
    }

    // 首次加载时显示滚动指示器
    if (container.scrollHeight > container.clientHeight) {
      addScrollIndicator()
    }

    // 添加滚动事件监听器，当用户滚动时显示滚动指示器
    let scrollTimeout: NodeJS.Timeout | null = null
    const handleContainerScroll = () => {
      // 清除之前的定时器
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }

      // 如果容器可滚动，显示滚动指示器
      if (container.scrollHeight > container.clientHeight) {
        // 如果已经滚动到底部，不显示指示器
        if (container.scrollHeight - container.scrollTop - container.clientHeight > 20) {
          // 设置定时器，延迟显示滚动指示器
          scrollTimeout = setTimeout(() => {
            addScrollIndicator()
          }, 500)
        }
      }
    }

    container.addEventListener('scroll', handleContainerScroll)

    return () => {
      window.removeEventListener('resize', checkMainScroll)
      mainObserver.disconnect()
      listObserver.disconnect()
      // 移除滚动事件监听器
      container.removeEventListener('scroll', handleContainerScroll)
      // 清除定时器
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
    }
  }, [])

  return (
    <SettingContainer theme={theme} ref={containerRef}>
      {/* 1. 将 TabsContainer 移到 SettingContainer 顶部 */}
      <TabsContainer>
        <Tabs
          defaultActiveKey="shortMemory"
          size="large"
          animated={{ inkBar: true, tabPane: true }}
          items={[
            {
              key: 'promptSettings',
              label: (
                <TabLabelContainer>
                  <TabDot color="#52c41a">●</TabDot>
                  {t('settings.memory.promptSettings.title') || '提示词设置'} {/* Use the specific title key */}
                </TabLabelContainer>
              ),
              children: (
                <TabPaneSettingGroup theme={theme}>
                  <PromptSettings />
                </TabPaneSettingGroup>
              )
            },
            {
              key: 'assistantMemory',
              label: (
                <TabLabelContainer>
                  <TabDot color="#f5222d">●</TabDot>
                  {t('settings.memory.assistantMemory') || '助手记忆'}
                </TabLabelContainer>
              ),
              children: (
                <TabPaneSettingGroup theme={theme}>
                  <SettingTitle>{t('settings.memory.title')}</SettingTitle>
                  <SettingHelpText>{t('settings.memory.description')}</SettingHelpText>
                  <SettingDivider />

                  <SettingTitle>{t('settings.memory.assistantMemorySettings') || '助手记忆设置'}</SettingTitle>
                  <SettingHelpText>
                    {t('settings.memory.assistantMemoryDescription') ||
                      '助手记忆是与特定助手关联的记忆，可以帮助助手记住重要信息。'}
                  </SettingHelpText>
                  <SettingDivider />

                  {/* 助手记忆设置 */}
                  <SettingRow>
                    <SettingRowTitle>{t('settings.memory.enableAssistantMemory') || '启用助手记忆'}</SettingRowTitle>
                    <Switch checked={assistantMemoryActive} onChange={handleToggleAssistantMemory} />
                  </SettingRow>
                  <SettingRow>
                    <SettingRowTitle>{t('settings.memory.enableAutoAnalyze')}</SettingRowTitle>
                    <Switch checked={autoAnalyze} onChange={handleToggleAutoAnalyze} disabled={!isActive} />
                  </SettingRow>
                  <SettingRow>
                    <SettingRowTitle>
                      {t('settings.memory.filterSensitiveInfo') || '过滤敏感信息'}
                      <Tooltip
                        title={
                          t('settings.memory.filterSensitiveInfoTip') ||
                          '启用后，记忆功能将不会提取API密钥、密码等敏感信息'
                        }>
                        <InfoCircleOutlined style={{ marginLeft: 8 }} />
                      </Tooltip>
                    </SettingRowTitle>
                    <Switch
                      checked={filterSensitiveInfo}
                      onChange={handleToggleFilterSensitiveInfo}
                      disabled={!isActive}
                    />
                  </SettingRow>

                  {/* 助手记忆分析模型选择 */}
                  <SettingRow>
                    <SettingRowTitle>
                      {t('settings.memory.assistantMemoryAnalyzeModel') || '助手记忆分析模型'}
                    </SettingRowTitle>
                    <Button
                      onClick={async () => {
                        // 找到当前选中的模型对象
                        let currentModel: { id: string; provider: string; name: string; group: string } | undefined
                        if (assistantMemoryAnalyzeModel) {
                          for (const provider of Object.values(providers)) {
                            const model = provider.models.find((m) => m.id === assistantMemoryAnalyzeModel)
                            if (model) {
                              currentModel = model
                              break
                            }
                          }
                        }

                        const selectedModel = await SelectModelPopup.show({ model: currentModel })
                        if (selectedModel) {
                          handleSelectAssistantMemoryModel(selectedModel)
                        }
                      }}
                      style={{ width: 300 }}
                      disabled={!isActive}>
                      {assistantMemoryAnalyzeModel
                        ? getSelectedAssistantMemoryModelName()
                        : t('settings.memory.selectModel') || '选择模型'}
                    </Button>
                  </SettingRow>

                  <SettingDivider />

                  {/* 助手记忆管理器 */}
                  <AssistantMemoryManager />
                </TabPaneSettingGroup>
              )
            },
            {
              key: 'shortMemory',
              label: (
                <TabLabelContainer>
                  <TabDot color="#52c41a">●</TabDot>
                  {t('settings.memory.shortMemory') || '短期记忆'}
                </TabLabelContainer>
              ),
              children: (
                // 将原来<Tabs.TabPane>...</Tabs.TabPane>中的内容放在这里
                <TabPaneSettingGroup theme={theme}>
                  <SettingTitle>{t('settings.memory.title')}</SettingTitle>
                  <SettingHelpText>{t('settings.memory.description')}</SettingHelpText>
                  <SettingDivider />

                  <SettingTitle>{t('settings.memory.shortMemorySettings')}</SettingTitle>
                  <SettingHelpText>{t('settings.memory.shortMemoryDescription')}</SettingHelpText>
                  <SettingDivider />

                  {/* 短期记忆设置 */}
                  <SettingRow>
                    <SettingRowTitle>{t('settings.memory.enableShortMemory') || '启用短期记忆'}</SettingRowTitle>
                    <Switch checked={shortMemoryActive} onChange={handleToggleShortMemory} />
                  </SettingRow>
                  <SettingRow>
                    <SettingRowTitle>{t('settings.memory.enableAutoAnalyze')}</SettingRowTitle>
                    <Switch checked={autoAnalyze} onChange={handleToggleAutoAnalyze} disabled={!isActive} />
                  </SettingRow>
                  <SettingRow>
                    <SettingRowTitle>
                      {t('settings.memory.filterSensitiveInfo') || '过滤敏感信息'}
                      <Tooltip
                        title={
                          t('settings.memory.filterSensitiveInfoTip') ||
                          '启用后，记忆功能将不会提取API密钥、密码等敏感信息'
                        }>
                        <InfoCircleOutlined style={{ marginLeft: 8 }} />
                      </Tooltip>
                    </SettingRowTitle>
                    <Switch
                      checked={filterSensitiveInfo}
                      onChange={handleToggleFilterSensitiveInfo}
                      disabled={!isActive}
                    />
                  </SettingRow>

                  {/* 短期记忆分析模型选择 */}
                  <SettingRow>
                    <SettingRowTitle>
                      {t('settings.memory.shortMemoryAnalyzeModel') || '短期记忆分析模型'}
                    </SettingRowTitle>
                    <Button
                      onClick={async () => {
                        // 找到当前选中的模型对象
                        let currentModel: { id: string; provider: string; name: string; group: string } | undefined
                        if (shortMemoryAnalyzeModel) {
                          for (const provider of Object.values(providers)) {
                            const model = provider.models.find((m) => m.id === shortMemoryAnalyzeModel)
                            if (model) {
                              currentModel = model
                              break
                            }
                          }
                        }

                        const selectedModel = await SelectModelPopup.show({ model: currentModel })
                        if (selectedModel) {
                          handleSelectShortMemoryModel(selectedModel)
                        }
                      }}
                      style={{ width: 300 }}
                      disabled={!isActive}>
                      {shortMemoryAnalyzeModel
                        ? getSelectedShortMemoryModelName()
                        : t('settings.memory.selectModel') || '选择模型'}
                    </Button>
                  </SettingRow>

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
                        filterOption={(input, option) =>
                          (option?.label as string).toLowerCase().includes(input.toLowerCase())
                        }
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
                      <ButtonsContainer>
                        <Button
                          onClick={() => handleManualAnalyze(true)}
                          disabled={!shortMemoryAnalyzeModel || isAnalyzing || !isActive}
                          icon={<SearchOutlined />}>
                          {t('settings.memory.analyzeNow') || '立即分析'}
                        </Button>
                        {isAnalyzing && (
                          <Button onClick={handleResetAnalyzingState} type="default" danger>
                            {t('settings.memory.resetAnalyzingState') || '重置分析状态'}
                          </Button>
                        )}
                      </ButtonsContainer>
                    </SettingRow>
                  )}

                  <SettingDivider />

                  {/* 短期记忆去重与合并面板 */}
                  <MemoryDeduplicationPanel
                    title={t('settings.memory.shortMemoryDeduplication.title') || '短期记忆去重与合并'}
                    description={
                      t('settings.memory.shortMemoryDeduplication.description') ||
                      '分析短期记忆中的相似记忆，提供智能合并建议。'
                    }
                    translationPrefix="settings.memory.shortMemoryDeduplication"
                    isShortMemory={true}
                    // disabled={!isActive} // 移除此属性
                  />

                  <SettingDivider />

                  {/* 短记忆管理器 */}
                  <CollapsibleShortMemoryManager /* disabled={!isActive} // 移除此属性 */ />
                </TabPaneSettingGroup>
              )
            },
            {
              key: 'priorityManagement',
              label: (
                <TabLabelContainer>
                  <TabDot color="#722ed1">●</TabDot>
                  {t('settings.memory.priorityManagement.title') || '智能优先级管理'}
                </TabLabelContainer>
              ),
              children: (
                <TabPaneSettingGroup theme={theme}>
                  <PriorityManagementSettings />
                  <SettingDivider />
                  <ContextualRecommendationSettings />
                  <SettingDivider />
                  <HistoricalContextSettings />
                  <SettingDivider />

                  {/* 保存所有设置按钮 */}
                  <SettingGroup>
                    <SettingTitle>{t('settings.memory.saveAllSettings') || '保存所有设置'}</SettingTitle>
                    <SettingHelpText>
                      {t('settings.memory.saveAllSettingsDescription') ||
                        '将所有记忆功能的设置保存到文件中，确保应用重启后设置仍然生效。'}
                    </SettingHelpText>
                    <SettingRow>
                      <Button type="primary" onClick={handleSaveAllSettings}>
                        {t('settings.memory.saveAllSettings') || '保存所有设置'}
                      </Button>
                    </SettingRow>
                  </SettingGroup>
                </TabPaneSettingGroup>
              )
            },
            {
              key: 'longMemory',
              label: (
                <TabLabelContainer>
                  <TabDot color="#1890ff">●</TabDot>
                  {t('settings.memory.longMemory') || '长期记忆'}
                </TabLabelContainer>
              ),
              children: (
                // 将原来<Tabs.TabPane>...</Tabs.TabPane>中的内容放在这里
                <TabPaneSettingGroup theme={theme}>
                  <SettingTitle>{t('settings.memory.title')}</SettingTitle>
                  <SettingHelpText>{t('settings.memory.description')}</SettingHelpText>
                  <SettingDivider />

                  <SettingTitle>{t('settings.memory.longMemorySettings')}</SettingTitle>
                  <SettingHelpText>{t('settings.memory.longMemoryDescription')}</SettingHelpText>
                  <SettingDivider />

                  {/* 长期记忆设置 */}
                  <SettingRow>
                    <SettingRowTitle>{t('settings.memory.enableMemory')}</SettingRowTitle>
                    <Switch checked={isActive} onChange={handleToggleMemory} />
                  </SettingRow>
                  <SettingRow>
                    <SettingRowTitle>{t('settings.memory.enableAutoAnalyze')}</SettingRowTitle>
                    <Switch checked={autoAnalyze} onChange={handleToggleAutoAnalyze} disabled={!isActive} />
                  </SettingRow>
                  <SettingRow>
                    <SettingRowTitle>
                      {t('settings.memory.filterSensitiveInfo') || '过滤敏感信息'}
                      <Tooltip
                        title={
                          t('settings.memory.filterSensitiveInfoTip') ||
                          '启用后，记忆功能将不会提取API密钥、密码等敏感信息'
                        }>
                        <InfoCircleOutlined style={{ marginLeft: 8 }} />
                      </Tooltip>
                    </SettingRowTitle>
                    <Switch
                      checked={filterSensitiveInfo}
                      onChange={handleToggleFilterSensitiveInfo}
                      disabled={!isActive}
                    />
                  </SettingRow>

                  {/* 长期记忆分析模型选择 */}
                  <SettingRow>
                    <SettingRowTitle>{t('settings.memory.analyzeModel') || '长期记忆分析模型'}</SettingRowTitle>
                    <Button
                      onClick={async () => {
                        // 找到当前选中的模型对象
                        let currentModel: { id: string; provider: string; name: string; group: string } | undefined
                        if (analyzeModel) {
                          for (const provider of Object.values(providers)) {
                            const model = provider.models.find((m) => m.id === analyzeModel)
                            if (model) {
                              currentModel = model
                              break
                            }
                          }
                        }

                        const selectedModel = await SelectModelPopup.show({ model: currentModel })
                        if (selectedModel) {
                          handleSelectModel(selectedModel)
                        }
                      }}
                      style={{ width: 300 }}
                      disabled={!isActive}>
                      {analyzeModel ? getSelectedModelName() : t('settings.memory.selectModel') || '选择模型'}
                    </Button>
                  </SettingRow>

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
                        filterOption={(input, option) =>
                          (option?.label as string).toLowerCase().includes(input.toLowerCase())
                        }
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
                      <ButtonsContainer>
                        <Button
                          onClick={() => handleManualAnalyze(false)}
                          disabled={!analyzeModel || isAnalyzing || !isActive}
                          icon={<SearchOutlined />}>
                          {t('settings.memory.analyzeNow') || '立即分析'}
                        </Button>
                        <Button
                          onClick={handleResetLongTermMemoryAnalyzedMessageIds}
                          disabled={!selectedTopicId || !isActive}
                          type="default">
                          {t('settings.memory.resetLongTermMemory') || '重置分析标记'}
                        </Button>
                        {isAnalyzing && (
                          <Button onClick={handleResetAnalyzingState} type="default" danger>
                            {t('settings.memory.resetAnalyzingState') || '重置分析状态'}
                          </Button>
                        )}
                      </ButtonsContainer>
                    </SettingRow>
                  )}

                  <SettingDivider />

                  {/* 记忆列表管理器 */}
                  <MemoryListManager
                    onSelectList={() => {
                      // 当选择了一个记忆列表时，重置分类筛选器
                      setCategoryFilter(null)
                    }}
                    // disabled={!isActive} // 移除此属性
                  />

                  <SettingDivider />

                  {/* 长期记忆去重与合并面板 */}
                  <MemoryDeduplicationPanel
                    // title/description/prefix 由组件内部处理默认值
                    isShortMemory={false} // 明确指定为长期记忆
                    // disabled={!isActive} // 移除此属性
                  />

                  <SettingDivider />

                  {/* 记忆列表标题和操作按钮 */}
                  <MemoryListHeader>
                    <SettingTitle>{t('settings.memory.memoriesList')}</SettingTitle>
                    <ButtonGroup>
                      <StyledRadioGroup
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                        buttonStyle="solid"
                        disabled={!isActive}>
                        <Radio.Button value="list">
                          <UnorderedListOutlined /> {t('settings.memory.listView')}
                        </Radio.Button>
                        <Radio.Button value="mindmap">
                          <AppstoreOutlined /> {t('settings.memory.mindmapView')}
                        </Radio.Button>
                      </StyledRadioGroup>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setIsAddModalVisible(true)}
                        disabled={!isActive}>
                        {t('settings.memory.addMemory')}
                      </Button>
                      <Button
                        danger
                        onClick={() => setIsClearModalVisible(true)}
                        disabled={!isActive || memories.length === 0}>
                        {t('settings.memory.clearAll')}
                      </Button>
                    </ButtonGroup>
                  </MemoryListHeader>

                  {/* 分类筛选器 */}
                  {memories.length > 0 && isActive && (
                    <CategoryFilterContainer>
                      <span>{t('settings.memory.filterByCategory') || '按分类筛选：'}</span>
                      <div>
                        <TagWithCursor
                          color={categoryFilter === null ? 'blue' : undefined}
                          onClick={() => setCategoryFilter(null)}>
                          {t('settings.memory.allCategories') || '全部'}
                        </TagWithCursor>
                        {Array.from(new Set(memories.filter((m) => m.category).map((m) => m.category))).map(
                          (category) => (
                            <TagWithCursor
                              key={category}
                              color={categoryFilter === category ? 'blue' : undefined}
                              onClick={() => setCategoryFilter(category || null)}>
                              {category || t('settings.memory.uncategorized') || '未分类'}
                            </TagWithCursor>
                          )
                        )}
                      </div>
                    </CategoryFilterContainer>
                  )}

                  {/* 记忆列表 */}
                  <MemoryListContainer ref={listContainerRef}>
                    {viewMode === 'list' ? (
                      memories.length > 0 && isActive ? (
                        <div>
                          <List
                            itemLayout="horizontal"
                            style={{ minHeight: '350px' }}
                            dataSource={memories
                              .filter((memory) => (currentListId ? memory.listId === currentListId : true))
                              .filter((memory) => categoryFilter === null || memory.category === categoryFilter)
                              .slice((currentPage - 1) * pageSize, currentPage * pageSize)}
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
                                      {memory.category && <TagWithCursor color="blue">{memory.category}</TagWithCursor>}
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
                          {/* 分页组件 */}
                          {memories
                            .filter((memory) => (currentListId ? memory.listId === currentListId : true))
                            .filter((memory) => categoryFilter === null || memory.category === categoryFilter).length >
                            pageSize && (
                            <PaginationContainer>
                              <Pagination
                                current={currentPage}
                                onChange={(page) => setCurrentPage(page)}
                                total={
                                  memories
                                    .filter((memory) => (currentListId ? memory.listId === currentListId : true))
                                    .filter((memory) => categoryFilter === null || memory.category === categoryFilter)
                                    .length
                                }
                                pageSize={pageSize}
                                size="small"
                                showSizeChanger={false}
                              />
                            </PaginationContainer>
                          )}
                        </div>
                      ) : (
                        <Empty description={t('settings.memory.noMemories')} />
                      )
                    ) : isActive ? (
                      <MemoryMindMapContainer>
                        <MemoryMindMap
                          memories={memories.filter((memory) =>
                            currentListId ? memory.listId === currentListId : true
                          )}
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
                    ) : (
                      <Empty description={t('settings.memory.enableMemoryFirst') || '请先启用记忆功能'} />
                    )}
                  </MemoryListContainer>
                </TabPaneSettingGroup>
              )
            }
          ]}
        />
      </TabsContainer>
      {/* 8. 移除外部的 SettingGroup 包裹，Modal 等保持在 SettingContainer 内 */}
      {/* 添加记忆对话框 (保持不变) */}
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
  max-height: calc(60vh - 100px);
  min-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 8px;
  position: relative; /* 为滚动指示器添加定位上下文 */

  /* 确保容器高度可以自适应 */
  &:has(.ant-list) {
    height: auto;
  }

  /* 添加媒体查询以适应不同屏幕尺寸 */
  @media (min-height: 900px) {
    max-height: calc(70vh - 100px);
  }

  @media (max-height: 700px) {
    max-height: calc(50vh - 80px);
  }

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--color-primary);
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  /* 滚动指示器 */
  &::after {
    content: '';
    position: absolute;
    bottom: 10px;
    right: 10px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: var(--color-primary);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>');
    background-repeat: no-repeat;
    background-position: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transform: rotate(180deg);
  }

  &.scrollable::after {
    opacity: 0.7;
  }
`

const MemoryItemMeta = styled.div`
  display: flex;
  justify-content: space-between;
  color: var(--color-text-3);
  font-size: 12px;
`

const TabLabelContainer = styled.span`
  display: flex;
  align-items: center;
  gap: 8px;
`

const TabDot = styled.span<{ color: string }>`
  font-size: 18px;
  color: ${(props) => props.color};
`

const ButtonsContainer = styled.div`
  display: flex;
  gap: 8px;
`

const TagWithCursor = styled(Tag)`
  cursor: pointer;
  margin-right: 8px;
`

const StyledRadioGroup = styled(Radio.Group)`
  margin-right: 16px;
`

const TabPaneSettingGroup = styled(SettingGroup)`
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  margin-top: 0;
`

const MemoryMindMapContainer = styled.div`
  width: 100%;
  height: calc(60vh - 100px);
  min-height: 400px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;

  /* 添加媒体查询以适应不同屏幕尺寸 */
  @media (min-height: 900px) {
    height: calc(70vh - 100px);
  }

  @media (max-height: 700px) {
    height: calc(50vh - 80px);
  }
`

const PaginationContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 12px 0;
  border-top: 1px solid var(--color-border);
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

const TabsContainer = styled.div`
  margin: -20px -20px 0 -20px; /* 负边距使选项卡扩展到容器边缘 */

  .ant-tabs {
    width: 100%;
  }

  .ant-tabs-nav {
    margin-bottom: 0;
    background: var(--color-background-soft);
    padding: 0;
    border-radius: 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid var(--color-border);
  }

  .ant-tabs-nav::before {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 1px;
    background-color: var(--color-border);
    opacity: 0.5;
  }

  .ant-tabs-nav-wrap {
    padding: 0 8px;
  }

  .ant-tabs-tab {
    font-weight: 500;
    padding: 14px 24px;
    margin: 0 4px;
    transition: all 0.3s;
    border-radius: 8px 8px 0 0;
    position: relative;
    top: 1px;
  }

  .ant-tabs-tab:first-child {
    margin-left: 8px;
  }

  .ant-tabs-tab:hover {
    color: var(--color-primary);
    background-color: rgba(0, 0, 0, 0.02);
  }

  .ant-tabs-tab-active {
    background-color: var(--color-background-soft);
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  .ant-tabs-tab-active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background-color: var(--color-primary);
    border-radius: 3px 3px 0 0;
  }

  .ant-tabs-tab-active .ant-tabs-tab-btn {
    color: var(--color-primary) !important;
    font-weight: 600;
  }

  .ant-tabs-ink-bar {
    display: none;
  }

  .ant-tabs-content-holder {
    padding: 0;
  }

  .ant-tabs-nav-operations {
    display: none !important;
  }
`

export default MemorySettings
