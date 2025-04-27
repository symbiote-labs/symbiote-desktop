import { CloseOutlined } from '@ant-design/icons'
import React, { useEffect, useRef } from 'react'

// 导入样式组件，假定它们是基于 styled-components 或类似库，且 StyledTabItem 是基于 framer-motion 的 motion.div
import {
  CloseButton,
  TabContent,
  TabIcon,
  TabInfo,
  TabItem as StyledTabItem, // 重命名导入，避免与函数名冲突
  TabTitle
} from '../styles/AnimatedTabsStyles'
import { Tab } from '../types'
import { useTabsContext } from './TabsContext'

interface TabItemProps {
  tab: Tab
  index: number
  isActive: boolean
  onTabChange: (tabId: string) => void
  onCloseTab: (tabId: string, e: React.MouseEvent<HTMLElement>) => void
  onDragStart: (index: number) => void
  onDragEnd: () => void
  onDragOver: (index: number) => void
}

// 组件名称使用 PascalCase
const TabItem: React.FC<TabItemProps> = ({
  tab,
  index,
  isActive,
  onTabChange,
  onCloseTab,
  onDragStart,
  onDragEnd,
  onDragOver
}) => {
  // 移除未使用的变量 draggedTabId 和 isDragging
  const { tabRefs, setHoveredTabId, setDraggedTabId, setIsDragging } = useTabsContext()

  // 使用一个 ref 来引用外部的拖放包装器 div
  const dragWrapperRef = useRef<HTMLDivElement>(null)

  // 注册标签页引用 (指向外部包装器)
  useEffect(() => {
    const currentTabRefs = tabRefs.current // 复制 current 值
    if (dragWrapperRef.current) {
      currentTabRefs[tab.id] = dragWrapperRef.current
    }

    return () => {
      // 在清理函数中使用复制的值
      delete currentTabRefs[tab.id]
    }
  }, [tab.id, tabRefs]) // tabRefs 作为一个整体 ref 对象是稳定的，但它的 .current 属性会变

  // 处理拖拽开始
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.stopPropagation() // 阻止事件冒泡，尤其是如果内部元素也有拖拽或点击事件
    e.dataTransfer.setData('text/plain', tab.id)
    e.dataTransfer.effectAllowed = 'move'

    // 设置拖拽图像为透明
    const img = new Image()
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    e.dataTransfer.setDragImage(img, 0, 0)

    setDraggedTabId(tab.id)
    setIsDragging(true)
    onDragStart(index)

    // 添加拖拽样式到包装器
    if (dragWrapperRef.current) {
      dragWrapperRef.current.classList.add('dragging')
    }
  }

  // 处理拖拽结束
  const handleDragEnd = () => {
    setDraggedTabId(null)
    setIsDragging(false)
    onDragEnd()

    // 移除拖拽样式从包装器
    if (dragWrapperRef.current) {
      dragWrapperRef.current.classList.remove('dragging')
    }
  }

  // 处理拖拽经过
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault() // 必须阻止默认行为才能触发 drop
    e.dataTransfer.dropEffect = 'move'
    onDragOver(index)
  }

  // 处理放置 (实际的放置逻辑通常在父组件的 drop 事件处理中完成，这里可以留空或做一些标记)
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    // 实际的拖放逻辑在onDragEnd中或者接收放置的容器组件中处理
  }

  return (
    // 使用一个标准的 div 作为拖放的包装器，并将拖放相关的props放在这里
    <div
      ref={dragWrapperRef} // 将 ref 绑定到这个包装器 div
      draggable // HTML 标准的 draggable 属性
      onDragStart={handleDragStart} // 绑定 HTML 标准的拖放事件
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop} // 绑定放置事件
      onClick={() => onTabChange(tab.id)} // 点击事件仍然放在包装器上
      onMouseEnter={() => setHoveredTabId(tab.id)} // 鼠标事件也放在包装器上
      onMouseLeave={() => setHoveredTabId(null)}
      style={{ display: 'flex', flexShrink: 0 }} // 包装器样式，确保不影响内部 StyledTabItem 的布局/动画
    >
      {/* StyledTabItem 仍然负责内部内容的样式和 framer-motion 动画 */}
      <StyledTabItem
        $isActive={isActive}
        // 注意：这里不再传递原生的 onDrag* 事件处理器，避免与 StyledTabItem (motion.div) 的内部实现冲突
        // onClick, onMouseEnter, onMouseLeave 已经被移到外部 div
        layout // 让 Framer Motion 处理布局变化时的动画
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        // 添加flex: 1或min-width/width确保在容器中正常显示
        style={{ flex: 1, minWidth: 0 }} // 添加样式确保在flex容器中正常收缩/扩展
      >
        <TabContent>
          <TabInfo>
            {tab.favicon && <TabIcon src={tab.favicon} alt="" />}
            {/* title 属性用于鼠标悬停时的 tooltip */}
            <TabTitle title={tab.title || tab.url}>
              {/* 显示标题，如果没有标题则显示 URL，并去除协议和 www. */}
              {tab.title || (tab.url && tab.url.replace(/^https?:\/\/(www\.)?/, ''))}
            </TabTitle>
          </TabInfo>
          {/* 关闭按钮仍然放在 StyledTabItem 内部的内容区域 */}
          <CloseButton
            onClick={(e) => {
              e.stopPropagation()
              onCloseTab(tab.id, e)
            }}>
            {' '}
            {/* 阻止点击关闭按钮时触发tab切换 */}
            <CloseOutlined style={{ fontSize: '10px' }} />
          </CloseButton>
        </TabContent>
      </StyledTabItem>
    </div>
  )
}

export default TabItem
