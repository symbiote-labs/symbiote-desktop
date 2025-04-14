import { SyncOutlined, TranslationOutlined } from '@ant-design/icons'
import TTSHighlightedText from '@renderer/components/TTSHighlightedText'
import { isOpenAIWebSearch } from '@renderer/config/models'
import { getModelUniqId } from '@renderer/services/ModelService'
import { Message, Model } from '@renderer/types'
import { getBriefInfo } from '@renderer/utils'
import { withMessageThought } from '@renderer/utils/formats'
import { Collapse, Divider, Flex } from 'antd'
import { clone } from 'lodash'
import { Search } from 'lucide-react'
import React, { Fragment, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import BarLoader from 'react-spinners/BarLoader'
import BeatLoader from 'react-spinners/BeatLoader'
import styled from 'styled-components'

import Markdown from '../Markdown/Markdown'
import CitationsList from './CitationsList'
import MessageAttachments from './MessageAttachments'
import MessageError from './MessageError'
import MessageImage from './MessageImage'
import MessageThought from './MessageThought'
import MessageTools from './MessageTools'

interface Props {
  message: Message
  model?: Model
}

const MessageContent: React.FC<Props> = ({ message: _message, model }) => {
  const { t } = useTranslation()
  const message = withMessageThought(clone(_message))
  const isWebCitation = model && (isOpenAIWebSearch(model) || model.provider === 'openrouter')
  const [isSegmentedPlayback, setIsSegmentedPlayback] = useState(false)

  // 监听分段播放状态变化
  useEffect(() => {
    const handleSegmentedPlaybackUpdate = (event: CustomEvent) => {
      const { isSegmentedPlayback } = event.detail
      setIsSegmentedPlayback(isSegmentedPlayback)
    }

    // 添加事件监听器
    window.addEventListener('tts-segmented-playback-update', handleSegmentedPlaybackUpdate as EventListener)

    // 组件卸载时移除事件监听器
    return () => {
      window.removeEventListener('tts-segmented-playback-update', handleSegmentedPlaybackUpdate as EventListener)
    }
  }, [])

  // HTML实体编码辅助函数
  const encodeHTML = (str: string) => {
    return str.replace(/[&<>"']/g, (match) => {
      const entities: { [key: string]: string } = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;'
      }
      return entities[match]
    })
  }

  // Format citations for display
  const formattedCitations = useMemo(() => {
    if (!message.metadata?.citations?.length && !message.metadata?.annotations?.length) return null

    let citations: any[] = []

    if (model && isOpenAIWebSearch(model)) {
      citations =
        message.metadata.annotations?.map((url, index) => {
          return { number: index + 1, url: url.url_citation?.url, hostname: url.url_citation.title }
        }) || []
    } else {
      citations =
        message.metadata?.citations?.map((url, index) => {
          try {
            const hostname = new URL(url).hostname
            return { number: index + 1, url, hostname }
          } catch {
            return { number: index + 1, url, hostname: url }
          }
        }) || []
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
  }, [message.metadata?.citations, message.metadata?.annotations, model])

  // 获取引用数据
  const citationsData = useMemo(() => {
    const searchResults =
      message?.metadata?.webSearch?.results ||
      message?.metadata?.webSearchInfo ||
      message?.metadata?.groundingMetadata?.groundingChunks?.map((chunk) => chunk?.web) ||
      message?.metadata?.annotations?.map((annotation) => annotation.url_citation) ||
      []
    const citationsUrls = formattedCitations || []

    // 合并引用数据
    const data = new Map()

    // 添加webSearch结果
    searchResults.forEach((result) => {
      data.set(result.url || result.uri || result.link, {
        url: result.url || result.uri || result.link,
        title: result.title || result.hostname,
        content: result.content
      })
    })

    // 添加citations
    citationsUrls.forEach((result) => {
      if (!data.has(result.url)) {
        data.set(result.url, {
          url: result.url,
          title: result.title || result.hostname || undefined,
          content: result.content || undefined
        })
      }
    })

    return data
  }, [
    formattedCitations,
    message?.metadata?.annotations,
    message?.metadata?.groundingMetadata?.groundingChunks,
    message?.metadata?.webSearch?.results,
    message?.metadata?.webSearchInfo
  ])

  // Process content to make citation numbers clickable
  const processedContent = useMemo(() => {
    if (
      !(
        message.metadata?.citations ||
        message.metadata?.webSearch ||
        message.metadata?.webSearchInfo ||
        message.metadata?.annotations
      )
    ) {
      return message.content
    }

    let content = message.content

    const searchResultsCitations = message?.metadata?.webSearch?.results?.map((result) => result.url) || []

    const citations = message?.metadata?.citations || searchResultsCitations

    // Convert [n] format to superscript numbers and make them clickable
    // Use <sup> tag for superscript and make it a link with citation data
    if (message.metadata?.webSearch) {
      content = content.replace(/\[\[(\d+)\]\]|\[(\d+)\]/g, (match, num1, num2) => {
        const num = num1 || num2
        const index = parseInt(num) - 1
        if (index >= 0 && index < citations.length) {
          const link = citations[index]
          const citationData = link ? encodeHTML(JSON.stringify(citationsData.get(link) || { url: link })) : null
          return link ? `[<sup data-citation='${citationData}'>${num}</sup>](${link})` : `<sup>${num}</sup>`
        }
        return match
      })
    } else {
      content = content.replace(/\[<sup>(\d+)<\/sup>\]\(([^)]+)\)/g, (_, num, url) => {
        const citationData = url ? encodeHTML(JSON.stringify(citationsData.get(url) || { url })) : null
        return `[<sup data-citation='${citationData}'>${num}</sup>](${url})`
      })
    }
    return content
  }, [
    message.metadata?.citations,
    message.metadata?.webSearch,
    message.metadata?.webSearchInfo,
    message.metadata?.annotations,
    message.content,
    citationsData
  ])

  if (message.status === 'sending') {
    return (
      <MessageContentLoading>
        <SyncOutlined spin size={24} />
      </MessageContentLoading>
    )
  }

  if (message.status === 'searching') {
    return (
      <SearchingContainer>
        <Search size={24} />
        <SearchingText>{t('message.searching')}</SearchingText>
        <BarLoader color="#1677ff" />
      </SearchingContainer>
    )
  }

  if (message.status === 'error') {
    return <MessageError message={message} />
  }

  if (message.type === '@' && model) {
    const content = `[@${model.name}](#)  ${getBriefInfo(message.content)}`
    return <Markdown message={{ ...message, content }} />
  }
  const toolUseRegex = /<tool_use>([\s\S]*?)<\/tool_use>/g
  return (
    <Fragment>
      <Flex gap="8px" wrap style={{ marginBottom: 10 }}>
        {message.mentions?.map((model) => <MentionTag key={getModelUniqId(model)}>{'@' + model.name}</MentionTag>)}
      </Flex>
<<<<<<< HEAD
      {message.referencedMessages && message.referencedMessages.length > 0 && (
        <div>
          {message.referencedMessages.map((refMsg, index) => (
            <Collapse
              key={refMsg.id}
              className="reference-collapse"
              defaultActiveKey={['1']}
              size="small"
              items={[
                {
                  key: '1',
                  label: (
                    <div className="reference-header-label">
                      <span className="reference-title">
                        {t('message.referenced_message')}{' '}
                        {message.referencedMessages && message.referencedMessages.length > 1
                          ? `(${index + 1}/${message.referencedMessages.length})`
                          : ''}
                      </span>
                      <span className="reference-role">{refMsg.role === 'user' ? t('common.you') : 'AI'}</span>
                    </div>
                  ),
                  extra: (
                    <span
                      className="reference-id"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigator.clipboard.writeText(refMsg.id)
                        window.message.success({
                          content: t('message.id_copied') || '消息ID已复制',
                          key: 'copy-reference-id'
                        })
                      }}>
                      ID: {refMsg.id}
                    </span>
                  ),
                  children: (
                    <div className="reference-content">
                      <div className="reference-text">{refMsg.content}</div>
                      <div className="reference-bottom-spacing"></div>
                    </div>
                  )
                }
              ]}
            />
          ))}
        </div>
      )}

      {/* 兼容旧版本的referencedMessage */}
      {!message.referencedMessages && (message as any).referencedMessage && (
        <Collapse
          className="reference-collapse"
          defaultActiveKey={['1']}
          size="small"
          items={[
            {
              key: '1',
              label: (
                <div className="reference-header-label">
                  <span className="reference-title">{t('message.referenced_message')}</span>
                  <span className="reference-role">
                    {(message as any).referencedMessage.role === 'user' ? t('common.you') : 'AI'}
                  </span>
                </div>
              ),
              extra: (
                <span
                  className="reference-id"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigator.clipboard.writeText((message as any).referencedMessage.id)
                    window.message.success({
                      content: t('message.id_copied') || '消息ID已复制',
                      key: 'copy-reference-id'
                    })
                  }}>
                  ID: {(message as any).referencedMessage.id}
                </span>
              ),
              children: (
                <div className="reference-content">
                  <div className="reference-text">{(message as any).referencedMessage.content}</div>
                  <div className="reference-bottom-spacing"></div>
                </div>
              )
            }
          ]}
        />
      )}
      <div className="message-content-tools">
        <MessageThought message={message} />
        <MessageTools message={message} />
      </div>
      <Markdown message={{ ...message, content: processedContent.replace(toolUseRegex, '') }} />
