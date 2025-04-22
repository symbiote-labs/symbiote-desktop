import type { Citation } from '@renderer/pages/home/Messages/CitationsList'
import { getModelUniqId } from '@renderer/services/ModelService'
import type { RootState } from '@renderer/store'
import { selectFormattedCitationsByBlockId } from '@renderer/store/messageBlock'
import type { Model } from '@renderer/types'
import type { MainTextMessageBlock, Message } from '@renderer/types/newMessage'
import { Flex } from 'antd'
import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
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
  citationBlockId?: string
  model?: Model
  mentions?: Model[]
  role: Message['role']
}

const MainTextBlock: React.FC<Props> = ({ block, citationBlockId, role, mentions = [] }) => {
  // Use the passed citationBlockId directly in the selector
  const formattedCitations = useSelector((state: RootState) =>
    selectFormattedCitationsByBlockId(state, citationBlockId)
  )

  const processedContent = useMemo(() => {
    let content = block.content
    // Update condition to use citationBlockId
    if (!block.citationReferences?.length || !citationBlockId || formattedCitations.length === 0) {
      return content
    }

    // --- Optimization Start ---
    const citationMap = formattedCitations.reduce(
      (acc, citation) => {
        acc[citation.number] = citation
        return acc
      },
      {} as Record<number, Citation>
    )
    // --- Optimization End ---

    // Filter and sort positions only once
    const positions = block.citationReferences
      .filter((ref) => ref.citationBlockId === citationBlockId)
      .flatMap(({ positions }) => positions)
      .sort((a, b) => b.end - a.end)

    positions.forEach(({ end, citationId }) => {
      const citationNum = parseInt(citationId, 10)
      if (isNaN(citationNum)) return

      // --- Optimization Start ---
      // Use the map for O(1) lookup instead of find() O(n)
      const citationData = citationMap[citationNum]
      // --- Optimization End ---

      if (!citationData) return

      const supData = {
        id: citationNum,
        url: citationData.url,
        title: citationData.title || citationData.hostname || '',
        content: citationData.content?.substring(0, 200)
      }
      const citationJson = encodeHTML(JSON.stringify(supData))
      content =
        content.slice(0, end) + `[<sup data-citation='${citationJson}'>${citationNum}</sup>]` + content.slice(end)
    })

    return content
  }, [block.content, block.citationReferences, citationBlockId, formattedCitations])

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
