import { isSupportedReasoningEffortGrokModel } from '@renderer/config/models'
import { Assistant, Model } from '@renderer/types'
import { Select } from 'antd'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ReasoningEffortOptions } from './index'

interface ThinkingSelectProps {
  model: Model
  assistant: Assistant
  value?: ReasoningEffortOptions | null
  onChange?: (value: ReasoningEffortOptions) => void
}

interface OptionType {
  label: string
  value: ReasoningEffortOptions
}

export default function ThinkingSelect({ model, assistant, value, onChange }: ThinkingSelectProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

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

  const currentValue = value ?? assistant.settings?.reasoning_effort ?? null

  const handleChange = (newValue: ReasoningEffortOptions) => {
    onChange?.(newValue)
    setOpen(false)
  }

  return (
    <>
      <Select
        placement="topRight"
        options={options}
        value={currentValue}
        onChange={handleChange}
        style={{ minWidth: 120 }}
        open={open}
        onDropdownVisibleChange={setOpen}
      />
    </>
  )
}
