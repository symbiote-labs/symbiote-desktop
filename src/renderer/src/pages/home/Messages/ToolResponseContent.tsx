import { Button, Input } from 'antd' // Import Button and Input
import { FC, memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs' // Choose a style
import styled, { createGlobalStyle } from 'styled-components'

// 辅助函数：尝试从MCP工具响应中提取参数
function extractParamsFromMCPResponse(response: any): Record<string, any> | null {
  if (!response) return null

  // 直接检查是否有_originalArgs字段
  if (response._originalArgs && Object.keys(response._originalArgs).length > 0) {
    return response._originalArgs
  }

  // 检查是否为get_current_time工具（特殊处理）
  if (response.toolName === 'get_current_time') {
    return {
      format: 'full',
      timezone: response.timezone || 'Asia/Shanghai'
    }
  }

  // 尝试从content中解析
  if (Array.isArray(response.content) && response.content.length > 0 && response.content[0].type === 'text') {
    try {
      const contentText = response.content[0].text
      const parsedContent = JSON.parse(contentText)

      // 针对get_current_time工具的特殊处理
      if (parsedContent && parsedContent.format) {
        return {
          format: parsedContent.format,
          timezone: parsedContent.timezone
        }
      }

      // 检查是否有params字段
      if (parsedContent && parsedContent.params) {
        return parsedContent.params
      }
    } catch (e) {
      console.log('[ToolResponseContent] Failed to parse content as JSON:', e)
    }
  }

  // 检查主响应对象中是否有params字段
  if (response.params) {
    return response.params
  }

  // 最后检查是否有arguments字段（某些MCP工具可能使用这个字段）
  if (response.arguments) {
    return response.arguments
  }

  return null
}

// 添加全局样式，在合适位置换行
const GlobalStyle = createGlobalStyle`
  /* 代码块容器样式 */
  .tool-response-syntax-highlighter {
    width: 100% !important;
    max-width: 100% !important;
  }

  /* 代码块内容样式 */
  .tool-response-syntax-highlighter pre,
  .tool-response-syntax-highlighter div[class*="language-"] {
    white-space: pre-wrap !important; /* 允许在空白处换行 */
    word-break: normal !important; /* 使用normal而不是break-all，避免过度换行 */
    overflow-wrap: anywhere !important; /* 在必要时才换行 */
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  /* 代码和span元素样式 */
  .tool-response-syntax-highlighter code,
  .tool-response-syntax-highlighter code span {
    white-space: inherit !important; /* 继承父元素的white-space */
    word-break: inherit !important; /* 继承父元素的word-break */
    overflow-wrap: inherit !important; /* 继承父元素的overflow-wrap */
  }

  /* 只对超长字符串应用break-all */
  .tool-response-syntax-highlighter .token.string {
    word-break: break-word !important; /* 使用break-word而不是break-all */
    overflow-wrap: break-word !important;
  }

  /* 确保JSON结构保持完整 */
  .tool-response-syntax-highlighter .token.punctuation,
  .tool-response-syntax-highlighter .token.operator {
    white-space: pre !important; /* 保持标点符号不换行 */
  }
  
  /* 确保使用 div 作为 PreTag 的代码高亮器看起来像代码块 */
  .tool-response-syntax-highlighter > div[class*="language-"] {
    font-family: monospace;
    background-color: var(--color-bg-2) !important;
    padding: 8px !important;
    border-radius: 4px !important;
    overflow: auto !important;
    white-space: pre-wrap !important;
  }
`

// --- Styled Components Definitions ---

// Add FlexContainer style and modify Section style
const FlexContainer = styled.div`
  display: flex;
  flex-direction: row; // 保持左右布局
  gap: 16px;
  align-items: stretch; /* Ensure items stretch to fill height */

  @media (max-width: 768px) {
    flex-direction: column; // 在小屏幕上改为纵向布局
  }
`

// Add Divider style
const Divider = styled.div`
  width: 1px;
  background-color: var(--color-border); /* Use border color for divider */
  align-self: stretch; /* Make divider stretch full height */
`

const Section = styled.div<{ flexBasis?: string }>`
  flex: 1; /* Allow sections to grow/shrink */
  flex-basis: ${(props) => props.flexBasis || 'auto'}; /* Set flex-basis if provided */
  min-width: 0; /* Prevent overflow issues with flex items */
  max-width: ${(props) => props.flexBasis || 'auto'}; /* 限制最大宽度，防止内容溢出 */
  border: 1px solid var(--color-border); /* 减小边框粗细 */
  border-radius: 6px; /* 增加圆角 */
  padding: 12px; /* 增加内边距 */
  background-color: var(--color-bg-2); /* 添加轻微的背景色区分 */
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); /* 添加轻微阴影 */
  transition: all 0.2s ease; /* 添加过渡效果 */
  overflow: hidden; /* 确保内容不会溢出 */

  /* 确保Section内的内容适当换行 */
  * {
    max-width: 100%;
    overflow-wrap: normal;
    word-wrap: normal;
  }

  &:hover {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15); /* 悬停时增强阴影 */
  }
`

const SectionLabel = styled.div`
  font-weight: 600;
  color: var(--color-primary); /* 使用主题色 */
  margin-bottom: 8px;
  font-size: 13px; /* 增大标签字体 */
  display: flex;
  align-items: center;

  &::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 14px;
    background-color: var(--color-primary);
    margin-right: 6px;
    border-radius: 2px;
  }
`

const ToolResponseContainer = styled.div`
  background: var(--color-bg-1);
  border-radius: 8px; /* 增加圆角 */
  padding: 16px; /* 增加内边距 */
  border-top: none;
  position: relative;
  will-change: transform; /* 优化渲染性能 */
  transform: translateZ(0); /* 启用硬件加速 */
  backface-visibility: hidden; /* 使用 GPU 加速 */
  -webkit-backface-visibility: hidden;
  perspective: 1000;
  -webkit-perspective: 1000;
  contain: content; /* 限制重绘范围 */
  background-color: var(--color-bg-1); /* 确保背景色 */
  max-width: 100%; /* 确保不超出父容器 */
`

// Removed CodeBlock styled component as we will use SyntaxHighlighter

const LoadingPlaceholder = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80px;
  color: var(--color-text-2);
  font-size: 14px;
  transform: translateZ(0); /* 启用硬件加速 */
  backface-visibility: hidden; /* 使用 GPU 加速 */
  -webkit-backface-visibility: hidden;
  background-color: var(--color-bg-2);
  border-radius: 6px;
  border: 1px dashed var(--color-border);
  animation: pulse 1.5s infinite ease-in-out;

  @keyframes pulse {
    0% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.6;
    }
  }