=======
      <MessageThought message={message} />
      <MessageTools message={message} />
      {isSegmentedPlayback ? (
        <TTSHighlightedText text={processedContent.replace(toolUseRegex, '')} />
      ) : (
        <Markdown message={{ ...message, content: processedContent.replace(toolUseRegex, '') }} />
      )}
>>>>>>> origin/1600822305-patch-2
      {message.metadata?.generateImage && <MessageImage message={message} />}
      {message.translatedContent && (
        <Fragment>
          <Divider style={{ margin: 0, marginBottom: 10 }}>
            <TranslationOutlined />
          </Divider>
          {message.translatedContent === t('translate.processing') ? (
            <BeatLoader color="var(--color-text-2)" size="10" style={{ marginBottom: 15 }} />
          ) : (
            <Markdown message={{ ...message, content: message.translatedContent }} />
          )}
        </Fragment>
      )}
      {message?.metadata?.groundingMetadata && message.status == 'success' && (
        <>
          <CitationsList
            citations={
              message.metadata.groundingMetadata?.groundingChunks?.map((chunk, index) => ({
                number: index + 1,
                url: chunk?.web?.uri || '',
                title: chunk?.web?.title,
                showFavicon: false
              })) || []
            }
          />
          <SearchEntryPoint
            dangerouslySetInnerHTML={{
              __html: message.metadata.groundingMetadata?.searchEntryPoint?.renderedContent
                ? message.metadata.groundingMetadata.searchEntryPoint.renderedContent
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
      {message?.metadata?.webSearch && message.status === 'success' && (
        <CitationsList
          citations={message.metadata.webSearch.results.map((result, index) => ({
            number: index + 1,
            url: result.url,
            title: result.title,
            showFavicon: true
          }))}
        />
      )}
      {message?.metadata?.webSearchInfo && message.status === 'success' && (
        <CitationsList
          citations={message.metadata.webSearchInfo.map((result, index) => ({
            number: index + 1,
            url: result.link || result.url,
            title: result.title,
            showFavicon: true
          }))}
        />
      )}
      <MessageAttachments message={message} />
    </Fragment>
  )
}

const MessageContentLoading = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 32px;
  margin-top: -5px;
  margin-bottom: 5px;
`

const SearchingContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  background-color: var(--color-background-mute);
  padding: 10px;
  border-radius: 10px;
  margin-bottom: 10px;
  gap: 10px;
`

const MentionTag = styled.span`
  color: var(--color-link);
`

const SearchingText = styled.div`
  font-size: 14px;
  line-height: 1.6;
  text-decoration: none;
  color: var(--color-text-1);
`

const SearchEntryPoint = styled.div`
  margin: 10px 2px;
`

// 引用消息样式 - 使用全局样式
const referenceStyles = `
  .reference-collapse {
    margin-bottom: 8px;
    border: 1px solid var(--color-border) !important;
    border-radius: 8px !important;
    overflow: hidden;
    background-color: var(--color-bg-1) !important;

    .ant-collapse-header {
      padding: 2px 8px !important;
      background-color: var(--color-bg-2);
      border-bottom: 1px solid var(--color-border);
      font-size: 10px;
      display: flex;
      justify-content: space-between;
      height: 18px;
      min-height: 18px;
      line-height: 14px;
    }

    .ant-collapse-expand-icon {
      height: 18px;
      line-height: 14px;
      padding-top: 0 !important;
      margin-top: -2px;
      margin-right: 2px;
    }

    .ant-collapse-header-text {
      flex: 0 1 auto;
      max-width: 70%;
    }

    .ant-collapse-extra {
      flex: 0 0 auto;
      margin-left: 10px;
      padding-right: 0;
      position: relative;
      right: 20px;
    }

    .reference-header-label {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 14px;
      line-height: 14px;
    }

    .reference-title {
      font-weight: 500;
      color: var(--color-text-1);
      font-size: 10px;
    }

    .reference-role {
      color: var(--color-text-2);
      font-size: 9px;
    }

    .reference-id {
      color: var(--color-text-3);
      font-size: 9px;
      cursor: pointer;
      padding: 1px 4px;
      border-radius: 3px;
      transition: background-color 0.2s ease;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
      display: inline-block;

      &:hover {
        background-color: var(--color-bg-3);
        color: var(--color-text-2);
      }
    }

    .ant-collapse-extra {
      margin-left: auto;
      display: flex;
      align-items: center;
    }

    .ant-collapse-content-box {
      padding: 12px !important;
      padding-top: 8px !important;
      padding-bottom: 2px !important;
    }

    .reference-content {
      max-height: 200px;
      overflow-y: auto;
      padding-bottom: 10px;

      .reference-text {
        color: var(--color-text-1);
        font-size: 14px;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .reference-bottom-spacing {
        height: 10px;
      }
    }
  }
`

// 将样式添加到文档中
try {
  if (typeof document !== 'undefined') {
    const styleElement = document.createElement('style')
    styleElement.textContent =
      referenceStyles +
      `
      .message-content-tools {
        margin-top: 20px;
      }
    `
    document.head.appendChild(styleElement)
  }
} catch (error) {
  console.error('Failed to add reference styles:', error)
}

export default React.memo(MessageContent)
