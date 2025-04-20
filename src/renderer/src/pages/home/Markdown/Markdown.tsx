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
import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
// @ts-ignore next-line
import rehypeMathjax from 'rehype-mathjax'
import rehypeRaw from 'rehype-raw'
// @ts-ignore next-line
import rehypeSanitize from 'rehype-sanitize'
import remarkCjkFriendly from 'remark-cjk-friendly'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import InlineToolBlock from '../Messages/InlineToolBlock'
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

  // 处理工具调用 - 采用通用方法
  const processToolUse = (content: string) => {
    // 使用正则表达式匹配所有工具调用标签
    const toolUseRegex = /<tool_use>([\s\S]*?)<\/tool_use>|<tool_use>([\s\S]*?)(?:<\/tool|$)/g

    // 工具结果正则表达式
    const toolResultRegex =
      /<tool_use_result>[\s\S]*?<n>([\s\S]*?)<\/n>[\s\S]*?<r>([\s\S]*?)<\/r>[\s\S]*?<\/tool_use_result>/g

    // 替换所有工具调用标签为自定义标记
    let processedContent = content.replace(toolUseRegex, (_, content1, content2) => {
      // 工具调用内容可能在content1或content2中
      const toolContent = content1 || content2 || ''

      // 尝试提取工具ID和参数
      const lines = toolContent.trim().split('\n')

      // 如果至少有两行，则第一行可能是工具ID
      if (lines.length >= 2) {
        const toolId = lines[0].trim()
        // 将剩余行作为参数
        const argsText = lines.slice(1).join('\n').trim()

        // 尝试解析参数为JSON
        try {
          // 尝试处理常见的JSON格式问题
          let fixedArgsText = argsText

          // 如果是非标准JSON格式，尝试修复
          if (fixedArgsText.startsWith('[') || fixedArgsText.startsWith('{')) {
            // 将单引号替换为双引号
            fixedArgsText = fixedArgsText.replace(/(['"])([^'"]*)\1/g, '"$2"')
            // 将单引号键值对替换为双引号键值对
            fixedArgsText = fixedArgsText.replace(/([\w]+):/g, '"$1":')
          }

          // 尝试解析JSON
          let parsedArgs
          try {
            parsedArgs = JSON.parse(fixedArgsText)
          } catch (e) {
            // 如果解析失败，尝试添加缺失的右大括号
            if (fixedArgsText.includes('{') && !fixedArgsText.endsWith('}')) {
              fixedArgsText = fixedArgsText + '}'
              try {
                parsedArgs = JSON.parse(fixedArgsText)
              } catch (e2) {
                // 如果仍然失败，使用原始文本
                parsedArgs = argsText
              }
            } else {
              parsedArgs = argsText
            }
          }

          // 返回工具调用标记
          return `<div class="tool-use-marker" data-tool-name="${toolId}" data-tool-args='${typeof parsedArgs === 'object' ? JSON.stringify(parsedArgs) : parsedArgs}'></div>`
        } catch (e) {
          // 如果解析失败，使用原始文本
          console.error('Failed to parse tool args:', e)
          return `<div class="tool-use-marker" data-tool-name="${toolId}" data-tool-args='${argsText}'></div>`
        }
      } else {
        // 如果只有一行，则将整个内容作为工具调用
        return `<div class="tool-use-marker" data-tool-name="unknown" data-tool-args='${toolContent}'></div>`
      }
    })

    // 替换工具结果标签为自定义标记
    processedContent = processedContent.replace(toolResultRegex, (_, toolName, result) => {
      return `<div class="tool-result-marker" data-tool-name="${toolName.trim()}" data-result='${result.trim()}'></div>`
    })

    return processedContent
  }

  // 处理后的消息内容
  const processedMessageContent = useMemo(() => {
    return processToolUse(messageContent)
  }, [messageContent])

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
      },
      // 处理工具调用标记
      div: (props: any) => {
        if (props.className === 'tool-use-marker') {
          const toolName = props['data-tool-name']
          let toolArgs
          try {
            toolArgs = JSON.parse(props['data-tool-args'])
          } catch (e) {
            toolArgs = props['data-tool-args']
          }

          // 如果消息中包含工具调用结果，则显示实际结果
          const mcpTools = message?.metadata?.mcpTools || []

          // 调试信息
          console.log('Tool name:', toolName)
          console.log('Message metadata:', message?.metadata)
          console.log('MCP Tools:', mcpTools)

          // 尝试多种方式匹配工具
          let toolResponse = mcpTools.find((tool) => tool.id === toolName)

          // 如果没有找到，尝试使用工具名称匹配
          if (!toolResponse && mcpTools.length > 0) {
            toolResponse = mcpTools[mcpTools.length - 1] // 使用最后一个工具调用
          }

          // 创建默认响应
          const defaultResponse = {
            isError: false,
            content: [
              {
                type: 'text',
                text: '工具调用已完成'
              }
            ]
          }

          if (toolResponse) {
            console.log('Found tool response:', toolResponse)
            return (
              <InlineToolBlock
                toolName={toolName}
                toolArgs={toolArgs}
                status="done"
                response={toolResponse.response || defaultResponse}
              />
            )
          } else {
            // 如果没有找到工具调用结果，则显示完成状态和默认响应
            return (
              <InlineToolBlock
                toolName={toolName}
                toolArgs={toolArgs}
                status="done"
                response={{ isError: false, content: [{ type: 'text' as const, text: '工具调用已完成' }] }}
              />
            )
          }
        } else if (props.className === 'tool-result-marker') {
          const toolName = props['data-tool-name']
          const result = props['data-result']
          return (
            <InlineToolBlock
              toolName={toolName}
              toolArgs={null}
              status="done"
              response={{
                isError: false,
                content: [
                  {
                    type: 'text',
                    text: result
                  }
                ]
              }}
            />
          )
        }
        return <div {...props} />
      }
    } as Partial<Components>
    return baseComponents
  }, [message?.metadata])

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
