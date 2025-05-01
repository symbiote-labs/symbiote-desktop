import {
  MdiLightbulbOffOutline,
  MdiLightbulbOn10,
  MdiLightbulbOn50,
  MdiLightbulbOn90
} from '@renderer/components/Icons/SVGIcon'
import { QuickPanelListItem, useQuickPanel } from '@renderer/components/QuickPanel'
import {
  isSupportedReasoningEffortGrokModel,
  isSupportedReasoningEffortModel,
  isSupportedThinkingTokenModel
} from '@renderer/config/models'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { Assistant, Model } from '@renderer/types'
import { Tooltip } from 'antd'
import { FC, ReactElement, useCallback, useImperativeHandle, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export type ReasoningEffortOptions = 'low' | 'medium' | 'high'

const THINKING_TOKEN_MAP: Record<string, { min: number; max: number }> = {
  // Gemini models
  'gemini-.*$': { min: 0, max: 24576 },

  // Qwen models
  'qwen-plus-.*$': { min: 0, max: 38912 },
  'qwen-turbo-.*$': { min: 0, max: 38912 },
  'qwen3-0\\.6b$': { min: 0, max: 30720 },
  'qwen3-1\\.7b$': { min: 0, max: 30720 },
  'qwen3-.*$': { min: 0, max: 38912 },

  // Claude models
  'claude-3[.-]7.*sonnet.*$': { min: 0, max: 64000 }
}

// Helper function to find matching token limit
const findTokenLimit = (modelId: string): { min: number; max: number } | undefined => {
  for (const [pattern, limits] of Object.entries(THINKING_TOKEN_MAP)) {
    if (new RegExp(pattern).test(modelId)) {
      return limits
    }
  }
  return undefined
}

// 根据模型和选择的思考档位计算thinking_budget值
const calculateThinkingBudget = (model: Model, option: ReasoningEffortOptions | null): number | undefined => {
  if (!option || !isSupportedThinkingTokenModel(model)) {
    return undefined
  }

  const tokenLimits = findTokenLimit(model.id)
  if (!tokenLimits) return undefined

  const { min, max } = tokenLimits

  switch (option) {
    case 'low':
      return Math.floor(min + (max - min) * 0.25)
    case 'medium':
      return Math.floor(min + (max - min) * 0.5)
    case 'high':
      return Math.floor(min + (max - min) * 0.75)
    default:
      return undefined
  }
}

export interface ThinkingButtonRef {
  openQuickPanel: () => void
}

interface Props {
  ref?: React.RefObject<ThinkingButtonRef | null>
  model: Model
  assistant: Assistant
  ToolbarButton: any
}

const ThinkingButton: FC<Props> = ({ ref, model, assistant, ToolbarButton }): ReactElement => {
  const { t } = useTranslation()
  const quickPanel = useQuickPanel()
  const { updateAssistantSettings } = useAssistant(assistant.id)

  const supportedThinkingToken = isSupportedThinkingTokenModel(model)
  const supportedReasoningEffort = isSupportedReasoningEffortModel(model)
  const isGrokModel = isSupportedReasoningEffortGrokModel(model)

  // 根据thinking_budget逆推思考档位
  const inferReasoningEffortFromBudget = useCallback(
    (model: Model, budget: number | undefined): ReasoningEffortOptions | null => {
      if (!budget || !supportedThinkingToken) return null

      const tokenLimits = findTokenLimit(model.id)
      if (!tokenLimits) return null

      const { min, max } = tokenLimits
      const range = max - min

      // 计算预算在范围内的百分比
      const normalizedBudget = (budget - min) / range

      // 根据百分比确定档位
      if (normalizedBudget <= 0.33) return 'low'
      if (normalizedBudget <= 0.66) return 'medium'
      return 'high'
    },
    [supportedThinkingToken]
  )

  const currentReasoningEffort = useMemo(() => {
    // 优先使用显式设置的reasoning_effort
    if (assistant.settings?.reasoning_effort) {
      return assistant.settings.reasoning_effort
    }

    // 如果有thinking_budget但没有reasoning_effort，则推导档位
    if (assistant.settings?.thinking_budget) {
      return inferReasoningEffortFromBudget(model, assistant.settings.thinking_budget)
    }

    return null
  }, [assistant.settings?.reasoning_effort, assistant.settings?.thinking_budget, inferReasoningEffortFromBudget, model])

  const createThinkingIcon = useCallback((option: ReasoningEffortOptions | null, isActive: boolean = false) => {
    const iconColor = isActive ? 'var(--color-link)' : 'var(--color-icon)'

    switch (true) {
      case option === 'low':
        return <MdiLightbulbOn10 width={18} height={18} style={{ color: iconColor, marginTop: -2 }} />
      case option === 'medium':
        return <MdiLightbulbOn50 width={18} height={18} style={{ color: iconColor, marginTop: -2 }} />
      case option === 'high':
        return <MdiLightbulbOn90 width={18} height={18} style={{ color: iconColor, marginTop: -2 }} />
      default:
        return <MdiLightbulbOffOutline width={18} height={18} style={{ color: iconColor }} />
    }
  }, [])

  const onThinkingChange = useCallback(
    (option: ReasoningEffortOptions | null) => {
      if (!option) {
        // 禁用思考
        updateAssistantSettings({
          reasoning_effort: undefined,
          thinking_budget: undefined
        })
        return
      }

      // 启用思考
      if (supportedReasoningEffort) {
        updateAssistantSettings({
          reasoning_effort: option
        })
      }

      if (supportedThinkingToken) {
        const budget = calculateThinkingBudget(model, option)
        updateAssistantSettings({
          reasoning_effort: option,
          thinking_budget: budget
        })
      }
    },
    [model, supportedReasoningEffort, supportedThinkingToken, updateAssistantSettings]
  )

  const baseOptions = useMemo(
    () => [
      {
        level: null,
        label: t('assistants.settings.reasoning_effort.off'),
        description: '',
        icon: createThinkingIcon(null),
        isSelected: currentReasoningEffort === null,
        action: () => onThinkingChange(null)
      },
      {
        level: 'low',
        label: t('assistants.settings.reasoning_effort.low'),
        description: '',
        icon: createThinkingIcon('low'),
        isSelected: currentReasoningEffort === 'low',
        action: () => onThinkingChange('low')
      },
      {
        level: 'medium',
        label: t('assistants.settings.reasoning_effort.medium'),
        description: '',
        icon: createThinkingIcon('medium'),
        isSelected: currentReasoningEffort === 'medium',
        action: () => onThinkingChange('medium')
      },
      {
        level: 'high',
        label: t('assistants.settings.reasoning_effort.high'),
        description: '',
        icon: createThinkingIcon('high'),
        isSelected: currentReasoningEffort === 'high',
        action: () => onThinkingChange('high')
      }
    ],
    [currentReasoningEffort, onThinkingChange, t, createThinkingIcon]
  )

  const panelItems = useMemo<QuickPanelListItem[]>(() => {
    return isGrokModel ? baseOptions.filter((option) => option.level === 'low' || option.level === 'high') : baseOptions
  }, [baseOptions, isGrokModel])

  const openQuickPanel = useCallback(() => {
    quickPanel.open({
      title: t('chat.input.thinking'),
      list: panelItems,
      symbol: 'thinking'
    })
  }, [quickPanel, panelItems, t])

  const handleOpenQuickPanel = useCallback(() => {
    if (quickPanel.isVisible && quickPanel.symbol === 'thinking') {
      quickPanel.close()
    } else {
      openQuickPanel()
    }
  }, [openQuickPanel, quickPanel])

  // 获取当前应显示的图标
  const getThinkingIcon = useCallback(() => {
    return createThinkingIcon(currentReasoningEffort, currentReasoningEffort !== null)
  }, [createThinkingIcon, currentReasoningEffort])

  useImperativeHandle(ref, () => ({
    openQuickPanel
  }))

  return (
    <Tooltip placement="top" title={t('assistants.settings.reasoning_effort')} arrow>
      <ToolbarButton type="text" onClick={handleOpenQuickPanel}>
        {getThinkingIcon()}
      </ToolbarButton>
    </Tooltip>
  )
}

export default ThinkingButton
