/**
 * URL处理工具函数
 */

/**
 * 检查字符串是否是有效的URL
 * @param url 要检查的URL字符串
 * @returns 是否是有效的URL
 */
export function isValidUrl(url: string): boolean {
  try {
    // 尝试创建URL对象，如果成功则是有效URL
    new URL(url)
    return true
  } catch (e) {
    // 如果添加https://前缀后可以创建URL对象，也认为是有效的
    try {
      new URL(`https://${url}`)
      return true
    } catch (e) {
      return false
    }
  }
}

/**
 * 检查输入是否是搜索查询而不是URL
 * @param input 用户输入
 * @returns 是否是搜索查询
 */
export function isSearchQuery(input: string): boolean {
  // 如果包含空格，很可能是搜索查询
  if (input.includes(' ')) return true

  // 如果不包含点号，可能是搜索查询
  if (!input.includes('.')) return true

  // 如果包含特殊搜索字符，可能是搜索查询
  if (/[?!@#$%^&*()[\]{}<>:;]/.test(input)) return true

  return false
}

/**
 * 格式化URL，处理各种输入情况
 * @param input 用户输入的URL或搜索查询
 * @returns 格式化后的URL
 */
export function formatUrl(input: string): string {
  if (!input) return 'about:blank'

  const trimmedInput = input.trim()

  // 处理特殊URL
  if (trimmedInput === 'about:blank') return trimmedInput
  if (trimmedInput.startsWith('file://')) return trimmedInput
  if (trimmedInput.startsWith('data:')) return trimmedInput

  // 检查是否已经是有效URL
  if (trimmedInput.startsWith('http://') || trimmedInput.startsWith('https://')) {
    try {
      new URL(trimmedInput)
      return trimmedInput
    } catch (e) {
      // 无效URL，作为搜索查询处理
      return createSearchUrl(trimmedInput)
    }
  }

  // 检查是否是搜索查询
  if (isSearchQuery(trimmedInput)) {
    return createSearchUrl(trimmedInput)
  }

  // 尝试添加https://前缀
  try {
    new URL(`https://${trimmedInput}`)
    return `https://${trimmedInput}`
  } catch (e) {
    // 如果仍然无效，作为搜索查询处理
    return createSearchUrl(trimmedInput)
  }
}

/**
 * 创建搜索URL
 * @param query 搜索查询
 * @returns 搜索引擎URL
 */
export function createSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

/**
 * 获取URL的域名部分
 * @param url URL字符串
 * @returns 域名
 */
export function getDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch (e) {
    return ''
  }
}

/**
 * 格式化显示URL（可能移除http://等前缀）
 * @param url 完整URL
 * @returns 格式化后的显示URL
 */
export function formatDisplayUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // 移除默认端口
    const port = urlObj.port === '80' || urlObj.port === '443' || urlObj.port === '' ? '' : `:${urlObj.port}`

    // 移除www前缀
    const host = urlObj.hostname.startsWith('www.') ? urlObj.hostname.substring(4) : urlObj.hostname

    // 构建显示URL
    return `${host}${port}${urlObj.pathname}${urlObj.search}${urlObj.hash}`
  } catch (e) {
    return url
  }
}
