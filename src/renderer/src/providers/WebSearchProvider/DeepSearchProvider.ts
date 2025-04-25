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
  // 存储搜索过程中打开的浏览器窗口ID
  private searchWindowIds: string[] = []

  // 定义默认的搜索引擎URLs
  private searchEngines = [
    // 中文搜索引擎
    { name: 'Baidu', url: 'https://www.baidu.com/s?wd=%s', category: 'chinese' },
    { name: 'Sogou', url: 'https://www.sogou.com/web?query=%s', category: 'chinese' },
    { name: '360', url: 'https://www.so.com/s?q=%s', category: 'chinese' },
    { name: 'Yisou', url: 'https://yisou.com/search?q=%s', category: 'chinese' },
    { name: 'Toutiao', url: 'https://so.toutiao.com/search?keyword=%s', category: 'chinese' },
    { name: 'Zhihu', url: 'https://www.zhihu.com/search?type=content&q=%s', category: 'chinese' },

    // 国际搜索引擎
    { name: 'Bing', url: 'https://cn.bing.com/search?q=%s&ensearch=1', category: 'international' },
    { name: 'Google', url: 'https://www.google.com/search?q=%s', category: 'international' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s&t=h_', category: 'international' },
    { name: 'Brave', url: 'https://search.brave.com/search?q=%s', category: 'international' },
    { name: 'Qwant', url: 'https://www.qwant.com/?q=%s', category: 'international' },
    { name: 'Yahoo', url: 'https://search.yahoo.com/search?p=%s', category: 'international' },

    // 元搜索引擎
    {
      name: 'SearX',
      url: 'https://searx.tiekoetter.com/search?q=%s&categories=general&language=auto',
      category: 'meta'
    },
    { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=%s', category: 'meta' },
    { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=%s', category: 'meta' },
    { name: 'Mojeek', url: 'https://www.mojeek.com/search?q=%s', category: 'meta' },
    { name: 'Yandex', url: 'https://yandex.com/search/?text=%s', category: 'meta' },
    { name: 'Presearch', url: 'https://presearch.com/search?q=%s', category: 'meta' },

    // 学术搜索引擎
    { name: 'Scholar', url: 'https://scholar.google.com/scholar?q=%s', category: 'academic' },
    { name: 'Semantic', url: 'https://www.semanticscholar.org/search?q=%s', category: 'academic' },
    { name: 'BASE', url: 'https://www.base-search.net/Search/Results?lookfor=%s', category: 'academic' },

    { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=%s', category: 'academic' },
    { name: 'ScienceDirect', url: 'https://www.sciencedirect.com/search?qs=%s', category: 'academic' },
    { name: 'ResearchGate', url: 'https://www.researchgate.net/search/publication?q=%s', category: 'academic' },
    { name: 'JSTOR', url: 'https://www.jstor.org/action/doBasicSearch?Query=%s', category: 'academic' },

    // 技术搜索引擎
    { name: 'GitHub', url: 'https://github.com/search?q=%s', category: 'tech' },
    { name: 'StackOverflow', url: 'https://stackoverflow.com/search?q=%s', category: 'tech' },
    { name: 'DevDocs', url: 'https://devdocs.io/#q=%s', category: 'tech' },
    { name: 'MDN', url: 'https://developer.mozilla.org/search?q=%s', category: 'tech' },
    { name: 'NPM', url: 'https://www.npmjs.com/search?q=%s', category: 'tech' },
    { name: 'PyPI', url: 'https://pypi.org/search/?q=%s', category: 'tech' },

    // 新闻搜索引擎
    { name: 'GoogleNews', url: 'https://news.google.com/search?q=%s', category: 'news' },
    { name: 'Reuters', url: 'https://www.reuters.com/search/news?blob=%s', category: 'news' },
    { name: 'BBC', url: 'https://www.bbc.co.uk/search?q=%s&page=1', category: 'news' },
    { name: 'Xinhua', url: 'http://so.news.cn/getNews?keyword=%s', category: 'news' },
    { name: 'CCTV', url: 'https://search.cctv.com/search.php?qtext=%s', category: 'news' },

    // 专业领域搜索引擎
    { name: 'Arxiv', url: 'https://arxiv.org/search/?query=%s&searchtype=all', category: 'professional' },
    {
      name: 'USPTO',
      url: 'https://patft.uspto.gov/netacgi/nph-Parser?Sect1=PTO2&Sect2=HITOFF&p=1&u=%2Fnetahtml%2FPTO%2Fsearch-bool.html&r=0&f=S&l=50&TERM1=%s',
      category: 'professional'
    },
    { name: 'WolframAlpha', url: 'https://www.wolframalpha.com/input/?i=%s', category: 'professional' },
    { name: 'Coursera', url: 'https://www.coursera.org/search?query=%s', category: 'professional' },
    { name: 'Khan', url: 'https://www.khanacademy.org/search?page_search_query=%s', category: 'professional' }
  ]

  // 定义URL过滤规则
  private urlFilters = {
    // 排除的域名（增强版）
    excludedDomains: [
      // 账户相关
      'login',
      'signin',
      'signup',
      'register',
      'account',
      'checkout',

      // 广告相关
      'ads',
      'ad.',
      'adv.',
      'advertisement',
      'sponsor',
      'tracking',
      'promotion',
      'marketing',
      'banner',
      'popup',

      // 购物相关
      'cart',
      'shop',
      'store',
      'buy',
      'price',
      'deal',
      'coupon',
      'discount',

      // 社交媒体评论区
      'comment',
      'comments',
      'forum',
      'bbs'
    ],
    // 优先的域名（相关性更高）
    priorityDomains: [
      'github.com/augment',
      'augmentcode.com',
      'augment.dev',
      'github.com',
      'stackoverflow.com',
      'dev.to',
      'medium.com',
      'docs.github.com',
      'npmjs.com',
      'pypi.org',
      'microsoft.com/en-us/learn',
      'developer.mozilla.org',
      'w3schools.com',
      'reactjs.org',
      'vuejs.org',
      'angular.io',
      'tensorflow.org',
      'pytorch.org',
      'kubernetes.io',
      'docker.com',
      'aws.amazon.com/documentation',
      'cloud.google.com/docs',
      'azure.microsoft.com/en-us/documentation'
    ],
    // 排除的文件类型
    excludedFileTypes: [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.bmp',
      '.svg',
      '.webp',
      '.mp3',
      '.mp4',
      '.avi',
      '.mov',
      '.wmv',
      '.flv',
      '.wav',
      '.ogg',
      '.zip',
      '.rar',
      '.7z',
      '.tar',
      '.gz',
      '.exe',
      '.dmg',
      '.apk',
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx'
    ]
  }

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

  public async search(query: string, websearch: WebSearchState, engineCategory?: string): Promise<WebSearchResponse> {
    try {
      if (!query.trim()) {
        throw new Error('Search query cannot be empty')
      }

      const cleanedQuery = query.split('\r\n')[1] ?? query
      console.log(`[DeepSearch] 开始多引擎并行搜索: ${cleanedQuery}`)

      // 存储所有搜索引擎的结果
      const allItems: Array<{ title: string; url: string; source: string }> = []

      // 根据类别筛选搜索引擎
      let enginesToUse = this.searchEngines

      // 如果是 DeepResearch 调用（指定了类别），则按类别筛选搜索引擎
      if (engineCategory) {
        enginesToUse = this.searchEngines.filter((engine) => engine.category === engineCategory)
        // 如果该类别没有搜索引擎，则使用所有搜索引擎
        if (enginesToUse.length === 0) {
          enginesToUse = this.searchEngines
        }
      }
      // 如果是普通 DeepSearch 调用（没有指定类别），则根据用户配置筛选搜索引擎
      else if (websearch.deepSearchConfig?.enabledEngines) {
        const enabledEngines = websearch.deepSearchConfig.enabledEngines
        enginesToUse = this.searchEngines.filter((engine) => {
          // 使用白名单模式：只使用明确启用的搜索引擎
          // 中文搜索引擎
          if (engine.name === 'Baidu') return enabledEngines.baidu === true
          if (engine.name === 'Sogou') return enabledEngines.sogou === true
          if (engine.name === '360') return enabledEngines['360'] === true
          if (engine.name === 'Yisou') return enabledEngines.yisou === true
          if (engine.name === 'Toutiao') return enabledEngines.toutiao === true
          if (engine.name === 'Zhihu') return enabledEngines.zhihu === true

          // 国际搜索引擎
          if (engine.name === 'Bing') return enabledEngines.bing === true
          if (engine.name === 'Google') return enabledEngines.google === true
          if (engine.name === 'DuckDuckGo') return enabledEngines.duckduckgo === true
          if (engine.name === 'Brave') return enabledEngines.brave === true
          if (engine.name === 'Qwant') return enabledEngines.qwant === true
          if (engine.name === 'Yahoo') return enabledEngines.yahoo === true

          // 元搜索引擎
          if (engine.name === 'SearX') return enabledEngines.searx === true
          if (engine.name === 'Ecosia') return enabledEngines.ecosia === true
          if (engine.name === 'Startpage') return enabledEngines.startpage === true
          if (engine.name === 'Mojeek') return enabledEngines.mojeek === true
          if (engine.name === 'Yandex') return enabledEngines.yandex === true
          if (engine.name === 'Presearch') return enabledEngines.presearch === true

          // 学术搜索引擎
          if (engine.name === 'Scholar') return enabledEngines.scholar === true
          if (engine.name === 'Semantic') return enabledEngines.semantic === true
          if (engine.name === 'BASE') return enabledEngines.base === true
          if (engine.name === 'PubMed') return enabledEngines.pubmed === true
          if (engine.name === 'ScienceDirect') return enabledEngines.sciencedirect === true
          if (engine.name === 'ResearchGate') return enabledEngines.researchgate === true
          if (engine.name === 'JSTOR') return enabledEngines.jstor === true

          // 技术搜索引擎
          if (engine.name === 'GitHub') return enabledEngines.github === true
          if (engine.name === 'StackOverflow') return enabledEngines.stackoverflow === true
          if (engine.name === 'DevDocs') return enabledEngines.devdocs === true
          if (engine.name === 'MDN') return enabledEngines.mdn === true
          if (engine.name === 'NPM') return enabledEngines.npm === true
          if (engine.name === 'PyPI') return enabledEngines.pypi === true

          // 新闻搜索引擎
          if (engine.name === 'GoogleNews') return enabledEngines.googlenews === true
          if (engine.name === 'Reuters') return enabledEngines.reuters === true
          if (engine.name === 'BBC') return enabledEngines.bbc === true
          if (engine.name === 'Xinhua') return enabledEngines.xinhua === true
          if (engine.name === 'CCTV') return enabledEngines.cctv === true

          // 专业领域搜索引擎
          if (engine.name === 'Arxiv') return enabledEngines.arxiv === true
          if (engine.name === 'USPTO') return enabledEngines.uspto === true
          if (engine.name === 'WolframAlpha') return enabledEngines.wolframalpha === true
          if (engine.name === 'Coursera') return enabledEngines.coursera === true
          if (engine.name === 'Khan') return enabledEngines.khan === true

          // 如果是未知的搜索引擎，默认不使用
          return false
        })

        // 如果没有启用任何搜索引擎，则至少使用百度
        if (enginesToUse.length === 0) {
          enginesToUse = this.searchEngines.filter((engine) => engine.name === 'Baidu')
        }
      }

      // 记录启用的搜索引擎名称，方便调试
      const enabledEngineNames = enginesToUse.map((engine) => engine.name)
      console.log(
        `[DeepSearch] 使用${engineCategory || '所有'}类别的搜索引擎，共 ${enginesToUse.length} 个: ${enabledEngineNames.join(', ')}`
      )

      // 并行搜索选定的引擎
      const searchPromises = enginesToUse.map(async (engine) => {
        try {
          const uid = `deep-search-${engine.name.toLowerCase()}-${nanoid()}`
          const url = engine.url.replace('%s', encodeURIComponent(cleanedQuery))

          console.log(`[DeepSearch] 使用${engine.name}搜索: ${url}`)

          // 使用搜索窗口获取搜索结果页面内容
          const content = await window.api.searchService.openUrlInSearchWindow(uid, url)

          // 记录窗口ID，以便后续清理
          if (!this.searchWindowIds.includes(uid)) {
            this.searchWindowIds.push(uid)
            console.log(`[DeepSearch] 跟踪搜索窗口: ${uid}，当前共 ${this.searchWindowIds.length} 个窗口`)
          }

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

      // 清理搜索窗口
      await this.cleanupSearchWindows()

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
   * 清理所有打开的搜索窗口
   */
  private async cleanupSearchWindows(): Promise<void> {
    console.log(`[DeepSearch] 开始清理 ${this.searchWindowIds.length} 个搜索窗口`)

    const closePromises = this.searchWindowIds.map(async (windowId) => {
      try {
        await window.api.searchService.closeSearchWindow(windowId)
        console.log(`[DeepSearch] 已关闭搜索窗口: ${windowId}`)
      } catch (error) {
        console.error(`[DeepSearch] 关闭搜索窗口 ${windowId} 失败:`, error)
      }
    })

    await Promise.all(closePromises)

    // 清空窗口ID列表
    this.searchWindowIds = []
    console.log('[DeepSearch] 所有搜索窗口已清理')
  }

  /**
   * 检测内容是否包含乱码或无意义内容
   * @param content 要检测的内容
   * @returns 如果包含乱码或无意义内容返回true，否则返回false
   */
  private containsGarbage(content: string): boolean {
    if (!content) return true

    // 检测内容长度
    if (content.length < 50) return true // 内容过短

    // 检测乱码字符比例
    // 使用安全的方式检测乱码字符
    // 手动检测不可打印字符而不使用正则表达式
    let nonReadableCharsCount = 0
    for (let i = 0; i < content.length; i++) {
      const charCode = content.charCodeAt(i)
      // 检测控制字符和特殊字符
      if (
        (charCode >= 0 && charCode <= 8) ||
        charCode === 11 ||
        charCode === 12 ||
        (charCode >= 14 && charCode <= 31) ||
        (charCode >= 127 && charCode <= 159) ||
        charCode === 0xfffd ||
        charCode === 0xfffe ||
        charCode === 0xffff
      ) {
        nonReadableCharsCount++
      }
    }
    if (nonReadableCharsCount > content.length * 0.05) {
      return true // 乱码字符超过5%
    }

    // 检测重复模式
    const repeatedPatterns = content.match(/(.{10,})\1{3,}/g)
    if (repeatedPatterns && repeatedPatterns.length > 0) {
      return true // 存在多次重复的长模式
    }

    // 检测广告关键词
    const adKeywords = [
      'advertisement',
      'sponsored',
      'promotion',
      'discount',
      'sale',
      'buy now',
      'limited time',
      'special offer',
      'click here',
      'best price',
      'free shipping',
      '广告',
      '促销',
      '特惠',
      '打折',
      '限时',
      '点击购买',
      '立即购买'
    ]

    const contentLower = content.toLowerCase()
    const adKeywordCount = adKeywords.filter((keyword) => contentLower.includes(keyword)).length

    if (adKeywordCount >= 3) {
      return true // 包含多个广告关键词
    }

    // 检测内容多样性（字符类型比例）
    const letters = content.match(/[a-zA-Z]/g)?.length || 0
    const digits = content.match(/\d/g)?.length || 0
    const spaces = content.match(/\s/g)?.length || 0
    const punctuation = content.match(/[.,;:!?]/g)?.length || 0

    // 如果内容几乎只有一种字符类型，可能是乱码
    const totalChars = content.length
    const mainCharType = Math.max(letters, digits, spaces, punctuation)

    if (mainCharType / totalChars > 0.9) {
      return true // 单一字符类型超过90%
    }

    return false
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

    // 预处理查询，提取重要关键词
    const queryWords = query.toLowerCase().split(/\s+/)

    // 过滤掉常见的停用词
    const stopWords = new Set([
      'a',
      'an',
      'the',
      'and',
      'or',
      'but',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'in',
      'on',
      'at',
      'to',
      'for',
      'with',
      'by',
      'about',
      'against',
      'between',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'from',
      'up',
      'down',
      'of',
      'off',
      'over',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'any',
      'both',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'can',
      'will',
      'just',
      'should',
      'now'
    ])

    // 提取重要关键词，并为每个词分配权重
    const keywordWeights = new Map<string, number>()
    queryWords.forEach((word, index) => {
      if (word.length > 2 && !stopWords.has(word)) {
        // 根据词的位置分配权重，前面的词权重更高
        const positionWeight = 1 - (index / queryWords.length) * 0.5 // 位置权重范围：0.5-1.0
        // 根据词的长度分配权重，更长的词权重更高
        const lengthWeight = Math.min(1, word.length / 10) // 长度权重最高为1
        // 组合权重
        const weight = positionWeight * 0.7 + lengthWeight * 0.3
        keywordWeights.set(word, weight)
      }
    })

    // 如果没有提取到关键词，使用原始查询词
    if (keywordWeights.size === 0) {
      queryWords.forEach((word) => {
        if (word.length > 2) {
          keywordWeights.set(word, 1.0)
        }
      })
    }

    // 分析每个结果
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.content === noContent) continue

      try {
        // 提取摘要（改进实现，尝试找到包含关键词的最相关段落）
        const maxLength = this.analyzeConfig.maxSummaryLength
        const content = result.content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()

        // 将内容分成句子
        const sentences = content.split(/(?<=[.!?])\s+/)

        // 为每个句子评分
        const sentenceScores = sentences.map((sentence) => {
          const sentenceLower = sentence.toLowerCase()
          let score = 0

          // 根据句子中包含的关键词计算分数
          for (const [keyword, weight] of keywordWeights.entries()) {
            if (sentenceLower.includes(keyword)) {
              score += weight

              // 如果关键词在句子开头，给予额外加分
              if (sentenceLower.indexOf(keyword) < 20) {
                score += weight * 0.5
              }
            }
          }

          return { sentence, score }
        })

        // 按分数排序句子
        sentenceScores.sort((a, b) => b.score - a.score)

        // 选择最相关的句子作为摘要
        let summary = ''
        let currentLength = 0

        // 首先添加得分最高的句子
        if (sentenceScores.length > 0 && sentenceScores[0].score > 0) {
          summary = sentenceScores[0].sentence
          currentLength = summary.length
        }

        // 如果还有空间，添加更多相关句子
        for (let j = 1; j < sentenceScores.length && currentLength < maxLength; j++) {
          if (sentenceScores[j].score > 0) {
            const nextSentence = sentenceScores[j].sentence
            if (currentLength + nextSentence.length + 1 <= maxLength) {
              summary += ' ' + nextSentence
              currentLength += nextSentence.length + 1
            }
          }
        }

        // 如果没有找到相关句子，回退到简单摘要提取
        if (summary.length === 0) {
          summary = content.substring(0, maxLength)
          const lastPeriod = summary.lastIndexOf('.')
          if (lastPeriod > maxLength * 0.7) {
            summary = summary.substring(0, lastPeriod + 1)
          }
          summary += '...'
        } else if (summary.length < content.length) {
          summary += '...'
        }

        // 提取关键词（改进实现）
        const contentLower = result.content.toLowerCase()
        const keywordScores = new Map<string, number>()

        // 从内容中提取潜在关键词
        const contentWords = contentLower.split(/\W+/).filter((word) => word.length > 3 && !stopWords.has(word))

        // 计算词频
        const wordFrequency = new Map<string, number>()
        contentWords.forEach((word) => {
          wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1)
        })

        // 为每个词评分
        for (const [word, freq] of wordFrequency.entries()) {
          // 基础分数是词频
          let score = freq

          // 如果是查询关键词，增加分数
          if (keywordWeights.has(word)) {
            score += freq * keywordWeights.get(word)! * 3
          }

          // 如果在标题中出现，增加分数
          if (result.title.toLowerCase().includes(word)) {
            score += 5
          }

          keywordScores.set(word, score)
        }

        // 添加查询关键词（如果内容中包含）
        for (const [keyword, weight] of keywordWeights.entries()) {
          if (contentLower.includes(keyword) && !keywordScores.has(keyword)) {
            keywordScores.set(keyword, weight * 3)
          }
        }

        // 选择得分最高的关键词
        const sortedKeywords = Array.from(keywordScores.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map((entry) => entry[0])

        // 计算相关性评分（改进实现）
        let relevanceScore = 0

        // 1. 基于关键词匹配度的评分
        let keywordMatchScore = 0

        for (const [keyword, weight] of keywordWeights.entries()) {
          // 计算关键词出现的次数
          let count = 0
          let pos = contentLower.indexOf(keyword)
          while (pos !== -1) {
            count++
            pos = contentLower.indexOf(keyword, pos + 1)
          }

          if (count > 0) {
            // 权重 * 出现次数 * 归一化因子
            keywordMatchScore += (weight * Math.min(10, count)) / 10
          }
        }

        // 归一化关键词匹配分数
        if (keywordWeights.size > 0) {
          keywordMatchScore = keywordMatchScore / keywordWeights.size
        }

        // 2. 基于标题相关性的评分
        let titleScore = 0
        const titleLower = result.title.toLowerCase()

        for (const [keyword, weight] of keywordWeights.entries()) {
          if (titleLower.includes(keyword)) {
            titleScore += weight
          }
        }

        // 归一化标题分数
        if (keywordWeights.size > 0) {
          titleScore = titleScore / keywordWeights.size
        }

        // 3. 基于内容长度的评分（适中长度最佳）
        const contentLength = result.content.length
        const lengthScore = Math.min(1, contentLength / 2000) * (contentLength < 50000 ? 1 : 0.5)

        // 4. 基于URL的评分（官方网站、知名网站加分）
        let urlScore = 0
        const url = result.url.toLowerCase()

        // 首先检查是否有预先计算的优先级分数
        if (result.meta && result.meta.priorityScore) {
          // 使用预先计算的分数
          urlScore = result.meta.priorityScore
        } else {
          // 如果没有预先计算的分数，使用基于域名的评分
          // 检查是否是官方网站或知名网站
          if (url.includes('github.com/augment') || url.includes('augmentcode.com') || url.includes('augment.dev')) {
            urlScore = 1.0 // 官方网站最高分
          } else if (
            url.includes('github.com') ||
            url.includes('stackoverflow.com') ||
            url.includes('medium.com') ||
            url.includes('dev.to')
          ) {
            urlScore = 0.8 // 知名技术网站高分
          } else if (!url.includes('login') && !url.includes('signup') && !url.includes('register')) {
            urlScore = 0.5 // 普通网站中等分
          }
        }

        // 组合所有评分因素，调整权重以提高URL质量的重要性
        relevanceScore =
          keywordMatchScore * 0.4 + // 关键词匹配度占40%
          titleScore * 0.3 + // 标题相关性占30%
          lengthScore * 0.05 + // 内容长度占5%
          urlScore * 0.25 // URL质量占25%，增加了权重

        // 确保分数在0-1范围内
        relevanceScore = Math.min(1, Math.max(0, relevanceScore))

        // 更新分析结果
        analyzedResults[i] = {
          ...analyzedResults[i],
          summary,
          keywords: sortedKeywords,
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

    // 过滤掉明显不相关的结果和乱码内容
    const filteredResults = analyzedResults.filter((result) => {
      // 检查相关性分数
      const score = (result as AnalyzedResult).relevanceScore || 0
      if (score <= 0.05) return false // 相关性分数过低

      // 检查是否包含乱码或广告
      if (this.containsGarbage(result.content)) {
        console.log(`[DeepSearch] 过滤乱码或广告内容: ${result.title}`)
        return false
      }

      return true
    })

    console.log(`[DeepSearch] 完成分析 ${results.length} 个结果，过滤后剩余 ${filteredResults.length} 个结果`)
    return filteredResults
  }

  /**
   * 解析搜索结果页面中的URL
   * 默认实现，子类可以覆盖此方法以适应不同的搜索引擎
   */
  protected parseValidUrls(htmlContent: string): Array<{ title: string; url: string; meta?: Record<string, any> }> {
    const results: Array<{ title: string; url: string; meta?: Record<string, any> }> = []

    try {
      // 通用解析逻辑，查找所有链接
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, 'text/html')

      // 尝试解析Baidu搜索结果 - 使用多个选择器来获取更多结果
      const baiduResults = [
        ...doc.querySelectorAll('#content_left .result h3 a'),
        ...doc.querySelectorAll('#content_left .c-container h3 a'),
        ...doc.querySelectorAll('#content_left .c-container a.c-title'),
        ...doc.querySelectorAll('#content_left a[data-click]'),
        // 添加更多选择器来适应百度的变化
        ...doc.querySelectorAll('#content_left .result-op a[href*="http"]'),
        ...doc.querySelectorAll('#content_left .c-container .t a'),
        ...doc.querySelectorAll('#content_left .c-container .c-title-text')
      ]

      // 尝试解析Bing搜索结果 - 使用多个选择器来获取更多结果
      const bingResults = [
        ...doc.querySelectorAll('.b_algo h2 a'),
        ...doc.querySelectorAll('.b_algo a.tilk'),
        ...doc.querySelectorAll('.b_algo a.b_title'),
        ...doc.querySelectorAll('.b_results a.b_restorLink'),
        // 添加更多选择器来适应Bing的变化
        ...doc.querySelectorAll('.b_algo .b_caption a'),
        ...doc.querySelectorAll('.b_algo .b_attribution cite'),
        ...doc.querySelectorAll('.b_algo .b_deep a')
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

            // 使用过滤方法检查URL
            if (url && !this.shouldFilterUrl(url) && !uniqueUrls.has(url)) {
              // 计算URL优先级分数
              const priorityScore = this.getUrlPriorityScore(url)

              uniqueUrls.add(url)
              results.push({
                title: title.trim() || url,
                url: url,
                // 将优先级分数作为元数据保存
                meta: { priorityScore }
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

            // 使用过滤方法检查URL
            if (url && !this.shouldFilterUrl(url) && !uniqueUrls.has(url)) {
              // 计算URL优先级分数
              const priorityScore = this.getUrlPriorityScore(url)

              uniqueUrls.add(url)
              results.push({
                title: title.trim() || url,
                url: url,
                // 将优先级分数作为元数据保存
                meta: { priorityScore }
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

            // 使用过滤方法检查URL
            if (url && !this.shouldFilterUrl(url) && !uniqueUrls.has(url)) {
              // 计算URL优先级分数
              const priorityScore = this.getUrlPriorityScore(url)

              uniqueUrls.add(url)
              results.push({
                title: title.trim() || url,
                url: url,
                // 将优先级分数作为元数据保存
                meta: { priorityScore }
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

              // 使用过滤方法检查URL，但使用更宽松的条件
              if (
                url &&
                (url.startsWith('http') || url.startsWith('https')) &&
                !url.includes('sogou.com/web') && // 仍然过滤掉搜索引擎内部链接
                !url.includes('javascript:') &&
                !url.includes('mailto:') &&
                !url.includes('tel:') &&
                !uniqueUrls.has(url) &&
                title.trim().length > 0
              ) {
                // 计算URL优先级分数
                const priorityScore = this.getUrlPriorityScore(url)

                uniqueUrls.add(url)
                results.push({
                  title: title.trim() || url,
                  url: url,
                  meta: { priorityScore }
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

            // 使用过滤方法检查URL
            if (url && !this.shouldFilterUrl(url) && !uniqueUrls.has(url)) {
              // 计算URL优先级分数
              const priorityScore = this.getUrlPriorityScore(url)

              uniqueUrls.add(url)
              results.push({
                title: title.trim() || url,
                url: url,
                // 将优先级分数作为元数据保存
                meta: { priorityScore }
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
                // 计算URL优先级分数
                const priorityScore = this.getUrlPriorityScore(url)

                uniqueUrls.add(url)
                results.push({
                  title: title.trim() || url,
                  url: url,
                  meta: { priorityScore }
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
                // 计算URL优先级分数
                const priorityScore = this.getUrlPriorityScore(url)

                uniqueUrls.add(url)
                results.push({
                  title: title.trim() || url,
                  url: url,
                  meta: { priorityScore }
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

              // 使用过滤方法检查URL
              if (url && !this.shouldFilterUrl(url) && !uniqueUrls.has(url)) {
                // 计算URL优先级分数
                const priorityScore = this.getUrlPriorityScore(url)

                uniqueUrls.add(url)
                results.push({
                  title: title.trim() || url,
                  url: url,
                  // 将优先级分数作为元数据保存
                  meta: { priorityScore }
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
              // 计算URL优先级分数
              const priorityScore = this.getUrlPriorityScore(url)

              uniqueUrls.add(url)
              results.push({
                title: url,
                url: url,
                meta: { priorityScore }
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

            // 使用过滤方法检查URL
            if (url && !this.shouldFilterUrl(url) && !uniqueUrls.has(url) && title.trim().length > 0) {
              // 计算URL优先级分数
              const priorityScore = this.getUrlPriorityScore(url)

              uniqueUrls.add(url)
              results.push({
                title: title.trim(),
                url: url,
                // 将优先级分数作为元数据保存
                meta: { priorityScore }
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
   * 检查URL是否应该被过滤掉
   * @param url 要检查的URL
   * @returns 如果应该过滤掉返回true，否则返回false
   */
  private shouldFilterUrl(url: string): boolean {
    if (!url || !url.startsWith('http')) {
      return true
    }

    const urlLower = url.toLowerCase()

    // 检查是否是搜索引擎内部链接
    if (
      urlLower.includes('google.com/search') ||
      urlLower.includes('bing.com/search') ||
      urlLower.includes('baidu.com/s?') ||
      urlLower.includes('sogou.com/web') ||
      urlLower.includes('duckduckgo.com/?q=') ||
      urlLower.includes('searx.tiekoetter.com/search')
    ) {
      return true
    }

    // 检查是否包含排除的域名
    for (const domain of this.urlFilters.excludedDomains) {
      if (urlLower.includes(domain)) {
        return true
      }
    }

    // 检查是否是排除的文件类型
    for (const fileType of this.urlFilters.excludedFileTypes) {
      if (urlLower.endsWith(fileType)) {
        return true
      }
    }

    // 检查是否是常见的无用链接
    if (
      urlLower.includes('javascript:') ||
      urlLower.includes('mailto:') ||
      urlLower.includes('tel:') ||
      urlLower.includes('about:') ||
      urlLower.includes('chrome:') ||
      urlLower.includes('file:')
    ) {
      return true
    }

    return false
  }

  /**
   * 计算URL的优先级分数
   * @param url 要计算的URL
   * @returns 优先级分数，范围从0到1，越高越优先
   */
  private getUrlPriorityScore(url: string): number {
    if (!url) return 0

    const urlLower = url.toLowerCase()

    // 检查是否是优先域名
    for (let i = 0; i < this.urlFilters.priorityDomains.length; i++) {
      const domain = this.urlFilters.priorityDomains[i]
      if (urlLower.includes(domain)) {
        // 根据域名在数组中的位置计算分数，前面的域名分数更高
        return 1 - (i / this.urlFilters.priorityDomains.length) * 0.5
      }
    }

    return 0
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
      if (url && (url.startsWith('http') || url.startsWith('https')) && !this.shouldFilterUrl(url)) {
        // 计算URL优先级分数
        const priorityScore = this.getUrlPriorityScore(url)
        // 优先级较高的URL更有可能被添加
        if (priorityScore > 0.3 || Math.random() < 0.7) {
          urls.add(url)
        }
      }
    }

    // 匹配纯文本URL
    const urlRegex = /(https?:\/\/[^\s]+)/g
    while ((match = urlRegex.exec(markdown)) !== null) {
      const url = match[1]
      if (url && !this.shouldFilterUrl(url)) {
        // 计算URL优先级分数
        const priorityScore = this.getUrlPriorityScore(url)
        // 优先级较高的URL更有可能被添加
        if (priorityScore > 0.3 || Math.random() < 0.5) {
          urls.add(url)
        }
      }
    }

    return Array.from(urls)
  }
}
