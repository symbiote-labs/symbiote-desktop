import { nanoid } from '@reduxjs/toolkit'
import { WebSearchState } from '@renderer/store/websearch'
import { WebSearchProvider, WebSearchResponse, WebSearchResult } from '@renderer/types'
import { fetchWebContent, noContent } from '@renderer/utils/fetch'

// 定义分析结果类型
interface AnalyzedResult extends WebSearchResult {
  summary?: string // 内容摘要
  keywords?: string[] // 关键词
  relevanceScore?: number // 相关性评分
}

import BaseWebSearchProvider from './BaseWebSearchProvider'

export default class DeepSearchProvider extends BaseWebSearchProvider {
  // 定义默认的搜索引擎URLs
  private searchEngines = [
    { name: 'Baidu', url: 'https://www.baidu.com/s?wd=%s' },
    { name: 'Bing', url: 'https://cn.bing.com/search?q=%s&ensearch=1' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s&t=h_' },
    { name: 'Sogou', url: 'https://www.sogou.com/web?query=%s' },
    {
      name: 'SearX',
      url: 'https://searx.tiekoetter.com/search?q=%s&categories=general&language=auto&time_range=&safesearch=0&theme=simple'
    }
  ]

  // 分析模型配置
  private analyzeConfig = {
    enabled: true, // 是否启用预分析
    maxSummaryLength: 300, // 每个结果的摘要最大长度
    batchSize: 3 // 每批分析的结果数量
  }

  constructor(provider: WebSearchProvider) {
    super(provider)
    // 不再强制要求provider.url，因为我们有默认的搜索引擎
  }

  public async search(query: string, websearch: WebSearchState): Promise<WebSearchResponse> {
    try {
      if (!query.trim()) {
        throw new Error('Search query cannot be empty')
      }

      const cleanedQuery = query.split('\r\n')[1] ?? query
      console.log(`[DeepSearch] 开始多引擎并行搜索: ${cleanedQuery}`)

      // 存储所有搜索引擎的结果
      const allItems: Array<{ title: string; url: string; source: string }> = []

      // 并行搜索所有引擎
      const searchPromises = this.searchEngines.map(async (engine) => {
        try {
          const uid = `deep-search-${engine.name.toLowerCase()}-${nanoid()}`
          const url = engine.url.replace('%s', encodeURIComponent(cleanedQuery))

          console.log(`[DeepSearch] 使用${engine.name}搜索: ${url}`)

          // 使用搜索窗口获取搜索结果页面内容
          const content = await window.api.searchService.openUrlInSearchWindow(uid, url)

          // 解析搜索结果页面中的URL
          const searchItems = this.parseValidUrls(content)
          console.log(`[DeepSearch] ${engine.name}找到 ${searchItems.length} 个结果`)

          // 添加搜索引擎标记
          return searchItems.map((item) => ({
            ...item,
            source: engine.name
          }))
        } catch (engineError) {
          console.error(`[DeepSearch] ${engine.name}搜索失败:`, engineError)
          // 如果失败返回空数组
          return []
        }
      })

      // 如果用户在provider中指定了URL，也并行搜索
      if (this.provider.url) {
        searchPromises.push(
          (async () => {
            try {
              const uid = `deep-search-custom-${nanoid()}`
              const url = this.provider.url ? this.provider.url.replace('%s', encodeURIComponent(cleanedQuery)) : ''

              console.log(`[DeepSearch] 使用自定义搜索: ${url}`)

              // 使用搜索窗口获取搜索结果页面内容
              const content = await window.api.searchService.openUrlInSearchWindow(uid, url)

              // 解析搜索结果页面中的URL
              const searchItems = this.parseValidUrls(content)
              console.log(`[DeepSearch] 自定义搜索找到 ${searchItems.length} 个结果`)

              // 添加搜索引擎标记
              return searchItems.map((item) => ({
                ...item,
                source: '自定义'
              }))
            } catch (customError) {
              console.error('[DeepSearch] 自定义搜索失败:', customError)
              return []
            }
          })()
        )
      }

      // 等待所有搜索完成
      const searchResults = await Promise.all(searchPromises)

      // 合并所有搜索结果
      for (const results of searchResults) {
        allItems.push(...results)
      }

      console.log(`[DeepSearch] 总共找到 ${allItems.length} 个结果`)

      // 去重，使用URL作为唯一标识
      const uniqueUrls = new Set<string>()
      const uniqueItems = allItems.filter((item) => {
        if (uniqueUrls.has(item.url)) {
          return false
        }
        uniqueUrls.add(item.url)
        return true
      })

      console.log(`[DeepSearch] 去重后有 ${uniqueItems.length} 个结果`)

      // 过滤有效的URL，不限制数量
      const validItems = uniqueItems.filter((item) => item.url.startsWith('http') || item.url.startsWith('https'))

      console.log(`[DeepSearch] 过滤后有 ${validItems.length} 个有效结果`)

      // 第二步：抓取每个URL的内容
      const results = await this.fetchContentsWithDepth(validItems, websearch)

      // 如果启用了预分析，对结果进行分析
      let analyzedResults = results
      if (this.analyzeConfig.enabled) {
        analyzedResults = await this.analyzeResults(results, cleanedQuery)
      }

      // 在标题中添加搜索引擎来源和摘要
      const resultsWithSource = analyzedResults.map((result, index) => {
        if (index < validItems.length) {
          // 如果有摘要，在内容前面添加摘要
          let enhancedContent = result.content
          const summary = (result as AnalyzedResult).summary

          if (summary && summary !== enhancedContent.substring(0, summary.length)) {
            enhancedContent = `**摘要**: ${summary}\n\n---\n\n${enhancedContent}`
          }

          // 如果有关键词，在内容前面添加关键词
          const keywords = (result as AnalyzedResult).keywords
          if (keywords && keywords.length > 0) {
            enhancedContent = `**关键词**: ${keywords.join(', ')}\n\n${enhancedContent}`
          }

          return {
            ...result,
            title: `[${validItems[index].source}] ${result.title}`,
            content: enhancedContent
          }
        }
        return result
      })

      // 按相关性排序
      const sortedResults = [...resultsWithSource].sort((a, b) => {
        const scoreA = (a as AnalyzedResult).relevanceScore || 0
        const scoreB = (b as AnalyzedResult).relevanceScore || 0
        return scoreB - scoreA
      })

      return {
        query: query,
        results: sortedResults.filter((result) => result.content !== noContent)
      }
    } catch (error) {
      console.error('[DeepSearch] 搜索失败:', error)
      throw new Error(`DeepSearch failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 分析搜索结果，提取摘要和关键词
   * @param results 搜索结果
   * @param query 搜索查询
   * @returns 分析后的结果
   */
  private async analyzeResults(results: WebSearchResult[], query: string): Promise<AnalyzedResult[]> {
    console.log(`[DeepSearch] 开始分析 ${results.length} 个结果`)

    // 分批处理，避免处理过多内容
    const batchSize = this.analyzeConfig.batchSize
    const analyzedResults: AnalyzedResult[] = [...results] // 复制原始结果

    // 简单的分析逻辑：提取前几句作为摘要
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.content === noContent) continue

      try {
        // 提取摘要（简单实现，取前300个字符）
        const maxLength = this.analyzeConfig.maxSummaryLength
        let summary = result.content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

        if (summary.length > maxLength) {
          // 截取到最后一个完整的句子
          summary = summary.substring(0, maxLength)
          const lastPeriod = summary.lastIndexOf('.')
          if (lastPeriod > maxLength * 0.7) {
            // 至少要有总长度的70%
            summary = summary.substring(0, lastPeriod + 1)
          }
          summary += '...'
        }

        // 提取关键词（简单实现，基于查询词拆分）
        const keywords = query
          .split(/\s+/)
          .filter((word) => word.length > 2 && result.content.toLowerCase().includes(word.toLowerCase()))

        // 计算相关性评分（简单实现，基于关键词出现频率）
        let relevanceScore = 0
        if (keywords.length > 0) {
          const contentLower = result.content.toLowerCase()
          for (const word of keywords) {
            const wordLower = word.toLowerCase()
            // 计算关键词出现的次数
            let count = 0
            let pos = contentLower.indexOf(wordLower)
            while (pos !== -1) {
              count++
              pos = contentLower.indexOf(wordLower, pos + 1)
            }
            relevanceScore += count
          }
          // 标准化评分，范围为0-1
          relevanceScore = Math.min(1, relevanceScore / (contentLower.length / 100))
        }

        // 更新分析结果
        analyzedResults[i] = {
          ...analyzedResults[i],
          summary,
          keywords,
          relevanceScore
        }

        // 每处理一批打印一次日志
        if (i % batchSize === 0 || i === results.length - 1) {
          console.log(`[DeepSearch] 已分析 ${i + 1}/${results.length} 个结果`)
        }
      } catch (error) {
        console.error(`[DeepSearch] 分析结果 ${i} 失败:`, error)
      }
    }

    // 按相关性排序
    analyzedResults.sort((a, b) => {
      const scoreA = (a as AnalyzedResult).relevanceScore || 0
      const scoreB = (b as AnalyzedResult).relevanceScore || 0
      return scoreB - scoreA
    })

    console.log(`[DeepSearch] 完成分析 ${results.length} 个结果`)
    return analyzedResults
  }

  /**
   * 解析搜索结果页面中的URL
   * 默认实现，子类可以覆盖此方法以适应不同的搜索引擎
   */
  protected parseValidUrls(htmlContent: string): Array<{ title: string; url: string }> {
    const results: Array<{ title: string; url: string }> = []

    try {
      // 通用解析逻辑，查找所有链接
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, 'text/html')

      // 尝试解析Baidu搜索结果 - 使用多个选择器来获取更多结果
      const baiduResults = [
        ...doc.querySelectorAll('#content_left .result h3 a'),
        ...doc.querySelectorAll('#content_left .c-container h3 a'),
        ...doc.querySelectorAll('#content_left .c-container a.c-title'),
        ...doc.querySelectorAll('#content_left a[data-click]')
      ]

      // 尝试解析Bing搜索结果 - 使用多个选择器来获取更多结果
      const bingResults = [
        ...doc.querySelectorAll('.b_algo h2 a'),
        ...doc.querySelectorAll('.b_algo a.tilk'),
        ...doc.querySelectorAll('.b_algo a.b_title'),
        ...doc.querySelectorAll('.b_results a.b_restorLink')
      ]

      // 尝试解析DuckDuckGo搜索结果 - 使用多个选择器来获取更多结果
      // 注意：DuckDuckGo的DOM结构可能会变化，所以我们使用多种选择器
      const duckduckgoResults = [
        // 标准结果选择器
        ...doc.querySelectorAll('.result__a'), // 主要结果链接
        ...doc.querySelectorAll('.result__url'), // URL链接
        ...doc.querySelectorAll('.result__snippet a'), // 片段中的链接
        ...doc.querySelectorAll('.results_links_deep a'), // 深度链接

        // 新的选择器，适应可能的DOM变化
        ...doc.querySelectorAll('a.result__check'), // 可能的新结果链接
        ...doc.querySelectorAll('a.js-result-title-link'), // 可能的标题链接
        ...doc.querySelectorAll('article a'), // 文章中的链接
        ...doc.querySelectorAll('.nrn-react-div a'), // React渲染的链接

        // 通用选择器，捕获更多可能的结果
        ...doc.querySelectorAll('a[href*="http"]'), // 所有外部链接
        ...doc.querySelectorAll('a[data-testid]'), // 所有测试ID链接
        ...doc.querySelectorAll('.module a') // 模块中的链接
      ]

      // 尝试解析搜狗搜索结果 - 使用多个选择器来获取更多结果
      const sogouResults = [
        // 标准结果选择器
        ...doc.querySelectorAll('.vrwrap h3 a'), // 主要结果链接
        ...doc.querySelectorAll('.vr-title a'), // 标题链接
        ...doc.querySelectorAll('.citeurl a'), // 引用URL链接
        ...doc.querySelectorAll('.fz-mid a'), // 中间大小的链接
        ...doc.querySelectorAll('.vrTitle a'), // 另一种标题链接
        ...doc.querySelectorAll('.fb a'), // 可能的链接
        ...doc.querySelectorAll('.results a'), // 结果链接

        // 更多选择器，适应可能的DOM变化
        ...doc.querySelectorAll('.rb a'), // 右侧栏链接
        ...doc.querySelectorAll('.vr_list a'), // 列表链接
        ...doc.querySelectorAll('.vrResult a'), // 结果链接
        ...doc.querySelectorAll('.vr_tit_a'), // 标题链接
        ...doc.querySelectorAll('.vr_title a') // 另一种标题链接
      ]

      // 尝试解析SearX搜索结果 - 使用多个选择器来获取更多结果
      const searxResults = [
        // 标准结果选择器
        ...doc.querySelectorAll('.result h4 a'), // 主要结果链接
        ...doc.querySelectorAll('.result-content a'), // 结果内容中的链接
        ...doc.querySelectorAll('.result-url'), // URL链接
        ...doc.querySelectorAll('.result-header a'), // 结果头部链接
        ...doc.querySelectorAll('.result-link'), // 结果链接
        ...doc.querySelectorAll('.result a'), // 所有结果中的链接

        // 更多选择器，适应可能的DOM变化
        ...doc.querySelectorAll('.results a'), // 结果列表中的链接
        ...doc.querySelectorAll('article a'), // 文章中的链接
        ...doc.querySelectorAll('.url_wrapper a'), // URL包装器中的链接
        ...doc.querySelectorAll('.external-link') // 外部链接
      ]

      if (baiduResults.length > 0) {
        // 这是Baidu搜索结果页面
        console.log('[DeepSearch] 检测到Baidu搜索结果页面')

        // 使用Set去重
        const uniqueUrls = new Set<string>()

        baiduResults.forEach((link) => {
          try {
            const url = (link as HTMLAnchorElement).href
            const title = link.textContent || url

            // 过滤掉搜索引擎内部链接和重复链接
            if (
              url &&
              (url.startsWith('http') || url.startsWith('https')) &&
              !url.includes('google.com/search') &&
              !url.includes('bing.com/search') &&
              !url.includes('baidu.com/s?') &&
              !uniqueUrls.has(url)
            ) {
              uniqueUrls.add(url)
              results.push({
                title: title.trim() || url,
                url: url
              })
            }
          } catch (error) {
            // 忽略无效链接
          }
        })
      } else if (bingResults.length > 0) {
        // 这是Bing搜索结果页面
        console.log('[DeepSearch] 检测到Bing搜索结果页面')

        // 使用Set去重
        const uniqueUrls = new Set<string>()

        bingResults.forEach((link) => {
          try {
            const url = (link as HTMLAnchorElement).href
            const title = link.textContent || url

            // 过滤掉搜索引擎内部链接和重复链接
            if (
              url &&
              (url.startsWith('http') || url.startsWith('https')) &&
              !url.includes('google.com/search') &&
              !url.includes('bing.com/search') &&
              !url.includes('baidu.com/s?') &&
              !uniqueUrls.has(url)
            ) {
              uniqueUrls.add(url)
              results.push({
                title: title.trim() || url,
                url: url
              })
            }
          } catch (error) {
            // 忽略无效链接
          }
        })
      } else if (sogouResults.length > 0 || htmlContent.includes('sogou.com')) {
        // 这是搜狗搜索结果页面
        console.log('[DeepSearch] 检测到搜狗搜索结果页面')

        // 使用Set去重
        const uniqueUrls = new Set<string>()

        sogouResults.forEach((link) => {
          try {
            const url = (link as HTMLAnchorElement).href
            const title = link.textContent || url

            // 过滤掉搜索引擎内部链接和重复链接
            if (
              url &&
              (url.startsWith('http') || url.startsWith('https')) &&
              !url.includes('google.com/search') &&
              !url.includes('bing.com/search') &&
              !url.includes('baidu.com/s?') &&
              !url.includes('sogou.com/web') &&
              !url.includes('duckduckgo.com/?q=') &&
              !uniqueUrls.has(url)
            ) {
              uniqueUrls.add(url)
              results.push({
                title: title.trim() || url,
                url: url
              })
            }
          } catch (error) {
            // 忽略无效链接
          }
        })

        // 如果结果很少，尝试使用更通用的方法
        if (results.length < 10) {
          // 增加阈值
          console.log('[DeepSearch] 搜狗标准选择器找到的结果很少，尝试使用更通用的方法')

          // 获取所有链接
          const allLinks = doc.querySelectorAll('a')

          allLinks.forEach((link) => {
            try {
              const url = (link as HTMLAnchorElement).href
              const title = link.textContent || url

              // 更宽松的过滤条件
              if (
                url &&
                (url.startsWith('http') || url.startsWith('https')) &&
                !url.includes('sogou.com/web') &&
                !url.includes('javascript:') &&
                !url.includes('mailto:') &&
                !url.includes('tel:') &&
                !uniqueUrls.has(url) &&
                title.trim().length > 0
              ) {
                uniqueUrls.add(url)
                results.push({
                  title: title.trim() || url,
                  url: url
                })
              }
            } catch (error) {
              // 忽略无效链接
            }
          })
        }

        console.log(`[DeepSearch] 搜狗找到 ${results.length} 个结果`)
      } else if (searxResults.length > 0 || htmlContent.includes('searx.tiekoetter.com')) {
        // 这是SearX搜索结果页面
        console.log('[DeepSearch] 检测到SearX搜索结果页面')

        // 使用Set去重
        const uniqueUrls = new Set<string>()

        searxResults.forEach((link) => {
          try {
            const url = (link as HTMLAnchorElement).href
            const title = link.textContent || url

            // 过滤掉搜索引擎内部链接和重复链接
            if (
              url &&
              (url.startsWith('http') || url.startsWith('https')) &&
              !url.includes('google.com/search') &&
              !url.includes('bing.com/search') &&
              !url.includes('baidu.com/s?') &&
              !url.includes('sogou.com/web') &&
              !url.includes('duckduckgo.com/?q=') &&
              !url.includes('searx.tiekoetter.com/search') &&
              !uniqueUrls.has(url)
            ) {
              uniqueUrls.add(url)
              results.push({
                title: title.trim() || url,
                url: url
              })
            }
          } catch (error) {
            // 忽略无效链接
          }
        })

        // 如果结果很少，尝试使用更通用的方法
        if (results.length < 10) {
          console.log('[DeepSearch] SearX标准选择器找到的结果很少，尝试使用更通用的方法')

          // 获取所有链接
          const allLinks = doc.querySelectorAll('a')

          allLinks.forEach((link) => {
            try {
              const url = (link as HTMLAnchorElement).href
              const title = link.textContent || url

              // 更宽松的过滤条件
              if (
                url &&
                (url.startsWith('http') || url.startsWith('https')) &&
                !url.includes('searx.tiekoetter.com/search') &&
                !url.includes('javascript:') &&
                !url.includes('mailto:') &&
                !url.includes('tel:') &&
                !uniqueUrls.has(url) &&
                title.trim().length > 0
              ) {
                uniqueUrls.add(url)
                results.push({
                  title: title.trim() || url,
                  url: url
                })
              }
            } catch (error) {
              // 忽略无效链接
            }
          })
        }

        console.log(`[DeepSearch] SearX找到 ${results.length} 个结果`)
      } else if (duckduckgoResults.length > 0 || htmlContent.includes('duckduckgo.com')) {
        // 这是DuckDuckGo搜索结果页面
        console.log('[DeepSearch] 检测到DuckDuckGo搜索结果页面')

        // 使用Set去重
        const uniqueUrls = new Set<string>()

        // 如果标准选择器没有找到结果，尝试使用更通用的方法
        if (duckduckgoResults.length < 10) {
          // 增加阈值
          console.log('[DeepSearch] DuckDuckGo标准选择器找到的结果很少，尝试使用更通用的方法')

          // 获取所有链接
          const allLinks = doc.querySelectorAll('a')

          allLinks.forEach((link) => {
            try {
              const url = (link as HTMLAnchorElement).href
              const title = link.textContent || url

              // 更宽松的过滤条件，为DuckDuckGo特别定制
              if (
                url &&
                (url.startsWith('http') || url.startsWith('https')) &&
                !url.includes('duckduckgo.com') &&
                !url.includes('google.com/search') &&
                !url.includes('bing.com/search') &&
                !url.includes('baidu.com/s?') &&
                !url.includes('javascript:') &&
                !url.includes('mailto:') &&
                !url.includes('tel:') &&
                !url.includes('about:') &&
                !url.includes('chrome:') &&
                !url.includes('file:') &&
                !url.includes('login') &&
                !url.includes('signup') &&
                !url.includes('account') &&
                !uniqueUrls.has(url) &&
                title.trim().length > 0
              ) {
                uniqueUrls.add(url)
                results.push({
                  title: title.trim() || url,
                  url: url
                })
              }
            } catch (error) {
              // 忽略无效链接
            }
          })
        } else {
          // 使用标准选择器找到的结果
          duckduckgoResults.forEach((link) => {
            try {
              const url = (link as HTMLAnchorElement).href
              const title = link.textContent || url

              // 过滤掉搜索引擎内部链接和重复链接
              if (
                url &&
                (url.startsWith('http') || url.startsWith('https')) &&
                !url.includes('google.com/search') &&
                !url.includes('bing.com/search') &&
                !url.includes('baidu.com/s?') &&
                !url.includes('duckduckgo.com/?q=') &&
                !uniqueUrls.has(url)
              ) {
                uniqueUrls.add(url)
                results.push({
                  title: title.trim() || url,
                  url: url
                })
              }
            } catch (error) {
              // 忽略无效链接
            }
          })
        }

        // 如果结果仍然很少，尝试使用更激进的方法
        if (results.length < 10 && htmlContent.includes('duckduckgo.com')) {
          // 增加阈值
          console.log('[DeepSearch] DuckDuckGo结果仍然很少，尝试提取所有可能的URL')

          // 从整个HTML中提取URL
          const urlRegex = /https?:\/\/[^\s"'<>()]+/g
          let match: RegExpExecArray | null

          while ((match = urlRegex.exec(htmlContent)) !== null) {
            const url = match[0]

            // 过滤掉搜索引擎内部URL和重复链接
            if (
              !url.includes('duckduckgo.com') &&
              !url.includes('google.com/search') &&
              !url.includes('bing.com/search') &&
              !url.includes('baidu.com/s?') &&
              !url.includes('sogou.com/web') &&
              !url.includes('searx.tiekoetter.com/search') &&
              !uniqueUrls.has(url)
            ) {
              uniqueUrls.add(url)
              results.push({
                title: url,
                url: url
              })
            }
          }
        }

        console.log(`[DeepSearch] DuckDuckGo找到 ${results.length} 个结果`)
      } else {
        // 如果不能识别搜索引擎，尝试通用解析
        console.log('[DeepSearch] 使用通用解析方法')

        // 查找所有链接
        const links = doc.querySelectorAll('a')
        const uniqueUrls = new Set<string>()

        links.forEach((link) => {
          try {
            const url = (link as HTMLAnchorElement).href
            const title = link.textContent || url

            // 过滤掉无效链接和搜索引擎内部链接
            if (
              url &&
              (url.startsWith('http') || url.startsWith('https')) &&
              !url.includes('google.com/search') &&
              !url.includes('bing.com/search') &&
              !url.includes('baidu.com/s?') &&
              !url.includes('duckduckgo.com/?q=') &&
              !url.includes('sogou.com/web') &&
              !url.includes('searx.tiekoetter.com/search') &&
              !uniqueUrls.has(url) &&
              // 过滤掉常见的无用链接
              !url.includes('javascript:') &&
              !url.includes('mailto:') &&
              !url.includes('tel:') &&
              !url.includes('login') &&
              !url.includes('register') &&
              !url.includes('signup') &&
              !url.includes('signin') &&
              title.trim().length > 0
            ) {
              uniqueUrls.add(url)
              results.push({
                title: title.trim(),
                url: url
              })
            }
          } catch (error) {
            // 忽略无效链接
          }
        })
      }

      console.log(`[DeepSearch] 解析到 ${results.length} 个有效链接`)
    } catch (error) {
      console.error('[DeepSearch] 解析HTML失败:', error)
    }

    return results
  }

  /**
   * 深度抓取内容
   * 不仅抓取搜索结果页面，还会抓取页面中的链接
   */
  private async fetchContentsWithDepth(
    items: Array<{ title: string; url: string; source?: string }>,
    _websearch: WebSearchState,
    depth: number = 1
  ): Promise<WebSearchResult[]> {
    console.log(`[DeepSearch] 开始并行深度抓取，深度: ${depth}`)

    // 第一层：并行抓取初始URL的内容
    const firstLevelResults = await Promise.all(
      items.map(async (item) => {
        console.log(`[DeepSearch] 抓取页面: ${item.url}`)
        try {
          const result = await fetchWebContent(item.url, 'markdown', this.provider.usingBrowser)

          // 应用内容长度限制
          if (
            this.provider.contentLimit &&
            this.provider.contentLimit !== -1 &&
            result.content.length > this.provider.contentLimit
          ) {
            result.content = result.content.slice(0, this.provider.contentLimit) + '...'
          }

          // 添加来源信息
          if (item.source) {
            result.source = item.source
          }

          return result
        } catch (error) {
          console.error(`[DeepSearch] 抓取 ${item.url} 失败:`, error)
          return {
            title: item.title,
            content: noContent,
            url: item.url,
            source: item.source
          }
        }
      })
    )

    // 如果深度为1，直接返回第一层结果
    if (depth <= 1) {
      return firstLevelResults
    }

    // 第二层：从第一层内容中提取链接并抓取
    const secondLevelUrls: Set<string> = new Set()

    // 从第一层结果中提取链接
    firstLevelResults.forEach((result) => {
      if (result.content !== noContent) {
        // 从Markdown内容中提取URL
        const urls = this.extractUrlsFromMarkdown(result.content)
        urls.forEach((url) => secondLevelUrls.add(url))
      }
    })

    // 不限制第二层URL数量，获取更多结果
    const maxSecondLevelUrls = Math.min(secondLevelUrls.size, 30) // 增加到30个
    const secondLevelUrlsArray = Array.from(secondLevelUrls).slice(0, maxSecondLevelUrls)

    console.log(`[DeepSearch] 第二层找到 ${secondLevelUrls.size} 个URL，将抓取 ${secondLevelUrlsArray.length} 个`)

    // 抓取第二层URL的内容
    const secondLevelItems = secondLevelUrlsArray.map((url) => ({
      title: url,
      url: url,
      source: '深度链接' // 标记为深度链接
    }))

    const secondLevelResults = await Promise.all(
      secondLevelItems.map(async (item) => {
        console.log(`[DeepSearch] 抓取第二层页面: ${item.url}`)
        try {
          const result = await fetchWebContent(item.url, 'markdown', this.provider.usingBrowser)

          // 应用内容长度限制
          if (
            this.provider.contentLimit &&
            this.provider.contentLimit !== -1 &&
            result.content.length > this.provider.contentLimit
          ) {
            result.content = result.content.slice(0, this.provider.contentLimit) + '...'
          }

          // 标记为第二层结果
          result.title = `[深度] ${result.title}`
          result.source = item.source

          return result
        } catch (error) {
          console.error(`[DeepSearch] 抓取第二层 ${item.url} 失败:`, error)
          return {
            title: `[深度] ${item.title}`,
            content: noContent,
            url: item.url,
            source: item.source
          }
        }
      })
    )

    // 合并两层结果
    return [...firstLevelResults, ...secondLevelResults.filter((result) => result.content !== noContent)]
  }

  /**
   * 从Markdown内容中提取URL
   */
  private extractUrlsFromMarkdown(markdown: string): string[] {
    const urls: Set<string> = new Set()

    // 匹配Markdown链接格式 [text](url)
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let match: RegExpExecArray | null

    while ((match = markdownLinkRegex.exec(markdown)) !== null) {
      const url = match[2]
      if (url && (url.startsWith('http') || url.startsWith('https'))) {
        urls.add(url)
      }
    }

    // 匹配纯文本URL
    const urlRegex = /(https?:\/\/[^\s]+)/g
    while ((match = urlRegex.exec(markdown)) !== null) {
      const url = match[1]
      if (url) {
        urls.add(url)
      }
    }

    return Array.from(urls)
  }
}
