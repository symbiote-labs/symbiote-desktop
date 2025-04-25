import 'katex/dist/katex.min.css'
import 'katex/dist/contrib/copy-tex'
import 'katex/dist/contrib/mhchem'
import '@renderer/styles/translation.css'
import '@renderer/styles/citation.css'

import MarkdownShadowDOMRenderer from '@renderer/components/MarkdownShadowDOMRenderer'
import { useSettings } from '@renderer/hooks/useSettings'
import type { Message } from '@renderer/types'
import { parseJSON } from '@renderer/utils'
import { escapeBrackets, removeSvgEmptyLines, withGeminiGrounding } from '@renderer/utils/formats'
import { findCitationInChildren, sanitizeSchema } from '@renderer/utils/markdown'
import { isEmpty } from 'lodash'
import React, { type FC, memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown, { type Components } from 'react-markdown' // Keep Components type here
import rehypeKatex from 'rehype-katex'
// @ts-ignore next-line
import rehypeMathjax from 'rehype-mathjax'
import rehypeRaw from 'rehype-raw'
// @ts-ignore next-line
import rehypeSanitize from 'rehype-sanitize'
import remarkCjkFriendly from 'remark-cjk-friendly'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import CitationTooltip from './CitationTooltip'
// Removed InlineToolBlock import
import EditableCodeBlock from './EditableCodeBlock'
import ImagePreview from './ImagePreview'
import Link from './Link'

interface Props {
  message: Message
}

const remarkPlugins = [remarkMath, remarkGfm, remarkCjkFriendly]

const Markdown: FC<Props> = ({ message }) => {
  const { t } = useTranslation()
  const { renderInputMessageAsMarkdown, mathEngine } = useSettings()

  const messageContent = useMemo(() => {
    // 检查消息内容是否为空或未定义
    if (message.content === undefined) {
      return ''
    }

    const empty = isEmpty(message.content)
    const paused = message.status === 'paused'
    const content = empty && paused ? t('message.chat.completion.paused') : withGeminiGrounding(message)
    return removeSvgEmptyLines(escapeBrackets(content))
  }, [message, t])

  const rehypePlugins = useMemo(() => {
    return [rehypeRaw, [rehypeSanitize, sanitizeSchema], mathEngine === 'KaTeX' ? rehypeKatex : rehypeMathjax]
  }, [mathEngine])

  // Remove processToolUse function as it's based on XML tags in content,
  // which won't exist with native function calling.
  // const processToolUse = (content: string) => { ... }

  // 处理后的消息内容
  // Use the original message content directly, without XML processing.
  const processedMessageContent = messageContent

  const components = useMemo(() => {
    const baseComponents = {
      a: (props: any) => {
        // 检查是否包含引用数据
        const citationData = parseJSON(findCitationInChildren(props.children))

        // 不再需要检查是否是引用链接，直接使用citationData
        // 移除未使用的变量和调试日志

        return <Link {...props} citationData={citationData} />
      },
      code: EditableCodeBlock,
      img: ImagePreview,
      pre: (props: any) => <pre style={{ overflow: 'visible' }} {...props} />,
      // 直接处理sup标签，确保引用可点击
      sup: (props: any) => {
        // 检查是否包含data-citation属性
        if (props['data-citation']) {
          const citationData = parseJSON(props['data-citation'])
          // console.log('Rendering citation sup with data:', citationData)

          // 移除data-citation属性，避免重复处理
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { 'data-citation': unused, ...restProps } = props

          return (
            <CitationTooltip citation={citationData}>
              <sup {...restProps} />
            </CitationTooltip>
          )
        }
        return <sup {...props} />
      },
      // 自定义处理think标签
      think: (props: any) => {
        // 将think标签内容渲染为带样式的span，避免在p标签内使用div导致的hydration错误
        return (
          <span
            className="thinking-content"
            style={{
              display: 'block',
              backgroundColor: 'rgba(0, 0, 0, 0.05)',
              padding: '10px 15px',
              borderRadius: '8px',
              marginBottom: '15px',
              borderLeft: '3px solid var(--color-primary)',
              fontStyle: 'italic',
              color: 'var(--color-text-2)'
            }}>
            <span style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>思考过程:</span>
            {props.children}
          </span>
        )
      },
      // 自定义处理translated标签
      translated: (props: any) => {
        // 将translated标签渲染为可点击的span
        return (
          <span
            className="translated-text"
            onClick={(e) => window.toggleTranslation(e as unknown as MouseEvent)}
            data-original={props.original}
            data-language={props.language}>
            {props.children}
          </span>
        )
      }
      // Removed custom div renderer for tool markers
    } as Partial<Components> // Keep Components type here
    return baseComponents
  }, []) // Removed message.metadata dependency as it's no longer used here

  // 使用useEffect在渲染后添加事件处理
  React.useEffect(() => {
    // 在组件挂载后，为所有引用标记添加点击事件
    const addCitationClickHandlers = () => {
      const citations = document.querySelectorAll('sup[data-citation]')
      // console.log('Found citation elements:', citations.length)

      citations.forEach((citation) => {
        // 确保元素有data-citation属性
        const citationData = citation.getAttribute('data-citation')
        if (!citationData) return

        try {
          const data = JSON.parse(citationData)
          // console.log('Citation data:', data)

          // 添加点击事件
          citation.addEventListener('click', (e) => {
            e.preventDefault()
            e.stopPropagation()
            // console.log('Citation clicked:', data)

            // 如果是锚点链接，滚动到页面对应位置
            if (data.url && data.url.startsWith('#')) {
              const element = document.querySelector(data.url)
              if (element) {
                element.scrollIntoView({ behavior: 'smooth' })
              }
            } else if (data.url) {
              // 否则打开外部链接
              window.open(data.url, '_blank')
            }
          })

          // 添加样式
          // 使用 HTMLElement 类型断言
          if (citation instanceof HTMLElement) {
            citation.style.cursor = 'pointer'
            citation.style.color = 'var(--color-link)'
          }
        } catch (error) {
          console.error('Error parsing citation data:', error)
        }
      })
    }

    // 延迟执行，确保DOM已经渲染完成
    setTimeout(addCitationClickHandlers, 100)

    // 组件卸载时清理
    return () => {
      // 清理工作（如果需要）
    }
  }, [processedMessageContent]) // 当消息内容变化时重新执行

  // 处理样式标签
  if (processedMessageContent.includes('<style>')) {
    components.style = MarkdownShadowDOMRenderer as any
  }

  // 用户消息且不需要渲染为Markdown
  if (message.role === 'user' && !renderInputMessageAsMarkdown) {
    return <p className="user-message-content">{messageContent}</p>
  }

  // 渲染Markdown内容
  return (
    <ReactMarkdown
      rehypePlugins={rehypePlugins}
      remarkPlugins={remarkPlugins}
      className="markdown"
      components={components}
      remarkRehypeOptions={{
        footnoteLabel: t('common.footnotes'),
        footnoteLabelTagName: 'h4',
        footnoteBackContent: ' '
      }}>
      {processedMessageContent}
    </ReactMarkdown>
  )
}

// 使用 memo 包装组件，避免不必要的重渲染
export default memo(Markdown)
