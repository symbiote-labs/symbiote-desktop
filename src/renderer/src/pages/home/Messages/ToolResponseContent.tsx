import { Button, Input } from 'antd' // Import Button and Input
import { FC, memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// --- Styled Components Definitions ---

// Add FlexContainer style and modify Section style
const FlexContainer = styled.div`
  display: flex;
  gap: 16px;
  align-items: stretch; /* Ensure items stretch to fill height */
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
`

const SectionLabel = styled.div`
  font-weight: 500;
  color: var(--color-text-2);
  margin-bottom: 4px;
  font-size: 11px; /* Slightly smaller label */
`

const ToolResponseContainer = styled.div`
  background: var(--color-bg-1);
  border-radius: 0 0 4px 4px;
  padding: 12px 16px;
  /* overflow: auto; Remove overflow here, let sections handle scrolling if needed */
  /* max-height: 300px; Remove fixed max-height for the container */
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
`

const CodeBlock = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
  font-family: ubuntu;
  contain: content;
  max-height: 280px; /* Limit height of code block */
  overflow-y: auto; /* Add scrollbar if content exceeds max height */
  /* transform: translateZ(0); 移除硬件加速，可能导致编辑时闪烁 */
  backface-visibility: hidden; /* 使用 GPU 加速 */
  -webkit-backface-visibility: hidden;
`

const LoadingPlaceholder = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 50px;
  color: var(--color-text-2);
  font-size: 14px;
  transform: translateZ(0); /* 启用硬件加速 */
  backface-visibility: hidden; /* 使用 GPU 加速 */
  -webkit-backface-visibility: hidden;
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
        // Stringify params, handle potential empty objects/null/undefined
        paramsStringRef.current =
          params && Object.keys(params).length > 0 ? JSON.stringify(params, null, 2) : t('message.tools.no_params') // Display message if no params
      } catch (error) {
        console.error('Error stringifying params:', error)
        paramsStringRef.current = String(params)
      }
      try {
        // Stringify response
        responseStringRef.current = JSON.stringify(response, null, 2)
      } catch (error) {
        console.error('Error stringifying response:', error)
        responseStringRef.current = String(response)
      }
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
      {isVisible && isContentReady ? (
        <FlexContainer>
          <Section flexBasis="40%">
            <SectionLabel>{t('message.tools.parameters')}:</SectionLabel>
            {isEditing ? (
              <EditContainer>
                <StyledTextArea
                  autoSize={{ minRows: 3, maxRows: 10 }}
                  value={editedParamsString}
                  onChange={(e) => onParamsChange(e.target.value)}
                  style={{ fontFamily: 'ubuntu', fontSize: '12px' }} // Ensure consistent font
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
              <CodeBlock>{paramsStringRef.current}</CodeBlock>
            )}
          </Section>
          <Divider />
          <Section flexBasis="60%">
            {' '}
            {/* Adjust flex-basis to 60% */}
            <SectionLabel>{t('message.tools.results')}:</SectionLabel>
            <CodeBlock>{responseStringRef.current}</CodeBlock>
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
  /* height: 100%; Remove fixed height, let content determine height */
`

const StyledTextArea = styled(Input.TextArea)`
  flex-grow: 1; /* Allow textarea to fill available space */
  resize: vertical; /* Allow vertical resize */
  margin-bottom: 8px;
  font-family: 'Ubuntu Mono', monospace !important; /* Ensure monospace font */
  font-size: 12px !important;
  line-height: 1.5;
  background-color: var(--color-bg-input); /* Use input background */
  border: 1px solid var(--color-border);
  color: var(--color-text);
  border-radius: 4px;

  &:focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-border);
  }
`

const EditActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto; /* Push actions to the bottom */
`

// 使用 memo 包装组件，避免不必要的重渲染
export default memo(ToolResponseContent)
