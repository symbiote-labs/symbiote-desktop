import {
  CheckOutlined,
  CopyOutlined,
  EditOutlined,
  ExpandAltOutlined,
  LoadingOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { MCPToolResponse } from '@renderer/types'
import { Tooltip } from 'antd'
import { FC, memo } from 'react'
import styled from 'styled-components'

import CustomCollapse from './CustomCollapse'
import ToolResponseContent from './ToolResponseContent'

interface Props {
  toolResponse: MCPToolResponse
  isActive: boolean
  isCopied: boolean
  isEditing: boolean
  editedParamsString: string
  fontFamily: string
  t: any // Use any type for t to avoid TFunction error
  onToggle: () => void
  onCopy: (content: string, toolId: string) => void
  onRerun: (toolCall: MCPToolResponse, currentParamsString: string) => void
  onEdit: (toolCall: MCPToolResponse) => void
  onSave: () => void // Changed from (toolCall: MCPToolResponse) => void to match ToolResponseContent
  onCancel: () => void
  onParamsChange: (newParams: string) => void
}

const SingleToolCallBlock: FC<Props> = ({
  toolResponse,
  isActive,
  isCopied,
  isEditing,
  editedParamsString,
  fontFamily,
  t,
  onToggle,
  onCopy,
  onRerun,
  onEdit,
  onSave,
  onCancel,
  onParamsChange
}) => {
  console.log('[SingleToolCallBlock] Rendering for ID:', toolResponse.id, 'isActive:', isActive) // Log isActive prop
  const { id, tool, args, status, response } = toolResponse
  const isInvoking = status === 'invoking'
  const isDone = status === 'done'
  const hasError = isDone && response?.isError === true
  const params = args || {}
  const toolResult = response

  const handleCopyClick = () => {
    const combinedData = { params: params, response: toolResult }
    onCopy(JSON.stringify(combinedData, null, 2), id)
  }

  const handleRerunClick = () => {
    const paramsToRun = isEditing ? editedParamsString : JSON.stringify(args || {}, null, 2)
    onRerun(toolResponse, paramsToRun)
  }

  const handleEditClick = () => {
    onEdit(toolResponse)
    if (!isActive) onToggle() // Expand if not active
  }

  const handleSaveClick = () => {
    onSave() // Changed from onSave(toolResponse) to onSave()
  }

  const handleCancelClick = () => {
    onCancel()
  }

  const handleParamsChangeClick = (e: any) => {
    // Removed React.ChangeEvent<HTMLTextAreaElement> type
    onParamsChange(e.target.value)
  }

  return (
    <CustomCollapse
      key={id}
      id={id}
      title={
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
                <Tooltip title={isActive ? t('common.collapse') : t('common.expand')} mouseEnterDelay={0.5}>
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log('[SingleToolCallBlock] Expand/Collapse button clicked for ID:', id) // Log button click
                      onToggle()
                      console.log('[SingleToolCallBlock] onToggle prop called for ID:', id) // Log onToggle call
                    }}>
                    <ExpandAltOutlined />
                    {isActive ? t('common.collapse') : t('common.expand')}
                  </ActionButton>
                </Tooltip>
                <Tooltip title={t('common.rerun')} mouseEnterDelay={0.5}>
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log('[SingleToolCallBlock] Rerun button clicked for ID:', id) // Log button click
                      handleRerunClick()
                    }}>
                    <ReloadOutlined />
                    {t('common.rerun')}
                  </ActionButton>
                </Tooltip>
                <Tooltip title={t('common.edit')} mouseEnterDelay={0.5}>
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log('[SingleToolCallBlock] Edit button clicked for ID:', id) // Log button click
                      handleEditClick()
                    }}>
                    <EditOutlined />
                    {t('common.edit')}
                  </ActionButton>
                </Tooltip>
                <Tooltip title={t('common.copy')} mouseEnterDelay={0.5}>
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation()
                      console.log('[SingleToolCallBlock] Copy button clicked for ID:', id) // Log button click
                      handleCopyClick()
                    }}>
                    {isCopied ? <CheckOutlined /> : <CopyOutlined />}
                    {isCopied ? t('common.copied') : t('common.copy')}
                  </ActionButton>
                </Tooltip>
              </>
            )}
          </ActionButtonsContainer>
        </MessageTitleLabel>
      }
      isActive={isActive}
      onToggle={onToggle}>
      {isDone ? (
        <ToolResponseContent
          params={params}
          response={toolResult}
          fontFamily={fontFamily}
          fontSize="12px"
          isEditing={isEditing}
          editedParamsString={editedParamsString}
          onParamsChange={handleParamsChangeClick}
          onSave={handleSaveClick}
          onCancel={handleCancelClick}
        />
      ) : null}
    </CustomCollapse>
  )
}

// --- Styled Components ---
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
  font-weight: 600;
  color: var(--color-primary);
  border: 1px solid var(--color-primary-light, #40a9ff);
  border-radius: 4px;
  padding: 2px 8px;
  background-color: var(--color-bg-1);
  font-size: 13px;
  display: inline-block;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
`

const StatusIndicator = styled.span<{ $isInvoking?: boolean; $hasError?: boolean }>`
  font-size: 12px;
  color: ${(props) =>
    props.$isInvoking ? 'var(--color-warning)' : props.$hasError ? 'var(--color-error)' : 'var(--color-success)'};
  display: flex;
  align-items: center;
`

const ActionButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
`

const ActionButton = styled.button`
  background: none;
  border: 1px solid var(--color-border);
  color: var(--color-text);
  cursor: pointer;
  padding: 1px 5px;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  justify-content: center;
  user-select: none;
  opacity: 0.8;
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

export default memo(SingleToolCallBlock)
