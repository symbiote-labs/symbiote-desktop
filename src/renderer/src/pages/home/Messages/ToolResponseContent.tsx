import { FC, memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import styled from 'styled-components'

interface ToolResponseContentProps {
  result: any
  fontFamily: string
  fontSize: string | number
}

const ToolResponseContent: FC<ToolResponseContentProps> = ({ result, fontFamily, fontSize }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isContentReady, setIsContentReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<string>('')

  // 预处理 JSON 数据，使用 useLayoutEffect 在渲染前完成
  useLayoutEffect(() => {
    // 使用 setTimeout 将处理移到下一个微任务，避免阻塞主线程
    const timer = setTimeout(() => {
      try {
        contentRef.current = JSON.stringify(result, null, 2)
      } catch (error) {
        console.error('Error stringifying result:', error)
        contentRef.current = String(result)
      }
      setIsContentReady(true)
    }, 0)

    return () => clearTimeout(timer)
  }, [result])

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

  return (
    <ToolResponseContainer ref={containerRef} style={{ fontFamily, fontSize }}>
      {isVisible && isContentReady ? (
        <CodeBlock>{contentRef.current}</CodeBlock>
      ) : (
        <LoadingPlaceholder>加载中...</LoadingPlaceholder>
      )}
    </ToolResponseContainer>
  )
}

const ToolResponseContainer = styled.div`
  background: var(--color-bg-1);
  border-radius: 0 0 4px 4px;
  padding: 12px 16px;
  overflow: auto;
  max-height: 300px;
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
  contain: content; /* 优化渲染性能 */
  transform: translateZ(0); /* 启用硬件加速 */
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

// 使用 memo 包装组件，避免不必要的重渲染
export default memo(ToolResponseContent)
