import { getModelUniqId } from '@renderer/services/ModelService'
import type { Model } from '@renderer/types'
import type { CitationMessageBlock, MainTextMessageBlock, Message } from '@renderer/types/newMessage'
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
  citationsBlock?: CitationMessageBlock
  model?: Model
  mentions?: Model[]
  role: Message['role']
}

const MainTextBlock: React.FC<Props> = ({ block, citationsBlock, role, mentions = [] }) => {
  // 处理引用数据
  const processedContent = useMemo(() => {
    let content = block.content
    if (!block.citationReferences?.length) {
      return content
    }

    // 收集所有需要插入的位置
    const positions = block.citationReferences
      .flatMap(({ citationBlockId, positions }) => {
        if (citationBlockId !== citationsBlock?.id) return []
        return positions.map((pos) => ({
          ...pos,
          citationBlockId
        }))
      })
      .sort((a, b) => b.end - a.end)

    // 从后往前插入引用标记，避免位置偏移
    positions.forEach(({ end, citationId, citationBlockId }) => {
      if (!citationsBlock) return

      // 获取引用数据
      const citationData = {
        id: citationId,
        url: citationsBlock.source?.results?.find((r) => r.id === citationId)?.url || '',
        title: citationsBlock.source?.results?.find((r) => r.id === citationId)?.title || '',
        content: citationsBlock.source?.results?.find((r) => r.id === citationId)?.content || ''
      }
      const citationJson = encodeHTML(JSON.stringify(citationData))
      content =
        content.slice(0, end) + `[<sup data-citation='${citationJson}'>${citationId}</sup>]` + content.slice(end)
    })

    return content
  }, [block.content, block.citationReferences, citationsBlock])

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
      <Markdown block={{ ...block, content: processedContent }} role={role} />
    </>
  )
}

const MentionTag = styled.span`
  color: var(--color-link);
`

export default React.memo(MainTextBlock)
