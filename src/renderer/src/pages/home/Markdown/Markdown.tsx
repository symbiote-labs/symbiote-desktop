import 'katex/dist/katex.min.css'
import 'katex/dist/contrib/copy-tex'
import 'katex/dist/contrib/mhchem'

import MarkdownShadowDOMRenderer from '@renderer/components/MarkdownShadowDOMRenderer'
import { useSettings } from '@renderer/hooks/useSettings'
import type { Message } from '@renderer/types'
import { parseJSON } from '@renderer/utils'
import { escapeBrackets, removeSvgEmptyLines, withGeminiGrounding } from '@renderer/utils/formats'
import { findCitationInChildren, sanitizeSchema } from '@renderer/utils/markdown'
import { isEmpty } from 'lodash'
import { type FC, memo, useMemo } from 'react'
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
      a: (props: any) => <Link {...props} citationData={parseJSON(findCitationInChildren(props.children))} />,
      code: EditableCodeBlock,
      img: ImagePreview,
      pre: (props: any) => <pre style={{ overflow: 'visible' }} {...props} />,
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
      }
      // Removed custom div renderer for tool markers
    } as Partial<Components> // Keep Components type here
    return baseComponents
  }, []) // Removed message.metadata dependency as it's no longer used here

  if (message.role === 'user' && !renderInputMessageAsMarkdown) {
    return <p style={{ marginBottom: 5, whiteSpace: 'pre-wrap' }}>{messageContent}</p>
  }

  if (processedMessageContent.includes('<style>')) {
    components.style = MarkdownShadowDOMRenderer as any
  }

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
