import type { Message, ThinkingMessageBlock } from '@renderer/types/newMessageTypes'
import React from 'react'
import styled from 'styled-components'

interface Props {
  block: ThinkingMessageBlock
  messageStatus?: Message['status']
  messageMetrics?: Message['metrics']
}

const ThinkingBlock: React.FC<Props> = ({ block }) => {
  // 创建思考过程的显示组件
  return (
    <ThinkingContainer>
      <ThinkingHeader>思考过程</ThinkingHeader>
      <ThinkingContent>{block.content}</ThinkingContent>
    </ThinkingContainer>
  )
}

const ThinkingContainer = styled.div`
  background-color: var(--color-background-1);
  border-radius: 8px;
  padding: 10px 15px;
  margin-bottom: 15px;
  border: 1px solid var(--color-border-1);
`

const ThinkingHeader = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-2);
  margin-bottom: 5px;
`

const ThinkingContent = styled.pre`
  font-family: monospace;
  font-size: 13px;
  white-space: pre-wrap;
  color: var(--color-text-1);
  margin: 0;
  line-height: 1.5;
`

export default React.memo(ThinkingBlock)