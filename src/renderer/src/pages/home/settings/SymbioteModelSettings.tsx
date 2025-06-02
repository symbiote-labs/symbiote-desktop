import { useAssistant } from '@renderer/hooks/useAssistant'
import { Assistant } from '@renderer/types'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import SelectModelButton from '../components/SelectModelButton'

interface Props {
  assistant: Assistant
}

const SymbioteModelSettings: FC<Props> = ({ assistant }) => {
  const { t } = useTranslation()
  const { assistant: currentAssistant } = useAssistant(assistant.id)

  return (
    <Container className="selectable">
      <HeaderSection>
        <SectionTitle>{t('settings.model')}</SectionTitle>
        <SectionDescription>
          Select and configure the AI model for your current assistant
        </SectionDescription>
      </HeaderSection>

      <ModelSelectionSection>
        <ModelSelectionLabel>Current Model</ModelSelectionLabel>
        <SelectModelButton assistant={currentAssistant} />
      </ModelSelectionSection>
    </Container>
  )
}

const Container = styled.div`
  width: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`

const HeaderSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
`

const SectionDescription = styled.p`
  margin: 0;
  font-size: 14px;
  color: var(--color-text-2);
  line-height: 1.5;
`

const ModelSelectionSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background: var(--color-background-soft);
  border-radius: 8px;
  border: 1px solid var(--color-border);
`

const ModelSelectionLabel = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
`

export default SymbioteModelSettings