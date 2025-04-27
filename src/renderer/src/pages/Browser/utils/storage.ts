import { Tab } from '../types'

// 从本地存储加载选项卡状态
export const loadTabsFromStorage = (): { tabs: Tab[]; activeTabId: string } => {
  try {
    const savedTabs = localStorage.getItem('browser_tabs')
    const savedActiveTabId = localStorage.getItem('browser_active_tab_id')

    if (savedTabs && savedActiveTabId) {
      // 解析保存的选项卡
      const parsedTabs = JSON.parse(savedTabs) as Tab[]

      // 验证选项卡数据
      const validTabs = parsedTabs.filter(
        (tab) => tab && tab.id && tab.url && typeof tab.id === 'string' && typeof tab.url === 'string'
      )

      // 确保至少有一个选项卡
      if (validTabs.length > 0) {
        // 验证活动选项卡ID
        const isActiveTabValid = validTabs.some((tab) => tab.id === savedActiveTabId)
        const finalActiveTabId = isActiveTabValid ? savedActiveTabId : validTabs[0].id

        console.log('Loaded tabs from storage:', validTabs.length, 'tabs, active tab:', finalActiveTabId)

        return {
          tabs: validTabs,
          activeTabId: finalActiveTabId
        }
      }
    }
  } catch (error) {
    console.error('Failed to load tabs from storage:', error)
  }

  // 默认选项卡
  const defaultTabs = [
    {
      id: '1',
      title: 'Google',
      url: 'https://www.google.com',
      isLoading: false,
      canGoBack: false,
      canGoForward: false
    }
  ]

  console.log('Using default tabs')

  return {
    tabs: defaultTabs,
    activeTabId: '1'
  }
}

// 保存选项卡状态到本地存储
export const saveTabsToStorage = (tabs: Tab[], activeTabId: string) => {
  try {
    // 确保只保存当前有效的选项卡
    const validTabs = tabs.filter((tab) => tab && tab.id && tab.url)

    // 确保activeTabId是有效的
    const isActiveTabValid = validTabs.some((tab) => tab.id === activeTabId)
    const finalActiveTabId = isActiveTabValid ? activeTabId : validTabs.length > 0 ? validTabs[0].id : ''

    // 保存到localStorage
    localStorage.setItem('browser_tabs', JSON.stringify(validTabs))
    localStorage.setItem('browser_active_tab_id', finalActiveTabId)

    console.log('Saved tabs to storage:', validTabs.length, 'tabs, active tab:', finalActiveTabId)
  } catch (error) {
    console.error('Failed to save tabs to storage:', error)
  }
}
