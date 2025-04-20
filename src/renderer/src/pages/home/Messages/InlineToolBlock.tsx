import { CheckOutlined, LoadingOutlined, WarningOutlined } from '@ant-design/icons'
import { MCPCallToolResponse } from '@renderer/types'
import { FC, memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface InlineToolBlockProps {
  toolName: string
  toolArgs: any
  status: 'pending' | 'invoking' | 'done'
  response?: MCPCallToolResponse
  fontFamily?: string
}

const InlineToolBlock: FC<InlineToolBlockProps> = ({ toolName, toolArgs, status, response, fontFamily }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const isInvoking = status === 'invoking'
  const isDone = status === 'done'
  const hasError = isDone && response?.isError === true

  // 格式化参数显示
  const formattedArgs = typeof toolArgs === 'object' ? JSON.stringify(toolArgs, null, 2) : String(toolArgs)

  // 处理响应内容
  const getResponseContent = () => {
    if (!response) return ''

    // 如果有content属性，则尝试提取文本
    if (response.content && Array.isArray(response.content)) {
      const textContent = response.content
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('\n')

      if (textContent) return textContent
    }

    // 如果没有文本内容，则返回完整响应
    return JSON.stringify(response, null, 2)
  }

  // 获取响应内容
  const responseContent = getResponseContent()

  return (
    <ToolBlockContainer className="inline-tool-block">
      <ToolHeader onClick={() => setIsExpanded(!isExpanded)}>
        <ToolInfo>
          <ToolName>{toolName}</ToolName>
          <StatusIndicator $isInvoking={isInvoking} $hasError={hasError}>
            {isInvoking
              ? t('message.tools.invoking')
              : hasError
                ? t('message.tools.error')
                : t('message.tools.completed')}
            {isInvoking && <LoadingOutlined spin style={{ marginLeft: 6 }} />}
            {isDone && !hasError && <CheckOutlined style={{ marginLeft: 6 }} />}
            {hasError && <WarningOutlined style={{ marginLeft: 6 }} />}
          </StatusIndicator>
        </ToolInfo>
      </ToolHeader>

      {isExpanded && (
        <ToolContent>
          {toolArgs && (
            <ToolSection>
              <SectionTitle>参数:</SectionTitle>
              <CodeBlock style={{ fontFamily }}>{formattedArgs}</CodeBlock>
            </ToolSection>
          )}

          {isDone && response && (
            <ToolSection>
              <SectionTitle>结果:</SectionTitle>
              <CodeBlock style={{ fontFamily }}>{responseContent}</CodeBlock>
            </ToolSection>
          )}

          {isInvoking && (
            <LoadingContainer>
              <LoadingOutlined spin />
              <span style={{ marginLeft: 8 }}>正在调用工具...</span>
            </LoadingContainer>
          )}
        </ToolContent>
      )}
    </ToolBlockContainer>
  )
}

const ToolBlockContainer = styled.div`
  margin: 10px 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background-color: var(--color-bg-1);
`

const ToolHeader = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  background-color: var(--color-bg-2);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  user-select: none;
`

const ToolInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const ToolName = styled.span`
  font-weight: 500;
  color: var(--color-text);
`

const StatusIndicator = styled.span<{ $isInvoking: boolean; $hasError?: boolean }>`
  color: ${(props) => {
    if (props.$hasError) return 'var(--color-error, #ff4d4f)'
    if (props.$isInvoking) return 'var(--color-primary)'
    return 'var(--color-success, #52c41a)'
  }};
  font-size: 12px;
  display: flex;
  align-items: center;
  opacity: 0.85;
  border-left: 1px solid var(--color-border);
  padding-left: 8px;
`

const ToolContent = styled.div`
  padding: 12px;
`

const ToolSection = styled.div`
  margin-bottom: 12px;

  &:last-child {
    margin-bottom: 0;
  }
`

const SectionTitle = styled.div`
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--color-text-2);
  font-size: 12px;
`

const CodeBlock = styled.pre`
  margin: 0;
  padding: 8px;
  background-color: var(--color-bg-2);
  border-radius: 4px;
  overflow: auto;
  font-size: 12px;
  color: var(--color-text);
  max-height: 200px;
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  color: var(--color-text-2);
`

export default memo(InlineToolBlock)
