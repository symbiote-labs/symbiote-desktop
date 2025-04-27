import React, { createContext, ReactNode, use, useRef, useState } from 'react'

interface TabsContextType {
  // 拖拽相关状态
  isDragging: boolean
  setIsDragging: (isDragging: boolean) => void
  draggedTabId: string | null
  setDraggedTabId: (tabId: string | null) => void

  // 悬停相关状态
  hoveredTabId: string | null
  setHoveredTabId: (tabId: string | null) => void

  // DOM引用
  tabRefs: React.RefObject<Record<string, HTMLDivElement | null>>
  tabsContainerRef: React.RefObject<HTMLDivElement | null>

  // 动画相关
  animationDirection: number // 1: 向右, -1: 向左, 0: 无动画
  setAnimationDirection: (direction: number) => void
}

const TabsContext = createContext<TabsContextType | undefined>(undefined)

export const TabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDragging, setIsDragging] = useState(false)
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null)
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)
  const [animationDirection, setAnimationDirection] = useState(0)

  const tabRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const tabsContainerRef = useRef<HTMLDivElement | null>(null)

  return (
    <TabsContext
      value={{
        isDragging,
        setIsDragging,
        draggedTabId,
        setDraggedTabId,
        hoveredTabId,
        setHoveredTabId,
        tabRefs,
        tabsContainerRef,
        animationDirection,
        setAnimationDirection
      }}>
      {children}
    </TabsContext>
  )
}

export const useTabsContext = () => {
  const context = use(TabsContext)
  if (!context) {
    throw new Error('useTabsContext must be used within a TabsProvider')
  }
  return context
}
