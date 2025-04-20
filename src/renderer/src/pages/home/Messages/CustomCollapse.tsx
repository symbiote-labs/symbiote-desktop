import React, { FC, useCallback, useLayoutEffect, useRef, useState } from 'react'
import styled from 'styled-components'

interface CustomCollapseProps {
  title: React.ReactNode
  children: React.ReactNode
  isActive: boolean
  onToggle: () => void
  id: string
}

const CustomCollapse: FC<CustomCollapseProps> = ({ title, children, isActive, onToggle }) => {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | 'auto'>(0)
  const [isContentVisible, setIsContentVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const prevActiveRef = useRef(isActive)

  // 使用 requestAnimationFrame 来优化动画性能
  const animateHeight = useCallback((from: number, to: number, duration: number = 250) => {
    setIsAnimating(true)
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime
      const progress = Math.min(elapsedTime / duration, 1)
      // 使用缓动函数使动画更平滑
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const currentHeight = from + (to - from) * easeProgress

      setHeight(currentHeight)

      if (progress < 1) {
        window.requestAnimationFrame(animate)
      } else {
        setHeight(to === 0 ? 0 : 'auto')
        setIsAnimating(false)
        setIsContentVisible(to !== 0)
      }
    }

    window.requestAnimationFrame(animate)
  }, [])

  // 使用 useLayoutEffect 来测量高度，避免闪烁
  useLayoutEffect(() => {
    // 如果状态没有变化，不做任何处理
    if (prevActiveRef.current === isActive) return

    // 如果正在动画中，不做处理
    if (isAnimating) return

    prevActiveRef.current = isActive

    if (isActive) {
      // 展开
      if (contentRef.current) {
        const contentHeight = contentRef.current.scrollHeight
        animateHeight(0, contentHeight)
      }
    } else {
      // 折叠
      if (contentRef.current) {
        const currentHeight = contentRef.current.scrollHeight
        animateHeight(currentHeight, 0)
      }
    }
  }, [isActive, animateHeight, isAnimating])

  return (
    <CollapseWrapper>
      <CollapseHeader onClick={onToggle}>{title}</CollapseHeader>
      <CollapseContent
        ref={contentRef}
        style={{
          height: height === 'auto' ? 'auto' : `${height}px`,
          // 使用 transform 而不是 height 来触发硬件加速
          transform: `translateZ(0)`,
          // 使用 will-change 提前告知浏览器将要发生变化
          willChange: isAnimating ? 'height' : 'auto',
          // 使用 contain 限制重绘范围
          contain: 'content',
          // 使用 GPU 加速
          backfaceVisibility: 'hidden'
        }}
        $isActive={isActive}>
        <div
          style={{
            display: isContentVisible || isActive ? 'block' : 'none',
            // 使用 transform 触发硬件加速
            transform: 'translateZ(0)',
            // 使用 contain 限制重绘范围
            contain: 'content'
          }}>
          {children}
        </div>
      </CollapseContent>
    </CollapseWrapper>
  )
}

const CollapseWrapper = styled.div`
  border-bottom: 1px solid var(--color-border);
  overflow: hidden;
  background-color: var(--color-bg-1);
  will-change: transform;
  transform: translateZ(0);

  &:last-child {
    border-bottom: none;
  }
`

const CollapseHeader = styled.div`
  padding: 12px 16px;
  cursor: pointer;
  background-color: var(--color-bg-2);
  transition: background-color 0.2s;
  will-change: transform, background-color;

  &:hover {
    background-color: var(--color-bg-3);
  }
`

const CollapseContent = styled.div<{ $isActive: boolean }>`
  overflow: hidden;
  /* 移除过渡效果，改用 requestAnimationFrame 手动控制动画 */
  /* 使用 GPU 加速 */
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  perspective: 1000;
  -webkit-perspective: 1000;
  background-color: var(--color-bg-1); /* 添加背景色 */
`

export default CustomCollapse
