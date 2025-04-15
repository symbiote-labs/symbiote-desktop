import { getModelUniqId } from '@renderer/services/ModelService'
import type { Model } from '@renderer/types/index'
import type { MainTextMessageBlock, Message } from '@renderer/types/newMessageTypes'
import { Flex } from 'antd'
import React, { useMemo } from 'react'
import styled from 'styled-components'

import Markdown from '../../Markdown/Markdown'

// HTML实体编码辅助函数
const encodeHTML = (str: string): string => {
  const entities: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  }
  return str.replace(/[&<>"']/g, (match) => entities[match])
}

interface Props {
  block: MainTextMessageBlock
  model?: Model
  citationsData?: Map<string, { url: string; title?: string; content?: string }>
  formattedCitations?: { number: number; url: string; hostname?: string; title?: string }[]
  mentions?: Model[]
}

const MainTextBlock: React.FC<Props> = ({
  block,
  model,
  citationsData = new Map(),
  formattedCitations = [],
  mentions = []
}) => {
  // Process content to make citation numbers clickable
  const processedContentForMarkdown = useMemo(() => {
    let content = block.content

    // Only attempt citation processing if we have citation data
    if (formattedCitations.length > 0 && citationsData.size > 0) {
      const citationUrls = formattedCitations.map((c) => c.url)

      // Logic for Perplexity/OpenRouter style: [1], [2]
      if (model?.provider === 'openrouter') {
        content = content.replace(/\[(\d+)\](?!\()/g, (match, numStr) => {
          const num = parseInt(numStr, 10)
          const index = num - 1
          if (index >= 0 && index < citationUrls.length) {
            const url = citationUrls[index]
            const citationInfo = url ? citationsData.get(url) || { url } : null
            const citationJson = url ? encodeHTML(JSON.stringify(citationInfo)) : null
            return `[<sup data-citation='${citationJson}'>${num}</sup>](${url})`
          }
          return match
        })
      } else {
        // Generic logic for [[1]], [1], [^1], [<sup>1</sup>](link)
        // Handle existing markdown links first
        content = content.replace(/\[<sup>(\d+)<\/sup>\]\(([^)]+)\)/g, (_, num, url) => {
          const citationInfo = url ? citationsData.get(url) || { url } : null
          const citationJson = citationInfo ? encodeHTML(JSON.stringify(citationInfo)) : null
          return `[<sup data-citation='${citationJson}'>${num}</sup>](${url})`
        })
        // Handle [[1]] or [1] or [^1]
        content = content.replace(/\*?\[(\^)?\[(\d+)\]\*?\]/g, (match, caret, numStr) => {
          const num = parseInt(numStr, 10)
          const index = num - 1
          if (index >= 0 && index < citationUrls.length) {
            const url = citationUrls[index]
            const citationInfo = url ? citationsData.get(url) || { url } : null
            const citationJson = citationInfo ? encodeHTML(JSON.stringify(citationInfo)) : null
            return `[<sup data-citation='${citationJson}'>${num}</sup>](${url})`
          }
          // Fallback for simple bracket numbers if no URL found
          return `[${numStr}]`
        })
      }
    }

    const toolUseRegex = /<tool_use>([\s\S]*?)<\/tool_use>/g
    content = content.replace(toolUseRegex, '')

    return content
  }, [block.content, formattedCitations, citationsData, model])

  // Create a minimal message object stub required by the Markdown component
  const minimalMessageStub: Partial<Message> = {
    id: block.messageId,
    role: 'assistant' // Assuming this block belongs to an assistant message
  }

  return (
    <>
      {/* Render mentions associated with the message */}
      {mentions && mentions.length > 0 && (
        <Flex gap="8px" wrap style={{ marginBottom: 10 }}>
          {mentions.map((m) => (
            <MentionTag key={getModelUniqId(m)}>{'@' + m.name}</MentionTag>
          ))}
        </Flex>
      )}
      {/* Render the main content */}
      <Markdown message={{ ...minimalMessageStub, content: processedContentForMarkdown } as Message} />
    </>
  )
}

const MentionTag = styled.span`
  color: var(--color-link);
`

export default React.memo(MainTextBlock)