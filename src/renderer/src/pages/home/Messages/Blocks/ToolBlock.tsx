import type { MCPToolResponse } from '@renderer/types'
import type { Message, ToolBlock as ToolBlockType } from '@renderer/types/newMessageTypes'
import React from 'react'
import styled from 'styled-components'

interface Props {
  block: ToolBlockType
}

const ToolBlock: React.FC<Props> = ({ block }) => {
  // 创建一个最小的Message对象
  const minimalMessage: Partial<Message> = {
    id: block.messageId,
    role: 'assistant',
    blocks: [block.id],
    metadata: {
      mcpTools: block.metadata?.rawMcpToolResponse ? [block.metadata.rawMcpToolResponse as MCPToolResponse] : undefined
    }
  }

  return (
    <ToolContainer>
      <ToolHeader>
        <ToolName>{block.toolName || block.toolId}</ToolName>
      </ToolHeader>
      <ToolContent>
        {typeof block.content === 'string' ? (
          <pre>{block.content}</pre>
        ) : (
          <pre>{JSON.stringify(block.content, null, 2)}</pre>
        )}
      </ToolContent>
    </ToolContainer>
  )
}

const ToolContainer = styled.div`
  border: 1px solid var(--color-border-1);
  border-radius: 8px;
  margin: 10px 0;
  overflow: hidden;
`

const ToolHeader = styled.div`
  background-color: var(--color-background-1);
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border-1);
`

const ToolName = styled.div`
  font-weight: 600;
  font-size: 14px;
`

const ToolContent = styled.div`
  padding: 10px 12px;
  overflow-x: auto;

  pre {
    margin: 0;
    white-space: pre-wrap;
    font-family: monospace;
    font-size: 13px;
  }
`

export default React.memo(ToolBlock)
