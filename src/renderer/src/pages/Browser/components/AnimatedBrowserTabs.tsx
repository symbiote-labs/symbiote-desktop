import { PlusOutlined } from '@ant-design/icons'
import { AnimatePresence } from 'framer-motion'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AddTabButton,
  AnimatedTabsContainer,
  DragPlaceholder,
  TabActiveIndicator,
  TabHoverIndicator,
  TabsListContainer
} from '../styles/AnimatedTabsStyles'
import { Tab } from '../types'
import TabItem from './TabItem'
import { TabsProvider, useTabsContext } from './TabsContext'

interface AnimatedBrowserTabsProps {
  tabs: Tab[]
  activeTabId: string
  onTabChange: (tabId: string) => void
  onAddTab: () => void
  onCloseTab: (tabId: string, e: React.MouseEvent<HTMLElement>) => void
  onDragStart: (index: number) => void
  onDragEnd: () => void
  onDragOver: (index: number) => void
  draggedTabIndex: number | null
  dragOverTabIndex: number | null
  animationDirection: number
}

// 内部实现组件
const AnimatedBrowserTabsInner: React.FC<AnimatedBrowserTabsProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onAddTab,
  onCloseTab,
  onDragStart,
  onDragEnd,
  onDragOver,
  dragOverTabIndex
  /*
  // 这些参数在组件内部不直接使用，但在类型定义中需要
  draggedTabIndex,
  animationDirection
  */
}) => {
  const { t } = useTranslation()
  const { tabRefs, tabsContainerRef, hoveredTabId, draggedTabId, isDragging } = useTabsContext()

  // 悬停指示器状态
  const [hoverIndicator, setHoverIndicator] = useState({
    x: 0,
    width: 0,
    opacity: 0
  })

  // 活动指示器状态
  const [activeIndicator, setActiveIndicator] = useState({
    x: 0,
    width: 0
  })

  // 拖拽占位符状态
  const [dragPlaceholder, setDragPlaceholder] = useState({
    x: 0,
    width: 0,
    opacity: 0
  })

  // 更新悬停指示器
  useEffect(() => {
    if (hoveredTabId && tabRefs.current[hoveredTabId] && !isDragging) {
      const tabElement = tabRefs.current[hoveredTabId]
      const containerRect = tabsContainerRef.current?.getBoundingClientRect()
      const tabRect = tabElement.getBoundingClientRect()

      if (containerRect) {
        setHoverIndicator({
          x: tabRect.left - containerRect.left,
          width: tabRect.width,
          opacity: 1
        })
      }
    } else {
      setHoverIndicator((prev) => ({ ...prev, opacity: 0 }))
    }
  }, [hoveredTabId, tabRefs, tabsContainerRef, isDragging])

  // 更新活动指示器
  useEffect(() => {
    if (activeTabId && tabRefs.current[activeTabId]) {
      const tabElement = tabRefs.current[activeTabId]
      const containerRect = tabsContainerRef.current?.getBoundingClientRect()
      const tabRect = tabElement.getBoundingClientRect()

      if (containerRect) {
        setActiveIndicator({
          x: tabRect.left - containerRect.left,
          width: tabRect.width
        })
      }
    }
  }, [activeTabId, tabs, tabRefs, tabsContainerRef])

  // 更新拖拽占位符
  useEffect(() => {
    if (draggedTabId && dragOverTabIndex !== null && tabsContainerRef.current) {
      const containerRect = tabsContainerRef.current.getBoundingClientRect()
      const draggedTabElement = tabRefs.current[draggedTabId]

      if (draggedTabElement) {
        const draggedTabRect = draggedTabElement.getBoundingClientRect()
        const targetTabElement = tabRefs.current[tabs[dragOverTabIndex].id]

        if (targetTabElement) {
          const targetTabRect = targetTabElement.getBoundingClientRect()

          setDragPlaceholder({
            x: targetTabRect.left - containerRect.left,
            width: draggedTabRect.width,
            opacity: 0.5
          })
        }
      }
    } else {
      setDragPlaceholder((prev) => ({ ...prev, opacity: 0 }))
    }
  }, [draggedTabId, dragOverTabIndex, tabs, tabRefs, tabsContainerRef])

  return (
    <AnimatedTabsContainer>
      <TabsListContainer ref={tabsContainerRef}>
        <AnimatePresence>
          {tabs.map((tab, index) => (
            <TabItem
              key={tab.id}
              tab={tab}
              index={index}
              isActive={tab.id === activeTabId}
              onTabChange={onTabChange}
              onCloseTab={onCloseTab}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
            />
          ))}
        </AnimatePresence>

        <AddTabButton onClick={onAddTab} title={t('browser.new_tab')}>
          <PlusOutlined />
        </AddTabButton>

        {/* 悬停指示器 */}
        <TabHoverIndicator
          initial={{ opacity: 0 }}
          animate={{
            x: hoverIndicator.x,
            width: hoverIndicator.width,
            opacity: hoverIndicator.opacity
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30
          }}
        />

        {/* 活动指示器 */}
        <TabActiveIndicator
          initial={{ opacity: 0 }}
          animate={{
            x: activeIndicator.x,
            width: activeIndicator.width,
            opacity: 1
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30
          }}
        />

        {/* 拖拽占位符 */}
        <DragPlaceholder
          initial={{ opacity: 0 }}
          animate={{
            x: dragPlaceholder.x,
            width: dragPlaceholder.width,
            opacity: dragPlaceholder.opacity
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30
          }}
        />
      </TabsListContainer>
    </AnimatedTabsContainer>
  )
}

// 包装组件，提供上下文
const AnimatedBrowserTabs: React.FC<Omit<AnimatedBrowserTabsProps, 'tabRefs' | 'hoveredTabId' | 'setHoveredTabId'>> = (
  props
) => {
  return (
    <TabsProvider>
      <AnimatedBrowserTabsInner {...props} />
    </TabsProvider>
  )
}

export default AnimatedBrowserTabs
