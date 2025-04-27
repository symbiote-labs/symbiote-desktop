import { useCallback, useState } from 'react'

import { Tab } from '../types'

/**
 * 自定义Hook，用于管理标签页拖拽
 * 将拖拽逻辑与组件渲染逻辑分离
 */
export function useTabDragManager(setTabs: React.Dispatch<React.SetStateAction<Tab[]>>) {
  // 拖拽状态
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null)
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null)
  const [animationDirection, setAnimationDirection] = useState<'left' | 'right' | null>(null)

  /**
   * 处理拖拽开始
   * @param index 被拖拽标签页的索引
   */
  const handleDragStart = useCallback((index: number) => {
    setDraggedTabIndex(index)
  }, [])

  /**
   * 处理拖拽结束
   */
  const handleDragEnd = useCallback(() => {
    setDraggedTabIndex(null)
    setDragOverTabIndex(null)
    setAnimationDirection(null)
  }, [])

  /**
   * 处理拖拽悬停
   * @param index 悬停标签页的索引
   */
  const handleDragOver = useCallback(
    (index: number) => {
      if (draggedTabIndex === null || draggedTabIndex === index) return

      // 设置动画方向
      if (dragOverTabIndex !== index) {
        setAnimationDirection(index > draggedTabIndex ? 'right' : 'left')
        setDragOverTabIndex(index)
      }
    },
    [draggedTabIndex, dragOverTabIndex]
  )

  /**
   * 处理拖拽放置
   */
  const handleDrop = useCallback(() => {
    if (draggedTabIndex === null || dragOverTabIndex === null) return

    setTabs((prevTabs) => {
      const newTabs = [...prevTabs]
      const [draggedTab] = newTabs.splice(draggedTabIndex, 1)
      newTabs.splice(dragOverTabIndex, 0, draggedTab)
      return newTabs
    })

    // 重置拖拽状态
    handleDragEnd()
  }, [draggedTabIndex, dragOverTabIndex, setTabs, handleDragEnd])

  return {
    draggedTabIndex,
    dragOverTabIndex,
    animationDirection,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop
  }
}
