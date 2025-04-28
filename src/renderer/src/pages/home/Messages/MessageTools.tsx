import { useAppDispatch } from '@renderer/store'
import { updateMessageThunk } from '@renderer/store/messages'
import { MCPToolResponse, Message } from '@renderer/types'
// Removed Modal
import { FC, memo, useEffect, useState } from 'react' // Removed useLayoutEffect, useRef

// Removed ExpandedResponseContent import

interface Props {
  message: Message
}

const MessageTools: FC<Props> = ({ message }) => {
  // Removed state and handlers related to tool block rendering
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

  // --- Listener for Rerun Updates & Persistence ---
  // Keep the listener as it updates the message metadata in the store
  useEffect(() => {
    const cleanupListener = window.api.mcp.onToolRerunUpdate((update) => {
      if (update.messageId !== message.id) return // Ignore updates for other messages

      console.log('[MessageTools] Received rerun update:', update)

      // --- Update Local State for Immediate UI Feedback ---
      // This part is no longer needed in MessageTools as state is in MessageContent
      // setLocalToolResponses((currentLocalResponses) => { ... });

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

  // MessageTools component no longer renders the tool blocks directly.
  // It only needs to keep the listener for persistence.
  // It returns null as it doesn't render any visible elements itself anymore.
  return null
}

// --- Styled Components --- (Removed unused styled components)

export default memo(MessageTools)
