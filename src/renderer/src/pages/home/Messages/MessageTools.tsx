import {
  CheckOutlined,
  CopyOutlined,
  EditOutlined,
  ExpandAltOutlined,
  LoadingOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons'
import { useSettings } from '@renderer/hooks/useSettings'
import { useAppDispatch } from '@renderer/store'
import { updateMessageThunk } from '@renderer/store/messages'
import { MCPToolResponse, Message } from '@renderer/types'
import { message as antdMessage, Tooltip } from 'antd' // Removed Modal
import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react' // Removed useLayoutEffect, useRef
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import CustomCollapse from './CustomCollapse'
// Removed ExpandedResponseContent import
import ToolResponseContent from './ToolResponseContent'

interface Props {
  message: Message
}

const MessageTools: FC<Props> = ({ message }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([])
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({})
  // Removed expandedResponse state
  const [editingToolId, setEditingToolId] = useState<string | null>(null)
  const [editedParams, setEditedParams] = useState<string>('')
  const { t } = useTranslation()
  const { messageFont } = useSettings() // Removed fontSize
  const dispatch = useAppDispatch()

  // Local state for immediate UI updates, synced with message metadata
  const [localToolResponses, setLocalToolResponses] = useState<MCPToolResponse[]>(message.metadata?.mcpTools || [])

  // Effect to sync local state when message metadata changes externally
  useEffect(() => {
    // Only update local state if the incoming metadata is actually different
    // This prevents unnecessary re-renders if the message object reference changes but content doesn't
    const incomingTools = message.metadata?.mcpTools || []
    if (JSON.stringify(incomingTools) !== JSON.stringify(localToolResponses)) {
      setLocalToolResponses(incomingTools)
    }
  }, [message.metadata?.mcpTools]) // Removed localToolResponses from dependency array

  const fontFamily = useMemo(() => {
    return messageFont === 'serif'
      ? 'serif'
      : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans","Helvetica Neue", sans-serif'
  }, [messageFont])

  const copyContent = useCallback(
    (content: string, toolId: string) => {
      navigator.clipboard.writeText(content)
      antdMessage.success({ content: t('message.copied'), key: 'copy-message' })
      setCopiedMap((prev) => ({ ...prev, [toolId]: true }))
      setTimeout(() => setCopiedMap((prev) => ({ ...prev, [toolId]: false })), 2000)
    },
    [t]
  )

  // --- Handlers for Edit/Rerun ---
  const handleRerun = useCallback(
    (toolCall: MCPToolResponse, currentParamsString: string) => {
      console.log('Rerunning tool:', toolCall.id, 'with params:', currentParamsString)
      try {
        const paramsToRun = JSON.parse(currentParamsString)

        // Proactively update local state for immediate UI feedback
        setLocalToolResponses((prevResponses) =>
          prevResponses.map((tc) =>
            tc.id === toolCall.id ? { ...tc, args: paramsToRun, status: 'invoking', response: undefined } : tc
          )
        )

        const serverConfig = message.enabledMCPs?.find((server) => server.id === toolCall.tool.serverId)
        if (!serverConfig) {
          console.error(`[MessageTools] Server config not found for ID ${toolCall.tool.serverId}`)
          antdMessage.error({ content: t('common.rerun_failed_server_not_found'), key: 'rerun-tool' })
          return
        }

        window.api.mcp
          .rerunTool(message.id, toolCall.id, serverConfig, toolCall.tool.name, paramsToRun)
          .then(() => antdMessage.success({ content: t('common.rerun_started'), key: 'rerun-tool' }))
          .catch((err) => {
            console.error('Rerun failed:', err)
            antdMessage.error({ content: t('common.rerun_failed'), key: 'rerun-tool' })
            // Optionally revert local state on failure
            setLocalToolResponses(
              (prevResponses) => prevResponses.map((tc) => (tc.id === toolCall.id ? { ...tc, status: 'done' } : tc)) // Revert status
            )
          })
      } catch (e) {
        console.error('Invalid JSON parameters for rerun:', e)
        antdMessage.error(t('common.invalid_json'))
        // Revert local state if JSON parsing fails
        setLocalToolResponses(
          (prevResponses) => prevResponses.map((tc) => (tc.id === toolCall.id ? { ...tc, status: 'done' } : tc)) // Revert status
        )
      }
    },
    [message.id, message.enabledMCPs, t, dispatch] // Added dispatch
  )

  const handleEdit = useCallback((toolCall: MCPToolResponse) => {
    setEditingToolId(toolCall.id)
    setEditedParams(JSON.stringify(toolCall.args || {}, null, 2))
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingToolId(null)
    setEditedParams('')
  }, [])

  const handleSaveEdit = useCallback(
    (toolCall: MCPToolResponse) => {
      handleRerun(toolCall, editedParams)
      setEditingToolId(null)
      setEditedParams('')
    },
    [editedParams, handleRerun]
  )

  const handleParamsChange = useCallback((newParams: string) => {
    setEditedParams(newParams)
  }, [])
  // --- End Handlers ---

  // --- Listener for Rerun Updates & Persistence ---
  useEffect(() => {
    const cleanupListener = window.api.mcp.onToolRerunUpdate((update) => {
      if (update.messageId !== message.id) return // Ignore updates for other messages

      console.log('[MessageTools] Received rerun update:', update)

      // --- Update Local State for Immediate UI Feedback ---
      setLocalToolResponses((currentLocalResponses) => {
        return currentLocalResponses.map((toolCall) => {
          if (toolCall.id === update.toolCallId) {
            let updatedCall: MCPToolResponse
            switch (update.status) {
              case 'rerunning':
                // Note: 'rerunning' status from IPC translates to 'invoking' in UI
                updatedCall = { ...toolCall, status: 'invoking', args: update.args, response: undefined }
                break
              case 'done':
                updatedCall = {
                  ...toolCall,
                  status: 'done',
                  response: update.response,
                  // Persist the args used for the successful rerun
                  args: update.args !== undefined ? update.args : toolCall.args
                }
                break
              case 'error':
                updatedCall = {
                  ...toolCall,
                  status: 'done', // Keep UI status as 'done' even on error
                  response: { content: [{ type: 'text', text: update.error }], isError: true },
                  // Persist the args used for the failed rerun
                  args: update.args !== undefined ? update.args : toolCall.args
                }
                break
              default:
                updatedCall = toolCall // Should not happen
            }
            return updatedCall
          }
          return toolCall
        })
      })
      // --- End Local State Update ---

      // --- Persist Changes to Global Store and DB (only on final states) ---
      if (update.status === 'done' || update.status === 'error') {
        // IMPORTANT: Use the message prop directly to get the state *before* this update cycle
        const previousMcpTools = message.metadata?.mcpTools || []
        console.log(
          '[MessageTools Persistence] Previous MCP Tools from message.metadata:',
          JSON.stringify(previousMcpTools, null, 2)
        ) // Log previous state

        const updatedMcpToolsForPersistence = previousMcpTools.map((toolCall) => {
          if (toolCall.id === update.toolCallId) {
            console.log(
              `[MessageTools Persistence] Updating tool ${toolCall.id} with status ${update.status}, args:`,
              update.args,
              'response:',
              update.response || update.error
            ) // Log update details
            // Apply the final state directly from the update object
            return {
              ...toolCall, // Keep existing id, tool info
              status: 'done', // Final status is always 'done' for persistence
              args: update.args !== undefined ? update.args : toolCall.args, // Persist the args used for the rerun
              response:
                update.status === 'error'
                  ? { content: [{ type: 'text', text: update.error }], isError: true } // Create error response object
                  : update.response // Use the successful response
            }
          }
          return toolCall // Keep other tool calls as they were
        })

        console.log(
          '[MessageTools Persistence] Calculated MCP Tools for Persistence:',
          JSON.stringify(updatedMcpToolsForPersistence, null, 2)
        ) // Log calculated state

        // Dispatch the thunk to update the message globally
        // Ensure we have the necessary IDs
        if (message.topicId && message.id) {
          console.log(
            `[MessageTools Persistence] Dispatching updateMessageThunk for message ${message.id} in topic ${message.topicId}`
          ) // Log dispatch attempt
          dispatch(
            updateMessageThunk(message.topicId, message.id, {
              metadata: {
                ...message.metadata, // Keep other metadata
                mcpTools: updatedMcpToolsForPersistence // Provide the correctly calculated final array
              }
            })
          )
          console.log(
            '[MessageTools] Dispatched updateMessageThunk with calculated persistence data for tool:',
            update.toolCallId
          )
        } else {
          console.error('[MessageTools] Missing topicId or messageId, cannot dispatch update.')
        }
      }
      // --- End Persistence Logic ---
    })

    return () => cleanupListener()
    // Ensure all necessary dependencies are included
  }, [message.id, message.topicId, message.metadata, dispatch]) // message.metadata is crucial here
  // --- End Listener ---

  // Use localToolResponses for rendering
  const toolResponses = localToolResponses

  // Removed responseStringsRef and its useLayoutEffect

  // Memoize collapse items
  const collapseItems = useMemo(() => {
    return toolResponses.map((toolResponse) => {
      const { id, tool, args, status, response } = toolResponse
      const isInvoking = status === 'invoking'
      const isDone = status === 'done'
      const hasError = isDone && response?.isError === true
      const params = args || {}
      const toolResult = response

      return {
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
                  <Tooltip
                    title={activeKeys.includes(id) ? t('common.collapse') : t('common.expand')}
                    mouseEnterDelay={0.5}>
                    <ActionButton
                      onClick={(e) => {
                        e.stopPropagation()
                        // Toggle the active key for this item
                        setActiveKeys((prev) => (prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]))
                      }}>
                      <ExpandAltOutlined />
                      {activeKeys.includes(id) ? t('common.collapse') : t('common.expand')}
                    </ActionButton>
                  </Tooltip>
                  <Tooltip title={t('common.rerun')} mouseEnterDelay={0.5}>
                    <ActionButton
                      onClick={(e) => {
                        e.stopPropagation()
                        const paramsToRun = editingToolId === id ? editedParams : JSON.stringify(args || {}, null, 2)
                        handleRerun(toolResponse, paramsToRun)
                      }}>
                      <ReloadOutlined />
                      {t('common.rerun')}
                    </ActionButton>
                  </Tooltip>
                  <Tooltip title={t('common.edit')} mouseEnterDelay={0.5}>
                    <ActionButton
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(toolResponse)
                        if (!activeKeys.includes(id)) setActiveKeys((prev) => [...prev, id])
                      }}>
                      <EditOutlined />
                      {t('common.edit')}
                    </ActionButton>
                  </Tooltip>
                  <Tooltip title={t('common.copy')} mouseEnterDelay={0.5}>
                    <ActionButton
                      onClick={(e) => {
                        e.stopPropagation()
                        const combinedData = { params: params, response: toolResult }
                        copyContent(JSON.stringify(combinedData, null, 2), id)
                      }}>
                      {copiedMap[id] ? <CheckOutlined /> : <CopyOutlined />}
                      {copiedMap[id] ? t('common.copied') : t('common.copy')}
                    </ActionButton>
                  </Tooltip>
                </>
              )}
            </ActionButtonsContainer>
          </MessageTitleLabel>
        ),
        children: isDone ? (
          <ToolResponseContent
            params={params} // Use derived params
            response={toolResult}
            fontFamily={fontFamily}
            fontSize="12px"
            isEditing={editingToolId === id}
            editedParamsString={editedParams}
            onParamsChange={handleParamsChange}
            onSave={() => handleSaveEdit(toolResponse)}
            onCancel={handleCancelEdit}
          />
        ) : null
      }
    })
  }, [
    toolResponses,
    t,
    copiedMap,
    copyContent,
    editingToolId,
    editedParams,
    handleEdit,
    handleRerun,
    handleSaveEdit,
    handleCancelEdit,
    handleParamsChange,
    activeKeys,
    fontFamily // Added fontFamily
  ])

  if (toolResponses.length === 0) return null

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
              setActiveKeys((prev) =>
                prev.includes(item.key as string) ? prev.filter((k) => k !== item.key) : [...prev, item.key as string]
              )
            }}>
            {item.children}
          </CustomCollapse>
        ))}
      </ToolsContainer>

      {/* Removed Modal component */}
    </>
  )
}

// --- Styled Components --- (Keep existing styled components definitions)
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
  border: 1px solid var(--color-border); /* Add border */
  color: var(--color-text); /* Use primary text color for better contrast */
  cursor: pointer;
  padding: 1px 5px; /* Adjust padding for border */
  font-size: 12px; /* Smaller font size */
  font-weight: 500; /* Increase font weight */
  display: inline-flex; /* Use inline-flex for icon + text */
  align-items: center;
  gap: 4px; /* Add gap between icon and text */
  justify-content: center;
  user-select: none; /* Prevent text selection */
  opacity: 0.8; /* Slightly increase opacity */
  transition: all 0.2s;
  border-radius: 4px;

  &:hover {
    opacity: 1;
    color: var(--color-text);
    background-color: var(--color-bg-1); /* Use a subtle background on hover */
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
// --- End Styled Components ---

export default memo(MessageTools)
