import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

export interface ExecutionResultProps {
  success: boolean
  output: string
  error?: string
}

const ExecutionResult: React.FC<ExecutionResultProps> = ({ success, output, error }) => {
  const { t } = useTranslation()

  return (
    <ResultContainer>
      <ResultHeader success={success}>
        {success ? (
          <>
            <CheckCircleOutlined /> {t('code.execution.success')}
          </>
        ) : (
          <>
            <CloseCircleOutlined /> {t('code.execution.error')}
          </>
        )}
      </ResultHeader>
      <ResultContent>
        {output && (
          <OutputSection>
            <OutputTitle>{t('code.execution.output')}</OutputTitle>
            <OutputText>{output}</OutputText>
          </OutputSection>
        )}
        {error && (
          <ErrorSection>
            <ErrorTitle>{t('code.execution.error')}</ErrorTitle>
            <ErrorText>{error}</ErrorText>
          </ErrorSection>
        )}
      </ResultContent>
    </ResultContainer>
  )
}

const ResultContainer = styled.div`
  margin-top: 8px;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  overflow: hidden;
  font-family: monospace;
  font-size: 14px;
`

const ResultHeader = styled.div<{ success: boolean }>`
  padding: 8px 12px;
  background-color: ${(props) => (props.success ? 'rgba(82, 196, 26, 0.1)' : 'rgba(255, 77, 79, 0.1)')};
  color: ${(props) => (props.success ? 'var(--color-success)' : 'var(--color-error)')};
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
`

const ResultContent = styled.div`
  padding: 12px;
  background-color: var(--color-code-background);
  max-height: 300px;
  overflow: auto;
`

const OutputSection = styled.div`
  margin-bottom: 12px;
`

const OutputTitle = styled.div`
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--color-text-2);
`

const OutputText = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
`

const ErrorSection = styled.div`
  margin-top: 8px;
`

const ErrorTitle = styled.div`
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--color-error);
`

const ErrorText = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-error);
`

export default ExecutionResult
