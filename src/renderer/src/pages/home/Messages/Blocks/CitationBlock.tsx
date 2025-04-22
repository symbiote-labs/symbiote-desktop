import { GroundingMetadata } from '@google/genai'
import type { RootState } from '@renderer/store'
import { selectFormattedCitationsByBlockId } from '@renderer/store/messageBlock'
import { WebSearchSource } from '@renderer/types'
import type { CitationMessageBlock } from '@renderer/types/newMessage'
import React, { useMemo } from 'react'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import CitationsList from '../CitationsList'

function CitationBlock({ block }: { block: CitationMessageBlock }) {
  const formattedCitations = useSelector((state: RootState) => selectFormattedCitationsByBlockId(state, block.id))
  const hasCitations = useMemo(() => {
    const hasGeminiBlock = block.response?.source === WebSearchSource.GEMINI
    return (
      (formattedCitations && formattedCitations.length > 0) ||
      hasGeminiBlock ||
      (block.knowledge && block.knowledge.length > 0)
    )
  }, [formattedCitations, block.response, block.knowledge])

  if (!hasCitations) {
    return null
  }

  const isGemini = block.response?.source === WebSearchSource.GEMINI

  return (
    <>
      {isGemini && block.status === 'success' && (
        <>
          <CitationsList citations={formattedCitations} />
          <SearchEntryPoint
            dangerouslySetInnerHTML={{
              __html:
                (block.response?.results as GroundingMetadata)?.searchEntryPoint?.renderedContent
                  ?.replace(/@media \(prefers-color-scheme: light\)/g, 'body[theme-mode="light"]')
                  .replace(/@media \(prefers-color-scheme: dark\)/g, 'body[theme-mode="dark"]') || ''
            }}
          />
        </>
      )}
      {formattedCitations.length > 0 && block.status === 'success' && <CitationsList citations={formattedCitations} />}
    </>
  )
}

const SearchEntryPoint = styled.div`
  margin: 10px 2px;
`

export default React.memo(CitationBlock)
