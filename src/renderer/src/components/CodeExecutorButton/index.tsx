import { LoadingOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface CodeExecutorButtonProps {
  language: string
  code: string
  onClick: () => void
  isLoading?: boolean
  disabled?: boolean
}

const CodeExecutorButton: React.FC<CodeExecutorButtonProps> = ({
  language,
  // code 参数在组件内部未使用，但在接口中保留以便将来可能的扩展
  // code,
  onClick,
  isLoading = false,
  disabled = false
}) => {
  const { t } = useTranslation()
  const supportedLanguages = ['javascript', 'js', 'python', 'py']

  // 检查语言是否支持
  const isSupported = supportedLanguages.includes(language.toLowerCase())

  if (!isSupported) {
    return null
  }

  return (
    <Tooltip title={isLoading ? t('code.executing') : t('code.execute')} placement="top">
      <StyledButton onClick={onClick} disabled={disabled || isLoading} aria-label={t('code.execute')}>
        {isLoading ? <LoadingOutlined /> : <PlayCircleOutlined />}
      </StyledButton>
    </Tooltip>
  )
}

const StyledButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text);
  font-size: 16px;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
`

export default CodeExecutorButton
