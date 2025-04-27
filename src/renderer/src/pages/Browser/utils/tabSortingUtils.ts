import { Tab } from '../types'

/**
 * 重新排序标签页
 * @param tabs 标签页数组
 * @param sourceIndex 源索引
 * @param targetIndex 目标索引
 * @returns 重新排序后的标签页数组
 */
export function reorderTabs(tabs: Tab[], sourceIndex: number, targetIndex: number): Tab[] {
  if (sourceIndex === targetIndex) return tabs

  const newTabs = [...tabs]
  const [movedTab] = newTabs.splice(sourceIndex, 1)
  newTabs.splice(targetIndex, 0, movedTab)

  return newTabs
}

/**
 * 根据域名对标签页进行分组
 * @param tabs 标签页数组
 * @returns 分组后的标签页数组
 */
export function groupTabsByDomain(tabs: Tab[]): Tab[] {
  // 提取域名
  const getDomain = (url: string): string => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname
    } catch (error) {
      return url
    }
  }

  // 按域名分组
  const tabsByDomain: Record<string, Tab[]> = {}

  tabs.forEach((tab) => {
    const domain = getDomain(tab.url)
    if (!tabsByDomain[domain]) {
      tabsByDomain[domain] = []
    }
    tabsByDomain[domain].push(tab)
  })

  // 展平分组
  return Object.values(tabsByDomain).flat()
}

/**
 * 根据标题对标签页进行排序
 * @param tabs 标签页数组
 * @param ascending 是否升序
 * @returns 排序后的标签页数组
 */
export function sortTabsByTitle(tabs: Tab[], ascending: boolean = true): Tab[] {
  return [...tabs].sort((a, b) => {
    const titleA = a.title || a.url
    const titleB = b.title || b.url
    return ascending ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA)
  })
}
