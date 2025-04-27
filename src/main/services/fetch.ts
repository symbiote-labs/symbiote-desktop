import { JSDOM } from 'jsdom'
import TurndownService from 'turndown'

import { WebSearchResult } from '../../renderer/src/types'

const turndownService = new TurndownService()
export const noContent = 'No content found'

type ResponseFormat = 'markdown' | 'html' | 'text'

/**
 * Validates if the string is a properly formatted URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch (e) {
    return false
  }
}

/**
 * 从网页中提取URL
 * @param markdown Markdown格式的内容
 * @returns 提取的URL数组
 */
export function extractUrlsFromMarkdown(markdown: string): string[] {
  // 匹配Markdown链接格式 [text](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  const markdownUrls: string[] = []
  let match

  while ((match = markdownLinkRegex.exec(markdown)) !== null) {
    const url = match[2].trim()
    if (isValidUrl(url)) {
      markdownUrls.push(url)
    }
  }

  // 匹配纯文本URL
  const urlRegex = /https?:\/\/[^\s)]+/g
  const plainUrls: string[] = []
  while ((match = urlRegex.exec(markdown)) !== null) {
    const url = match[0].trim()
    // 确保URL不是已经在Markdown链接中找到的
    if (isValidUrl(url) && !markdownUrls.includes(url)) {
      plainUrls.push(url)
    }
  }

  return [...markdownUrls, ...plainUrls]
}

/**
 * 从网页获取内容
 * @param url 网页URL
 * @param format 返回格式
 * @param usingBrowser 是否使用浏览器
 * @returns 网页内容
 */
export async function fetchWebContent(
  url: string,
  format: ResponseFormat = 'markdown',
  usingBrowser: boolean = false
): Promise<WebSearchResult> {
  try {
    // Validate URL before attempting to fetch
    if (!isValidUrl(url)) {
      throw new Error(`Invalid URL format: ${url}`)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    let html: string
    if (usingBrowser) {
      // 使用SearchService打开URL
      const { searchService } = await import('./SearchService')
      html = await searchService.openUrlInSearchWindow(`search-window-${Date.now()}`, url)
    } else {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          // 添加Chrome 126特有的请求头
          'Sec-Ch-Ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        },
        signal: controller.signal
      })
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      html = await response.text()
    }

    clearTimeout(timeoutId) // Clear the timeout if fetch completes successfully

    // 使用JSDOM解析HTML
    const dom = new JSDOM(html)
    const doc = dom.window.document

    // 使用Readability提取主要内容
    const { Readability } = require('@mozilla/readability')
    const article = new Readability(doc).parse()

    switch (format) {
      case 'markdown': {
        const markdown = turndownService.turndown(article?.content || '')
        return {
          title: article?.title || url,
          url: url,
          content: markdown || noContent
        }
      }
      case 'html':
        return {
          title: article?.title || url,
          url: url,
          content: article?.content || noContent
        }
      case 'text':
        return {
          title: article?.title || url,
          url: url,
          content: article?.textContent || noContent
        }
    }
  } catch (e: unknown) {
    console.error(`Failed to fetch ${url}`, e)
    return {
      title: url,
      url: url,
      content: noContent
    }
  }
}
