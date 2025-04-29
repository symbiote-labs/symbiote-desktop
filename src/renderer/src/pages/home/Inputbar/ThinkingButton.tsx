import { isReasoningModel } from '@renderer/config/models'
import { Assistant, Model } from '@renderer/types'
import { Tooltip } from 'antd'
import { Brain } from 'lucide-react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  model: Model
  assistant: Assistant
  ToolbarButton: any
  onToggleThinking: () => void
}

const ThinkingButton: FC<Props> = ({ model, assistant, ToolbarButton, onToggleThinking }) => {
  const { t } = useTranslation()

  if (!isReasoningModel(model)) {
    return null
  }

  return (
    <Tooltip placement="top" title={t('chat.input.thinking')} arrow>
      <ToolbarButton type="text" disabled={!isReasoningModel(model)} onClick={onToggleThinking}>
        <Brain size={18} color={assistant.enableThinking ? 'var(--color-link)' : 'var(--color-icon)'} />
      </ToolbarButton>
    </Tooltip>
  )
}

export default ThinkingButton
