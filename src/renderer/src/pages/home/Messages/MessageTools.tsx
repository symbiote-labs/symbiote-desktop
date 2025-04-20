import { CheckOutlined, ExpandOutlined, LoadingOutlined, WarningOutlined } from '@ant-design/icons'
import { useSettings } from '@renderer/hooks/useSettings'
import { Message } from '@renderer/types'
import { message as antdMessage, Modal, Tooltip } from 'antd'
import { FC, memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import CustomCollapse from './CustomCollapse'
import ExpandedResponseContent from './ExpandedResponseContent'
import ToolResponseContent from './ToolResponseContent'

interface Props {
  message: Message
}

const MessageTools: FC<Props> = ({ message }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({})
  const [expandedResponse, setExpandedResponse] = useState<{ content: string; title: string } | null>(null)
  const { t } = useTranslation()
  const { messageFont, fontSize } = useSettings()
  const fontFamily = useMemo(() => {
    return messageFont === 'serif'
      ? 'serif'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans","Helvetica Neue", sans-serif'
  }, [messageFont])

  // 使用 useCallback 记忆化 copyContent 函数，避免不必要的重新创建
  const copyContent = useCallback(
    (content: string, toolId: string) => {
      navigator.clipboard.writeText(content)
      antdMessage.success({ content: t('message.copied'), key: 'copy-message' })
      setCopiedMap((prev) => ({ ...prev, [toolId]: true }))
      setTimeout(() => setCopiedMap((prev) => ({ ...prev, [toolId]: false })), 2000)
    },
    [t]
  )

  // 使用 activeKeys 状态管理折叠面板的展开/折叠状态

  const toolResponses = message.metadata?.mcpTools || []

  // 预处理响应数据，避免在展开时计算
  const responseStringsRef = useRef<Record<string, string>>({})

  // 使用 useLayoutEffect 在渲染前预处理数据
  useLayoutEffect(() => {
    const strings: Record<string, string> = {}
    let hasChanges = false

    for (const toolResponse of toolResponses) {
      if (toolResponse.status === 'done' && toolResponse.response) {
        // 如果该响应已经处理过，则跳过
        if (responseStringsRef.current[toolResponse.id]) {
          strings[toolResponse.id] = responseStringsRef.current[toolResponse.id]
          continue
        }

        try {
          strings[toolResponse.id] = JSON.stringify(toolResponse.response, null, 2)
          hasChanges = true
        } catch (error) {
          console.error('Error stringifying response:', error)
          strings[toolResponse.id] = String(toolResponse.response)
          hasChanges = true
        }
      }
    }

    if (hasChanges) {
      responseStringsRef.current = { ...responseStringsRef.current, ...strings }
    }
  }, [toolResponses])

  // 使用 useMemo 记忆化 getCollapseItems 函数返回的 items 数组，避免不必要的重新计算
  const collapseItems = useMemo(() => {
    const items: { key: string; label: React.ReactNode; children: React.ReactNode }[] = []
    // Add tool responses
    for (const toolResponse of toolResponses) {
      const { id, tool, status, response } = toolResponse
      const isInvoking = status === 'invoking'
      const isDone = status === 'done'
      const hasError = isDone && response?.isError === true
      const result = {
        params: tool.inputSchema,
        response: toolResponse.response
      }

      items.push({
        key: id,
        label: (
          <MessageTitleLabel>
            <TitleContent>
              <ToolName>{tool.name}</ToolName>
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
            </TitleContent>
            <ActionButtonsContainer>
              {isDone && response && (
                <>
                  <Tooltip title={t('common.expand')} mouseEnterDelay={0.5}>
                    <ActionButton
                      className="message-action-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        // 使用预处理的响应数据
                        setExpandedResponse({
                          content: responseStringsRef.current[id] || '',
                          title: tool.name
                        })
                      }}
                      aria-label={t('common.expand')}>
                      <ExpandOutlined />
                    </ActionButton>
                  </Tooltip>
                  <Tooltip title={t('common.copy')} mouseEnterDelay={0.5}>
                    <ActionButton
                      className="message-action-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        // 使用预处理的响应数据
                        const resultString = JSON.stringify(result, null, 2)
                        copyContent(resultString, id)
                      }}
                      aria-label={t('common.copy')}>
                      {!copiedMap[id] && <i className="iconfont icon-copy"></i>}
                      {copiedMap[id] && <CheckOutlined style={{ color: 'var(--color-primary)' }} />}
                    </ActionButton>
                  </Tooltip>
                </>
              )}
            </ActionButtonsContainer>
          </MessageTitleLabel>
        ),
        children: isDone && result && <ToolResponseContent result={result} fontFamily={fontFamily} fontSize="12px" />
      })
    }

    return items
  }, [toolResponses, t, copiedMap, copyContent])

  // 如果没有工具响应，则不渲染组件
  if (toolResponses.length === 0) {
    return null
  }

  return (
    <>
      <ToolsContainer className="message-tools-container">
        {collapseItems.map((item) => (
          <CustomCollapse
            key={item.key}
            id={item.key as string}
            title={item.label}
            isActive={activeKeys.includes(item.key as string)}
            onToggle={() => {
              if (activeKeys.includes(item.key as string)) {
                setActiveKeys(activeKeys.filter((k) => k !== item.key))
              } else {
                setActiveKeys([...activeKeys, item.key as string])
              }
            }}>
            {item.children}
          </CustomCollapse>
        ))}
      </ToolsContainer>

      <Modal
        title={expandedResponse?.title}
        open={!!expandedResponse}
        onCancel={() => setExpandedResponse(null)}
        footer={null}
        width="80%"
        centered
        destroyOnClose={true} // 关闭时销毁内容，减少内存占用
        maskClosable={true} // 点击遮罩关闭
        styles={{
          body: {
            maxHeight: '80vh',
            overflow: 'auto',
            padding: '0', // 减少内边距
            contain: 'content' // 优化渲染
          },
          mask: {
            backgroundColor: 'rgba(0, 0, 0, 0.45)', // 调整遮罩透明度
            backdropFilter: 'blur(2px)' // 模糊效果，提升视觉体验
          }
        }}>
        {expandedResponse && (
          <ExpandedResponseContent
            content={expandedResponse.content}
            fontFamily={fontFamily}
            fontSize={fontSize}
            onCopy={() => {
              navigator.clipboard.writeText(expandedResponse.content)
              antdMessage.success({ content: t('message.copied'), key: 'copy-expanded' })
            }}
          />
        )}
      </Modal>
    </>
  )
}