`

// --- Component Definition ---

// Update props interface to accept editing props
interface ToolResponseContentProps {
  params: any
  response: any
  fontFamily: string
  fontSize: string | number
  isEditing: boolean // New prop
  editedParamsString: string // New prop
  onParamsChange: (newParams: string) => void // New prop
  onSave: () => void // New prop
  onCancel: () => void // New prop
}

const ToolResponseContent: FC<ToolResponseContentProps> = ({
  params,
  response,
  fontFamily,
  fontSize,
  isEditing,
  editedParamsString,
  onParamsChange,
  onSave,
  onCancel
}) => {
  console.log('[ToolResponseContent] Rendering with props:', { isEditing, editedParamsString }) // Log received props
  const { t } = useTranslation() // Get translation function
  const [isVisible, setIsVisible] = useState(false)
  const [isContentReady, setIsContentReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  // Use separate refs for params and response strings
  const paramsStringRef = useRef<string>('')
  const responseStringRef = useRef<string>('')

  // Preprocess params and response JSON data
  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      try {
        // 添加更详细的日志，帮助排查问题
        console.log('[ToolResponseContent] Debug - Raw params:', params)
        console.log('[ToolResponseContent] Debug - Raw response:', response)
        console.log('[ToolResponseContent] Debug - Response type:', typeof response)

        // 使用辅助函数提取参数
        const extractedParams =
          extractParamsFromMCPResponse(response) || (params && Object.keys(params).length > 0 ? params : null)

        if (extractedParams) {
          console.log('[ToolResponseContent] Using extracted params:', extractedParams)
          paramsStringRef.current = JSON.stringify(extractedParams, null, 2)
        } else {
          // 如果没有参数，显示空对象
          console.log('[ToolResponseContent] No params found after extraction attempts')
          paramsStringRef.current = '{}'
        }
      } catch (error) {
        console.error('Error stringifying params:', error)
        paramsStringRef.current = String(params)
      }

      // --- 核心修改部分：处理 responseStringRef ---
      let processedResponseString = String(response) // 默认回退到显示原始响应的字符串表示

      try {
        if (response && typeof response === 'object') {
          // 创建响应的副本，移除 _originalArgs 字段
          const responseForDisplay = { ...response }
          if (responseForDisplay._originalArgs) {
            delete responseForDisplay._originalArgs
            console.log('[ToolResponseContent] Removed _originalArgs from response for display')
          }

          // 尝试判断响应是否是 { content: [{ type: 'text', text: '...' }] } 的特定结构
          if (
            Array.isArray(responseForDisplay.content) &&
            responseForDisplay.content.length > 0 &&
            responseForDisplay.content[0].type === 'text' &&
            typeof responseForDisplay.content[0].text === 'string'
          ) {
            const rawInnerText = responseForDisplay.content[0].text
            try {
              // ***尝试将提取到的内部字符串解析为 JSON 对象***
              const parsedInnerText = JSON.parse(rawInnerText)
              // ***如果解析成功，将解析后的对象重新格式化为带缩进的 JSON 字符串用于显示***
              processedResponseString = JSON.stringify(parsedInnerText, null, 2)
              console.log('[ToolResponseContent] Successfully parsed inner JSON:', processedResponseString) // 调试日志
            } catch (innerParseError) {
              // 如果内部字符串不是有效的 JSON 格式（或者解析失败）
              console.warn(
                '[ToolResponseContent] Inner text is not valid JSON, displaying raw string literal:',
                rawInnerText
              ) // 调试日志
              // 回退到显示原始内部字符串
              processedResponseString = rawInnerText
            }
          } else {
            // 如果响应结构不是预期的类型，则将整个响应对象格式化为 JSON 字符串显示
            processedResponseString = JSON.stringify(responseForDisplay, null, 2)
          }
        } else {
          // 如果响应不是对象类型，直接转换为字符串
          processedResponseString = String(response)
        }
      } catch (error) {
        console.error('[ToolResponseContent] Error processing response data structure:', error) // 调试日志
        // 在任何处理过程中出现错误，都尝试回退到将原始响应格式化为 JSON 字符串
        try {
          // 创建响应的副本，移除 _originalArgs 字段
          const responseForDisplay = { ...response }
          if (responseForDisplay._originalArgs) {
            delete responseForDisplay._originalArgs
          }
          processedResponseString = JSON.stringify(responseForDisplay, null, 2)
        } catch (finalStringifyError) {
          // 如果连 JSON.stringify 都失败，回退到最原始的字符串表示
          processedResponseString = String(response)
        }
      }

      // 将最终处理好的字符串赋值给 ref
      responseStringRef.current = processedResponseString
      setIsContentReady(true)
    }, 0)

    return () => clearTimeout(timer)
  }, [params, response, t]) // Add t to dependencies

  // 使用 IntersectionObserver 检测组件是否可见
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
          observer.disconnect() // 一旦可见，就不再需要观察
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // 10% 可见时触发，增加 rootMargin 提前加载
    )

    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [])

  // Render separate sections for params and response in a flex container
  return (
    <ToolResponseContainer ref={containerRef} style={{ fontFamily, fontSize }}>
      <GlobalStyle /> {/* 添加全局样式 */}
      {isVisible && isContentReady ? (
        <FlexContainer>
          <Section flexBasis="40%">
            <SectionLabel>{t('message.tools.parameters')}</SectionLabel>
            {isEditing ? (
              <EditContainer>
                <StyledTextArea
                  autoSize={{ minRows: 3, maxRows: 10 }}
                  value={editedParamsString}
                  onChange={(e) => onParamsChange(e.target.value)}
                  style={{ fontFamily: 'ubuntu', fontSize: '13px' }} // 增大字体
                />
                <EditActions>
                  <Button size="small" onClick={onCancel}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="primary" size="small" onClick={onSave}>
                    {t('common.save_rerun', 'Save & Rerun')} {/* TODO: Add translation */}
                  </Button>
                </EditActions>
              </EditContainer>
            ) : (
              <>
                {paramsStringRef.current === '{}' ? (
                  <NoParamsPlaceholder>{t('message.tools.no_params')}</NoParamsPlaceholder>
                ) : (
                  <SyntaxHighlighter
                    language="json"
                    className="tool-response-syntax-highlighter"
                    style={atomOneDark}
                    customStyle={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'normal',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      backgroundColor: 'var(--color-bg-2)',
                      borderRadius: '4px',
                      width: '100%',
                      maxWidth: '100%',
                      display: 'block'
                    }}
                    codeTagProps={{
                      style: {
                        fontFamily: fontFamily,
                        fontSize: '14px',
                        color: 'var(--color-text)',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        wordBreak: 'normal'
                      }
                    }}
                    wrapLines={true}
                    wrapLongLines={true}
                    lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'normal' } }}
                    PreTag="div">
                    {paramsStringRef.current}
                  </SyntaxHighlighter>
                )}
              </>
            )}
          </Section>
          <Divider />
          <Section flexBasis="60%">
            <SectionLabel>{t('message.tools.results')}</SectionLabel>
            <SyntaxHighlighter
              language="json"
              className="tool-response-syntax-highlighter"
              style={atomOneDark} // Apply the chosen style
              customStyle={{
                margin: 0, // Remove margin
                whiteSpace: 'pre-wrap', // 允许在空白处换行
                wordBreak: 'normal', // 使用normal而不是break-all，避免过度换行
                maxHeight: '280px',
                overflowY: 'auto', // Add scrollbar
                overflowX: 'hidden', // 隐藏水平滚动条
                backgroundColor: 'var(--color-bg-2)', // 修改为与参数区域一致的背景色
                borderRadius: '4px', // 添加圆角
                width: '100%', // 确保宽度100%
                maxWidth: '100%' // 限制最大宽度
              }}
              codeTagProps={{
                style: {
                  fontFamily: fontFamily, // Use the provided font family
                  fontSize: '14px', // Increase font size for better readability
                  color: 'var(--color-text)', // Ensure text color is readable
                  whiteSpace: 'pre-wrap', // 允许在空白处换行
                  wordWrap: 'break-word', // 确保长单词换行
                  wordBreak: 'normal' // 使用normal而不是break-all，避免过度换行
                }
              }}
              wrapLines={true} // 启用行包装
              wrapLongLines={true} // 包装长行
              lineProps={{ style: { whiteSpace: 'pre-wrap', wordBreak: 'break-all' } }} // 为每一行添加样式
              PreTag="div">
              {responseStringRef.current}
            </SyntaxHighlighter>
          </Section>
        </FlexContainer>
      ) : (
        <LoadingPlaceholder>{t('common.loading')}...</LoadingPlaceholder>
      )}
    </ToolResponseContainer>
  )
}

// --- Additional Styled Components for Editing ---
const EditContainer = styled.div`
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-1);
  border-radius: 6px;
  padding: 8px;
  box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.05);
`

const StyledTextArea = styled(Input.TextArea)`
  flex-grow: 1; /* Allow textarea to fill available space */
  resize: vertical; /* Allow vertical resize */
  margin-bottom: 12px;
  font-family: 'Ubuntu Mono', monospace !important; /* Ensure monospace font */
  font-size: 13px !important;
  line-height: 1.6;
  background-color: var(--color-bg-input); /* Use input background */
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 6px;
  padding: 10px 12px;
  transition: all 0.2s ease;

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-border);
  }

  &:hover:not(:focus) {
    border-color: var(--color-primary-light, #40a9ff);
  }
`

const EditActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);

  button {
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
  }
`

// 添加无参数占位符样式组件在文件底部
const NoParamsPlaceholder = styled.div`
  color: var(--color-text-3);
  font-style: italic;
  padding: 12px;
  text-align: center;
  background-color: var(--color-bg-mute);
  border-radius: 4px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`

// 使用 memo 包装组件，避免不必要的重渲染
export default memo(ToolResponseContent)
