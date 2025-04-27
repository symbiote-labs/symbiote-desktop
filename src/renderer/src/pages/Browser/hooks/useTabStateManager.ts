import { useCallback } from 'react'

import { Tab } from '../types'

/**
 * 自定义Hook，用于管理标签页状态
 * 将标签页状态管理逻辑与组件渲染逻辑分离
 */
export function useTabStateManager(
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>,
  activeTabId: string,
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>
) {
  /**
   * 更新标签页信息
   * @param tabId 标签页ID
   * @param updates 要更新的属性
   */
  const updateTabInfo = useCallback(
    (tabId: string, updates: Partial<Tab>) => {
      setTabs((prevTabs) => prevTabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab)))
    },
    [setTabs]
  )

  /**
   * 添加新标签页
   * @param url 初始URL
   * @param active 是否激活
   * @param title 初始标题
   * @returns 新标签页ID
   */
  const addTab = useCallback(
    (url: string = 'https://www.google.com', active: boolean = true, title: string = '加载中...') => {
      const newTabId = `tab-${Date.now()}`

      const newTab: Tab = {
        id: newTabId,
        url,
        title,
        favicon: '',
        isLoading: true,
        canGoBack: false,
        canGoForward: false
      }

      setTabs((prevTabs) => [...prevTabs, newTab])

      if (active) {
        setActiveTabId(newTabId)
      }

      return newTabId
    },
    [setTabs, setActiveTabId]
  )

  /**
   * 关闭标签页
   * @param tabId 标签页ID
   */
  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prevTabs) => {
        const tabIndex = prevTabs.findIndex((tab) => tab.id === tabId)

        if (tabIndex === -1) return prevTabs

        const newTabs = [...prevTabs]
        newTabs.splice(tabIndex, 1)

        // 如果关闭的是当前活动标签页，则激活相邻标签页
        if (tabId === activeTabId && newTabs.length > 0) {
          const newActiveIndex = Math.min(tabIndex, newTabs.length - 1)
          setActiveTabId(newTabs[newActiveIndex].id)
        }

        return newTabs
      })
    },
    [setTabs, activeTabId, setActiveTabId]
  )

  /**
   * 在新标签页中打开URL
   * @param url URL
   * @param active 是否激活
   * @param title 初始标题
   * @returns 新标签页ID
   */
  const openUrlInTab = useCallback(
    (url: string, active: boolean = true, title: string = '加载中...') => {
      return addTab(url, active, title)
    },
    [addTab]
  )

  return {
    updateTabInfo,
    addTab,
    closeTab,
    openUrlInTab
  }
}
