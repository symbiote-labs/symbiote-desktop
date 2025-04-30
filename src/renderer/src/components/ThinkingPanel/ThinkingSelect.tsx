import { isSupportedReasoningEffortGrokModel } from '@renderer/config/models'
import { Assistant, Model } from '@renderer/types'
import { List } from 'antd'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { ReasoningEffortOptions } from './index'

interface ThinkingSelectProps {
  model: Model
  assistant: Assistant
  value: ReasoningEffortOptions
  onChange: (value: ReasoningEffortOptions) => void
}

interface OptionType {
  label: string
  value: ReasoningEffortOptions
}

export default function ThinkingSelect({ model, value, onChange }: ThinkingSelectProps) {
  const { t } = useTranslation()

  const baseOptions = useMemo(
    () =>
      [
        { label: t('assistants.settings.reasoning_effort.low'), value: 'low' },
        { label: t('assistants.settings.reasoning_effort.medium'), value: 'medium' },
        { label: t('assistants.settings.reasoning_effort.high'), value: 'high' }
      ] as OptionType[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const options = useMemo(
    () =>
      isSupportedReasoningEffortGrokModel(model)
        ? baseOptions.filter((option) => option.value === 'low' || option.value === 'high')
        : baseOptions,
    [model, baseOptions]
  )

  return (
    <List
      dataSource={options}
      renderItem={(option) => (
        <StyledListItem $isSelected={value === option.value} onClick={() => onChange(option.value)}>
          <ReasoningEffortLabel>{option.label}</ReasoningEffortLabel>
        </StyledListItem>
      )}
    />
  )
}

const ReasoningEffortLabel = styled.div`
  font-size: 16px;
  font-family: Ubuntu;
`

const StyledListItem = styled(List.Item)<{ $isSelected: boolean }>`
  cursor: pointer;
  padding: 8px 16px;
  margin: 4px 0;
  font-family: Ubuntu;
  border-radius: var(--list-item-border-radius);
  font-size: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.3s;
  background-color: ${(props) => (props.$isSelected ? 'var(--color-background-soft)' : 'transparent')};

  .ant-list-item {
    border: none !important;
  }

  &:hover {
    background-color: var(--color-background-soft);
  }
`