const MessageTitleLabel = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 26px;
  gap: 10px;
  padding: 0;
`

const TitleContent = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
`

const ToolName = styled.span`
  color: var(--color-text);
  font-weight: 500;
  font-size: 13px;
`

const StatusIndicator = styled.span<{ $isInvoking: boolean; $hasError?: boolean }>`
  color: ${(props) => {
    if (props.$hasError) return 'var(--color-error, #ff4d4f)'
    if (props.$isInvoking) return 'var(--color-primary)'
    return 'var(--color-success, #52c41a)'
  }};
  font-size: 11px;
  display: flex;
  align-items: center;
  opacity: 0.85;
  border-left: 1px solid var(--color-border);
  padding-left: 8px;
`

const ActionButtonsContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-left: auto;
`

const ToolsContainer = styled.div`
  margin-bottom: 15px;
  border-radius: 8px;
  overflow: hidden;
  background-color: var(--color-bg-1);
  border: 1px solid var(--color-border);
`

const ActionButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-2);
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: all 0.2s;
  border-radius: 4px;

  &:hover {
    opacity: 1;
    color: var(--color-text);
    background-color: var(--color-bg-1);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    opacity: 1;
  }

  .iconfont {
    font-size: 14px;
  }
`

// 使用 memo 包装组件，避免不必要的重渲染
export default memo(MessageTools)
