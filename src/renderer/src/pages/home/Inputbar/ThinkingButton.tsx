import {
  isReasoningModel,
  isSupportedReasoningEffortModel,
  isSupportedThinkingTokenModel
} from '@renderer/config/models'
import { Assistant, Model } from '@renderer/types'
import { Tooltip } from 'antd'
import { Atom, ChevronDown, ChevronUp } from 'lucide-react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  model: Model
  assistant: Assistant
  ToolbarButton: any
  onToggleThinking: () => void
  onTogglePanel: () => void
  showPanel: boolean
}

const ThinkingButton: FC<Props> = ({ model, assistant, ToolbarButton, onToggleThinking, onTogglePanel, showPanel }) => {
  const { t } = useTranslation()

  if (!isReasoningModel(model)) {
    return null
  }
  const isSupportedThinkingToken = isSupportedThinkingTokenModel(model)
  const isSupportedReasoningEffort = isSupportedReasoningEffortModel(model)

  return (
    <Tooltip placement="top" title={t('chat.input.thinking')} arrow>
      <ButtonContainer>
        <ToolbarButton type="text" disabled={!isReasoningModel(model)} onClick={onToggleThinking}>
          <Atom size={18} color={assistant.enableThinking ? 'var(--color-link)' : 'var(--color-icon)'} />
        </ToolbarButton>
        <ChevronButton onClick={onTogglePanel} disabled={!isSupportedThinkingToken && !isSupportedReasoningEffort}>
          {showPanel ? (
            <ChevronUp size={18} color={assistant.enableThinking ? 'var(--color-link)' : 'var(--color-icon)'} />
          ) : (
            <ChevronDown size={18} color={assistant.enableThinking ? 'var(--color-link)' : 'var(--color-icon)'} />
          )}
        </ChevronButton>
      </ButtonContainer>
    </Tooltip>
  )
}

const ButtonContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0px;
`

const ChevronButton = styled.button`
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--color-icon);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -8px;
  transition: all 0.3s;

  &:hover {
    color: var(--color-text-1);
  }
`

export default ThinkingButton
