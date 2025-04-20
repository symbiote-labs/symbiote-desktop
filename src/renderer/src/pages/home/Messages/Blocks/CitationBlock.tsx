import { DownOutlined, InfoCircleOutlined, UpOutlined } from '@ant-design/icons'
import { GroundingMetadata } from '@google/genai'
import type { Model } from '@renderer/types'
import { WebSearchSource } from '@renderer/types'
import type { CitationMessageBlock } from '@renderer/types/newMessage'
import OpenAI from 'openai'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import CitationsList from '../CitationsList'

export default function CitationBlock({ model, block }: { model: Model; block: CitationMessageBlock }) {
  const { t } = useTranslation()
  const isWebCitation = !!block.response
  const [citationsCollapsed, setCitationsCollapsed] = useState(true)

  const formattedCitations = useMemo(() => {
    if (block?.knowledge?.length || block?.response?.results) return null

    let citations: any[] = []

    switch (block.response?.source) {
      case WebSearchSource.OPENAI:
        citations =
          (block.response?.results as OpenAI.Chat.Completions.ChatCompletionMessage.Annotation.URLCitation[])?.map(
            (url, index) => {
              return { number: index + 1, url: url.url, hostname: url.title }
            }
          ) || []
        break
      case WebSearchSource.OPENROUTER:
      case WebSearchSource.PERPLEXITY:
        citations =
          (block.response?.results as any[])?.map((url, index) => {
            try {
              const hostname = new URL(url).hostname
              return { number: index + 1, url, hostname }
            } catch {
              return { number: index + 1, url, hostname: url }
            }
          }) || []
        break
      case WebSearchSource.ZHIPU:
      case WebSearchSource.HUNYUAN:
        citations =
          (block.response?.results as any[])?.map((result, index) => {
            return { number: index + 1, url: result.link || result.url, title: result.title }
          }) || []
        break
    }

    // Deduplicate by URL
    const urlSet = new Set()
    return citations
      .filter((citation) => {
        if (!citation.url || urlSet.has(citation.url)) return false
        urlSet.add(citation.url)
        return true
      })
      .map((citation, index) => ({
        ...citation,
        number: index + 1 // Renumber citations sequentially after deduplication
      }))
  }, [block?.knowledge?.length, block.response?.results, model])

  const hasCitations = useMemo(() => {
    return !!((formattedCitations && formattedCitations.length > 0) || block?.response?.results)
  }, [formattedCitations, block])

  if (!hasCitations) {
    return null
  }

  return (
    <>
      {hasCitations && (
        <CitationsContainer>
          <CitationsHeader onClick={() => setCitationsCollapsed(!citationsCollapsed)}>
            <div>
              {t('block.citations')}
              <InfoCircleOutlined style={{ fontSize: '14px', marginLeft: '4px', opacity: 0.6 }} />
            </div>
            {citationsCollapsed ? <DownOutlined /> : <UpOutlined />}
          </CitationsHeader>

          {!citationsCollapsed && (
            <CitationsContent>
              {(block?.response?.results as GroundingMetadata) && block.status === 'success' && (
                <>
                  <CitationsList
                    citations={
                      (block?.response?.results as GroundingMetadata)?.groundingChunks?.map((chunk, index) => ({
                        number: index + 1,
                        url: chunk?.web?.uri || '',
                        title: chunk?.web?.title,
                        showFavicon: false
                      })) || []
                    }
                  />
                  <SearchEntryPoint
                    dangerouslySetInnerHTML={{
                      __html: (block?.response?.results as GroundingMetadata)?.searchEntryPoint?.renderedContent
                        ? (block?.response?.results as GroundingMetadata)?.searchEntryPoint?.renderedContent ||
                          ''
                            .replace(/@media \(prefers-color-scheme: light\)/g, 'body[theme-mode="light"]')
                            .replace(/@media \(prefers-color-scheme: dark\)/g, 'body[theme-mode="dark"]')
                        : ''
                    }}
                  />
                </>
              )}
              {formattedCitations && (
                <CitationsList
                  citations={formattedCitations.map((citation) => ({
                    number: citation.number,
                    url: citation.url,
                    hostname: citation.hostname,
                    showFavicon: isWebCitation
                  }))}
                />
              )}
              {(block?.response?.results as any[])?.length > 0 && block.status === 'success' && (
                <CitationsList
                  citations={[
                    ...((block?.response?.results as any[]).map((result, index) => ({
                      number: index + 1,
                      url: result.url || result.link,
                      title: result.title,
                      showFavicon: true
                    })) || []),
                    ...(block.knowledge?.map((result, index) => ({
                      number: ((block?.response?.results as any[]).length || 0) + index + 1,
                      url: result.sourceUrl,
                      title: result.sourceUrl,
                      showFavicon: true,
                      type: 'knowledge'
                    })) || [])
                  ]}
                />
              )}
            </CitationsContent>
          )}
        </CitationsContainer>
      )}
    </>
  )
}

const SearchEntryPoint = styled.div`
  margin: 10px 2px;
`
