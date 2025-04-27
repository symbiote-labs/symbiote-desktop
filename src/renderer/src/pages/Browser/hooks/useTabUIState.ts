import { useCallback, useState } from 'react'

/**
 * 管理标签页UI状态的自定义Hook
 * 负责处理标签页的悬停、选中等UI状态
 */
export function useTabUIState() {
  // 悬停的标签页ID
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null)

  // 右键菜单打开的标签页ID
  const [contextMenuTabId, setContextMenuTabId] = useState<string | null>(null)

  // 右键菜单位置
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null)

  /**
   * 处理标签页悬停
   * @param tabId 标签页ID
   */
  const handleTabHover = useCallback((tabId: string | null) => {
    setHoveredTabId(tabId)
  }, [])

  /**
   * 处理标签页右键菜单
   * @param tabId 标签页ID
   * @param position 菜单位置
   */
  const handleTabContextMenu = useCallback((tabId: string, position: { x: number; y: number }) => {
    setContextMenuTabId(tabId)
    setContextMenuPosition(position)
  }, [])

  /**
   * 关闭右键菜单
   */
  const closeContextMenu = useCallback(() => {
    setContextMenuTabId(null)
    setContextMenuPosition(null)
  }, [])

  return {
    hoveredTabId,
    contextMenuTabId,
    contextMenuPosition,
    handleTabHover,
    handleTabContextMenu,
    closeContextMenu
  }
}
