import { useEffect, useState } from 'react'

import { Tab } from '../types'
import { loadTabsFromStorage, saveTabsToStorage } from '../utils/storage'

export const useTabManagement = () => {
  // 选项卡状态管理
  const initialTabState = loadTabsFromStorage()
  const [tabs, setTabs] = useState<Tab[]>(initialTabState.tabs)
  const [activeTabId, setActiveTabId] = useState(initialTabState.activeTabId)

  // 更新选项卡信息
  const updateTabInfo = (tabId: string, updates: Partial<Tab>) => {
    setTabs((prevTabs) => {
      const newTabs = prevTabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab))

      // 保存到本地存储
      saveTabsToStorage(newTabs, activeTabId)

      return newTabs
    })
  }

  // 通用的打开URL函数
  const openUrlInTab = (url: string, inNewTab: boolean = false, title: string = 'New Tab') => {
    if (inNewTab) {
      // 在新标签页中打开链接
      const newTabId = `tab-${Date.now()}`
      const newTab: Tab = {
        id: newTabId,
        title: title,
        url: url,
        isLoading: true,
        canGoBack: false,
        canGoForward: false
      }

      // 创建新的选项卡数组，确保不修改原数组
      const newTabs = [...tabs, newTab]

      // 更新状态
      setTabs(newTabs)
      setActiveTabId(newTabId)

      // 保存到本地存储
      saveTabsToStorage(newTabs, newTabId)

      console.log('Opened URL in new tab:', url, 'tab ID:', newTabId)
    } else {
      // 在当前标签页中打开链接
      // 更新当前选项卡的URL
      updateTabInfo(activeTabId, { url: url })
    }
  }

  // 添加新标签页
  const handleAddTab = (url: string = 'https://www.google.com', title: string = 'New Tab') => {
    const newTabId = `tab-${Date.now()}`
    const newTab: Tab = {
      id: newTabId,
      title: title,
      url: url,
      isLoading: false,
      canGoBack: false,
      canGoForward: false
    }

    const newTabs = [...tabs, newTab]
    setTabs(newTabs)
    setActiveTabId(newTabId)

    // 保存到本地存储
    saveTabsToStorage(newTabs, newTabId)

    return newTabId
  }

  // 关闭标签页
  const handleCloseTab = (tabId: string, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation() // 防止触发选项卡切换
    console.log('Closing tab:', tabId)

    if (tabs.length === 1) {
      // 如果只有一个选项卡，创建一个新的空白选项卡
      handleAddTab()
      return // 已经在handleAddTab中保存了状态，这里直接返回
    }

    // 计算新的活动选项卡ID
    let newActiveTabId = activeTabId
    if (tabId === activeTabId) {
      const currentIndex = tabs.findIndex((tab) => tab.id === tabId)
      const newActiveIndex = currentIndex === 0 ? 1 : currentIndex - 1
      newActiveTabId = tabs[newActiveIndex].id
      setActiveTabId(newActiveTabId)
    }

    // 从选项卡列表中移除
    const newTabs = tabs.filter((tab) => tab.id !== tabId)
    setTabs(newTabs)

    // 保存到本地存储 - 确保不包含已关闭的选项卡
    saveTabsToStorage(newTabs, newActiveTabId)

    console.log('Tab closed, remaining tabs:', newTabs.length)
  }

  // 切换标签页
  const handleTabChange = (newActiveTabId: string) => {
    console.log('Switching to tab:', newActiveTabId)

    // 更新活动标签页ID
    setActiveTabId(newActiveTabId)

    // 保存到本地存储
    saveTabsToStorage(tabs, newActiveTabId)
  }

  // 在组件挂载和卸载时处理webview会话
  useEffect(() => {
    // 组件卸载时保存状态
    return () => {
      saveTabsToStorage(tabs, activeTabId)
    }
  }, [tabs, activeTabId])

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    updateTabInfo,
    openUrlInTab,
    handleAddTab,
    handleCloseTab,
    handleTabChange
  }
}
