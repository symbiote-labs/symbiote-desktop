import React, { FC, useLayoutEffect, useRef, useState } from 'react'
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
  const [height, setHeight] = useState<number | 'auto'>(isActive ? 'auto' : 0)
  // Use useLayoutEffect to update height based on isActive prop
  useLayoutEffect(() => {
    console.log('[CustomCollapse] useLayoutEffect triggered. isActive:', isActive) // Log effect trigger
    if (isActive) {
      // When expanding, set height to 'auto' to allow content to show
      setHeight('auto')
      console.log('[CustomCollapse] Expanding: setting height to auto.') // Log height set
    } else {
      // When collapsing, set height to 0
      setHeight(0)
      console.log('[CustomCollapse] Collapsing: setting height to 0.') // Log height set
    }
  }, [isActive])

  console.log('[CustomCollapse] Rendering. isActive:', isActive, 'Current Height:', height) // Log rendering state

  return (
    <CollapseWrapper>
      <CollapseHeader onClick={onToggle}>{title}</CollapseHeader>
      <CollapseContent
        ref={contentRef}
        style={{
          height: height === 'auto' ? 'auto' : `${height}px`,
          overflow: 'hidden' // Ensure content is hidden when collapsed
        }}
        $isActive={isActive}>
        {/* Render children directly */}
        <div>{children}</div>
      </CollapseContent>
    </CollapseWrapper>
  )
}

const CollapseWrapper = styled.div`
  border-bottom: 1px solid var(--color-border);
  overflow: hidden;
  background-color: var(--color-bg-1);

  &:last-child {
    border-bottom: none;
  }
`

const CollapseHeader = styled.div`
  padding: 12px 16px;
  cursor: pointer;
  background-color: var(--color-bg-2);
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--color-bg-3);
  }
`

const CollapseContent = styled.div<{ $isActive: boolean }>`
  overflow: hidden;
  transition: height 250ms ease-out; /* Add CSS transition for height */
  background-color: var(--color-bg-1); /* Add background color */
  transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  perspective: 1000;
  -webkit-perspective: 1000;
`

export default CustomCollapse
