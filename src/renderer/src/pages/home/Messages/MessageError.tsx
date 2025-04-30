import { MCPToolResponse, Message } from '@renderer/types'
import { formatErrorMessage } from '@renderer/utils/error'
import { Alert as AntdAlert } from 'antd'
import { FC, memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import Markdown from '../Markdown/Markdown'

// 创建默认的空数组，用于 Markdown props
const DEFAULT_TOOL_RESPONSES: MCPToolResponse[] = []

const MessageError: FC<{ message: Message }> = ({ message }) => {
  const { t } = useTranslation()
  const [activeToolKeys, setActiveToolKeys] = useState<string[]>([])
  const [copiedToolMap, setCopiedToolMap] = useState<Record<string, boolean>>({})
  const [editingToolId, setEditingToolId] = useState<string | null>(null)
  const [editedToolParamsString, setEditedToolParamsString] = useState('')

  // 处理工具相关的回调函数
  const handleToolCopy = (_content: string, toolId: string) => {
    setCopiedToolMap((prev) => ({ ...prev, [toolId]: true }))
  }

  const handleToolRerun = () => {
    // 实现工具重新运行的逻辑
  }

  const handleToolEdit = () => {
    // 实现工具编辑的逻辑
  }

  const handleToolSave = () => {
    setEditingToolId(null)
  }

  const handleToolCancel = () => {
    setEditingToolId(null)
  }

  const handleToolParamsChange = (newParams: string) => {
    setEditedToolParamsString(newParams)
  }

  // 创建通用的 Markdown props
  const markdownProps = {
    toolResponses: DEFAULT_TOOL_RESPONSES,
    activeToolKeys,
    copiedToolMap,
    editingToolId,
    editedToolParamsString,
    onToolToggle: setActiveToolKeys,
    onToolCopy: handleToolCopy,
    onToolRerun: handleToolRerun,
    onToolEdit: handleToolEdit,
    onToolSave: handleToolSave,
    onToolCancel: handleToolCancel,
    onToolParamsChange: handleToolParamsChange
  }

  // 首先检查是否存在已知的问题错误
  if (message.error && typeof message.error === 'object') {
    // 处理 rememberInstructions 错误
    if (message.error.message === 'rememberInstructions is not defined') {
      return (
        <>
          <Markdown message={message} {...markdownProps} />
          <Alert description="消息加载时发生错误" type="error" />
        </>
      )
    }

    // 处理网络错误
    if (message.error.message === 'network error') {
      return (
        <>
          <Markdown message={message} {...markdownProps} />
          <Alert description={t('error.network')} type="error" />
        </>
      )
    }
  }

  return (
    <>
      <Markdown message={message} {...markdownProps} />
      {message.error && (
        <Markdown
          message={{
            ...message,
            content: formatErrorMessage(message.error)
          }}
          {...markdownProps}
        />
      )}
      <MessageErrorInfo message={message} />
    </>
  )
}

// 将常量提取到组件外部，避免在每次渲染时重新创建
const HTTP_ERROR_CODES = [400, 401, 403, 404, 429, 500, 502, 503, 504]

// 使用 memo 包装 MessageErrorInfo 组件
const MessageErrorInfo: FC<{ message: Message }> = memo(({ message }) => {
  const { t } = useTranslation()

  // Add more robust checks: ensure error is an object and status is a number before accessing/including
  if (
    message.error &&
    typeof message.error === 'object' && // Check if error is an object
    typeof message.error.status === 'number' && // Check if status is a number
    HTTP_ERROR_CODES.includes(message.error.status) // Now safe to access status
  ) {
    return <Alert description={t(`error.http.${message.error.status}`)} type="error" />
  }

  return <Alert description={t('error.chat.response')} type="error" />
})

const Alert = styled(AntdAlert)`
  margin: 15px 0 8px;
  padding: 10px;
  font-size: 12px;
`

// 使用 memo 包装组件，避免不必要的重渲染
export default memo(MessageError)
