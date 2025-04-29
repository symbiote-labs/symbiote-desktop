import { DEFAULT_MAX_TOKENS } from '@renderer/config/constant'
import {
  isSupportedReasoningEffortModel,
  isSupportedThinkingTokenClaudeModel,
  isSupportedThinkingTokenModel
} from '@renderer/config/models'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { Assistant, Model } from '@renderer/types'
import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import ThinkingSelect from './ThinkingSelect'
import ThinkingSlider from './ThinkingSlider'

const THINKING_TOKEN_MAP: Record<string, { min: number; max: number }> = {
  // Gemini models
  '^gemini-.*$': { min: 0, max: 24576 },

  // Qwen models
  '^qwen-plus-.*$': { min: 0, max: 38912 },
  '^qwen-turbo-.*$': { min: 0, max: 38912 },
  '^qwq-.*$': { min: 0, max: 32768 },
  '^qvq-.*$': { min: 0, max: 16384 },
  '^qwen3-0\\.6b$': { min: 0, max: 30720 },
  '^qwen3-1\\.7b$': { min: 0, max: 30720 },
  '^qwen3-.*$': { min: 0, max: 38912 },

  // Claude models
  '^claude-3.*sonnet$': { min: 0, max: 64000 }
}

export type ReasoningEffortOptions = 'low' | 'medium' | 'high'

// Helper function to find matching token limit
const findTokenLimit = (modelId: string): { min: number; max: number } | undefined => {
  for (const [pattern, limits] of Object.entries(THINKING_TOKEN_MAP)) {
    if (new RegExp(pattern).test(modelId)) {
      return limits
    }
  }
  return undefined
}

interface ThinkingPanelProps {
  model: Model
  assistant: Assistant
}

export default function ThinkingPanel({ model, assistant }: ThinkingPanelProps) {
  const { updateAssistantSettings } = useAssistant(assistant.id)
  const isSupportedThinkingToken = isSupportedThinkingTokenModel(model)
  const isSupportedReasoningEffort = isSupportedReasoningEffortModel(model)
  const thinkingTokenRange = findTokenLimit(model.id)
  const { t } = useTranslation()

  // 获取当前的thinking_budget值
  // 如果thinking_budget未设置，则使用null表示默认行为
  const currentThinkingBudget =
    assistant.settings?.thinking_budget !== undefined ? assistant.settings.thinking_budget : null

  // 获取maxTokens值
  const maxTokens = assistant.settings?.maxTokens || DEFAULT_MAX_TOKENS

  // 检查budgetTokens是否大于maxTokens
  const isBudgetExceedingMax = useMemo(() => {
    if (currentThinkingBudget === null) return false
    return currentThinkingBudget > maxTokens
  }, [currentThinkingBudget, maxTokens])

  // 使用useEffect显示错误消息
  useEffect(() => {
    if (isBudgetExceedingMax && isSupportedThinkingTokenClaudeModel(model)) {
      window.message.error(t('chat.input.thinking_budget_exceeds_max'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBudgetExceedingMax, model])

  const onTokenChange = useCallback(
    (value: number | null) => {
      // 如果值为null，则删除thinking_budget设置，使用默认行为
      if (value === null) {
        updateAssistantSettings({ thinking_budget: undefined })
      } else {
        updateAssistantSettings({ thinking_budget: value })
      }
    },
    [updateAssistantSettings]
  )

  const onReasoningEffortChange = useCallback(
    (value: ReasoningEffortOptions) => {
      updateAssistantSettings({ reasoning_effort: value })
    },
    [updateAssistantSettings]
  )

  if (isSupportedThinkingToken) {
    return (
      <>
        <ThinkingSlider
          model={model}
          value={currentThinkingBudget}
          min={thinkingTokenRange?.min ?? 0}
          max={thinkingTokenRange?.max ?? 0}
          onChange={onTokenChange}
        />
      </>
    )
  }

  if (isSupportedReasoningEffort) {
    const currentReasoningEffort = assistant.settings?.reasoning_effort

    return (
      <ThinkingSelect
        model={model}
        assistant={assistant}
        value={currentReasoningEffort}
        onChange={onReasoningEffortChange}
      />
    )
  }

  return null
}
