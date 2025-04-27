import { Tab } from '../types'

/**
 * 生成标签页的显示标题
 * @param tab 标签页对象
 * @returns 显示标题
 */
export function getDisplayTitle(tab: Tab): string {
  // 如果有标题，使用标题
  if (tab.title) {
    return tab.title
  }

  // 如果没有标题但有URL，使用格式化后的URL
  if (tab.url) {
    try {
      const urlObj = new URL(tab.url)
      return urlObj.hostname
    } catch (error) {
      return tab.url
    }
  }

  // 默认标题
  return 'New Tab'
}

/**
 * 生成标签页的工具提示
 * @param tab 标签页对象
 * @returns 工具提示
 */
export function getTabTooltip(tab: Tab): string {
  // 如果有标题和URL，显示两者
  if (tab.title && tab.url && tab.title !== tab.url) {
    return `${tab.title}\n${tab.url}`
  }

  // 如果只有URL或标题与URL相同，只显示URL
  return tab.url || 'New Tab'
}

/**
 * 获取标签页的图标URL
 * @param tab 标签页对象
 * @returns 图标URL
 */
export function getTabIconUrl(tab: Tab): string {
  // 如果有favicon，使用favicon
  if (tab.favicon) {
    return tab.favicon
  }

  // 如果有URL，使用域名的favicon
  if (tab.url) {
    try {
      const urlObj = new URL(tab.url)
      return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
    } catch (error) {
      // 如果URL无效，使用默认图标
    }
  }

  // 默认图标
  return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItZ2xvYmUiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIj48L2NpcmNsZT48bGluZSB4MT0iMiIgeTE9IjEyIiB4Mj0iMjIiIHkyPSIxMiI+PC9saW5lPjxwYXRoIGQ9Ik0xMiAyYTE1LjMgMTUuMyAwIDAgMSA0IDEwIDE1LjMgMTUuMyAwIDAgMS00IDEwIDE1LjMgMTUuMyAwIDAgMS00LTEwIDE1LjMgMTUuMyAwIDAgMSA0LTEweiI+PC9wYXRoPjwvc3ZnPg=='
}

/**
 * 截断标题以适应显示
 * @param title 标题
 * @param maxLength 最大长度
 * @returns 截断后的标题
 */
export function truncateTitle(title: string, maxLength: number = 25): string {
  if (title.length <= maxLength) {
    return title
  }

  return title.substring(0, maxLength - 3) + '...'
}

/**
 * 检查标签页是否是空白页
 * @param tab 标签页对象
 * @returns 是否是空白页
 */
export function isBlankTab(tab: Tab): boolean {
  return tab.url === 'about:blank' || tab.url === ''
}
