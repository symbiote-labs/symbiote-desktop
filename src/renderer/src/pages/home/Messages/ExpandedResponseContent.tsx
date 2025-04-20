import { FC, memo, useLayoutEffect, useRef, useState } from 'react'
import styled from 'styled-components'

interface ExpandedResponseContentProps {
  content: string
  fontFamily: string
  fontSize: string | number
  onCopy: () => void
}

const ExpandedResponseContent: FC<ExpandedResponseContentProps> = ({ content, fontFamily, fontSize, onCopy }) => {
  const [isLoading, setIsLoading] = useState(true)
  const [visibleContent, setVisibleContent] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<string>('')
  const animationFrameRef = useRef<number | null>(null)

  // 使用 requestAnimationFrame 分批渲染内容
  useLayoutEffect(() => {
    if (!content) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    contentRef.current = content

    // 如果内容很短，直接渲染
    if (content.length < 5000) {
      setVisibleContent(content)
      setIsLoading(false)
      return
    }

    // 分批渲染大型内容
    let currentPosition = 0
    const chunkSize = 5000 // 每次渲染 5000 个字符

    const renderNextChunk = () => {
      const nextChunk = contentRef.current.slice(0, currentPosition + chunkSize)
      currentPosition += chunkSize

      setVisibleContent(nextChunk)

      if (currentPosition < contentRef.current.length) {
        // 还有更多内容要渲染，使用 requestAnimationFrame 而不是 setTimeout
        animationFrameRef.current = requestAnimationFrame(renderNextChunk)
      } else {
        // 所有内容已渲染完成
        setIsLoading(false)
      }
    }

    // 开始渲染第一批，使用 requestAnimationFrame 而不是 setTimeout
    animationFrameRef.current = requestAnimationFrame(renderNextChunk)

    // 清理函数
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [content])

  return (
    <ExpandedResponseContainer ref={containerRef} style={{ fontFamily, fontSize }}>
      <ActionButton className="copy-expanded-button" onClick={onCopy} aria-label="复制">
        <i className="iconfont icon-copy"></i>
      </ActionButton>

      {isLoading && <LoadingIndicator>正在加载内容...</LoadingIndicator>}

      <CodeBlock dangerouslySetInnerHTML={{ __html: visibleContent }} />
    </ExpandedResponseContainer>
  )
}

const ExpandedResponseContainer = styled.div`
  background: var(--color-bg-1);
  border-radius: 8px;
  padding: 16px;
  position: relative;
  will-change: transform; /* 优化渲染性能 */
  transform: translateZ(0); /* 启用硬件加速 */
  backface-visibility: hidden; /* 使用 GPU 加速 */
  -webkit-backface-visibility: hidden;
  perspective: 1000;
  -webkit-perspective: 1000;
  contain: content; /* 限制重绘范围 */

  .copy-expanded-button {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: var(--color-bg-2);
    border-radius: 4px;
    z-index: 1;
  }
`

const LoadingIndicator = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: var(--color-bg-2);
  padding: 8px 16px;
  border-radius: 4px;
  color: var(--color-text-2);
  font-size: 14px;
  z-index: 2;
`

const ActionButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-2);
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: all 0.2s;
  border-radius: 4px;

  &:hover {
    opacity: 1;
    color: var(--color-text);
    background-color: var(--color-bg-1);
  }

  &:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
    opacity: 1;
  }

  .iconfont {
    font-size: 14px;
  }
`

const CodeBlock = styled.pre`
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-text);
  font-family: ubuntu;
  contain: content; /* 优化渲染性能 */
  min-height: 100px;
  transform: translateZ(0); /* 启用硬件加速 */
  backface-visibility: hidden; /* 使用 GPU 加速 */
  -webkit-backface-visibility: hidden;
  will-change: transform; /* 告知浏览器将要发生变化 */
`

export default memo(ExpandedResponseContent)
