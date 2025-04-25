import { nanoid } from '@reduxjs/toolkit' // Need nanoid in main process
import { IpcChannel } from '@shared/IpcChannel'
import { BrowserWindow } from 'electron'

import { ResearchIteration, ResearchReport, WebSearchResponse, WebSearchResult, WebSearchState } from '../types' // Use main process types
import { fetchWebContent, noContent } from './fetch' // Import main process fetchWebContent and noContent

// Define AnalyzedResult type (Copy from DeepSearchProvider)
interface AnalyzedResult extends WebSearchResult {
  summary?: string // 内容摘要
  keywords?: string[] // 关键词
  relevanceScore?: number // 相关性评分
}

/**
 * 分析配置接口 (Copy from DeepResearchProvider and DeepSearchProvider)
 */
interface AnalysisConfig {
  maxIterations: number
  maxResultsPerQuery: number
  minConfidenceScore: number
  autoSummary: boolean
  modelId?: string
  minOutputTokens?: number // 最小输出token数
  maxInputTokens?: number // 最大输入token数
  maxReportLinks?: number // 新增：最终报告最大链接数
  enableQueryOptimization?: boolean // 新增：是否启用查询优化
}

/**
 * DeepResearchService 类
 * 在主进程中提供深度研究功能
 */
class DeepResearchService {
  private mainWindow: BrowserWindow | null = null
  private analysisConfig: AnalysisConfig // Copy from DeepResearchProvider
  // 当前研究状态，暂时未使用
  // private _currentResearch: { query: string; websearch: WebSearchState } | null = null
  private isResearching: boolean = false

  // Define default search engine URLs (Copy from DeepSearchProvider)
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

  // Define URL filtering rules (Copy from DeepSearchProvider)
  private urlFilters = {
    excludedDomains: [
      'login',
      'signin',
      'signup',
      'register',
      'account',
      'checkout',
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
      'cart',
      'shop',
      'store',
      'buy',
      'price',
      'deal',
      'coupon',
      'discount',
      'comment',
      'comments',
      'forum',
      'bbs'
    ],
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

  // Analysis model configuration (Copy from DeepSearchProvider)
  private analyzeConfig = {
    enabled: true, // Whether to enable pre-analysis
    maxSummaryLength: 300, // Maximum summary length for each result
    batchSize: 3 // Number of results to analyze in each batch
  }

  constructor() {
    // Initialize with default config (Copy from DeepResearchProvider)
    this.analysisConfig = {
      maxIterations: 3, // 默认最大迭代次数
      maxResultsPerQuery: 50, // 每次查询的最大结果数
      minConfidenceScore: 0.6, // 最小可信度分数
      autoSummary: true, // 自动生成摘要
      minOutputTokens: 20000, // 最小输出20,000 tokens
      maxInputTokens: 200000 // 最大输入200,000 tokens
    }
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * 开始深度研究
   * @param query 初始查询
   * @param websearch WebSearch状态
   */
  async startResearch(query: string, websearch: WebSearchState): Promise<void> {
    if (this.isResearching) {
      console.log('[DeepResearchService] Research is already in progress.')
      // Optionally send a message back to the renderer indicating research is already running
      this.mainWindow?.webContents.send(IpcChannel.DeepResearch_Complete, { error: 'Research already in progress' })
      return
    }

    this.isResearching = true
    // 存储当前研究状态，暂时未使用
    // this._currentResearch = { query, websearch }
    console.log(`[DeepResearchService] Starting deep research for: "${query}"`)

    // Send initial progress update
    this.sendProgress(0, '研究开始', 0)

    try {
      // --- Migration of DeepResearchProvider.research logic starts here ---

      // Ensure websearch exists (already handled by function signature)
      const webSearchState: WebSearchState = websearch
      console.log(`[DeepResearchService] 开始深度研究: "${query}"`)

      // 更新 analysisConfig，从 websearch 状态中获取配置
      this.analysisConfig = {
        ...this.analysisConfig,
        ...webSearchState.deepResearchConfig
      }
      console.log('[DeepResearchService] 使用的分析配置:', this.analysisConfig)

      // 根据配置决定是否优化查询
      let optimizedQuery = query
      if (this.analysisConfig.enableQueryOptimization !== false) {
        // 使用更新后的 analysisConfig
        console.log(`[DeepResearchService] 启用查询优化`)
        optimizedQuery = await this.optimizeQuery(query) // Need to implement optimizeQuery in main process
      } else {
        console.log(`[DeepResearchService] 未启用查询优化`)
      }

      const report: ResearchReport = {
        originalQuery: query,
        iterations: [],
        summary: '',
        directAnswer: '', // 初始化为空字符串
        keyInsights: [],
        sources: [],
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0
        }
      }

      let currentQuery = optimizedQuery
      let iterationCount = 0
      const allSources = new Set<string>()

      // 定义搜索引擎类别列表 (Copy from DeepResearchProvider)
      const engineCategories = ['chinese', 'international', 'meta', 'academic']

      // 迭代研究过程
      while (iterationCount < this.analysisConfig.maxIterations) {
        // Check for cancellation
        if (!this.isResearching) {
          console.log('[DeepResearchService] Research cancelled.')
          this.sendProgress(iterationCount + 1, '研究已取消', -1) // Use -1 for cancelled status
          this.isResearching = false
          // this._currentResearch = null
          this.mainWindow?.webContents.send(IpcChannel.DeepResearch_Complete, { cancelled: true })
          return
        }

        // Send progress update
        const percent = Math.round((iterationCount / this.analysisConfig.maxIterations) * 100)
        this.sendProgress(iterationCount + 1, `迭代 ${iterationCount + 1}: ${currentQuery}`, percent)

        console.log(`[DeepResearchService] 迭代 ${iterationCount + 1}: "${currentQuery}"`)

        // 根据当前迭代选择搜索引擎类别
        const categoryIndex = iterationCount % engineCategories.length
        const currentCategory = engineCategories[categoryIndex]
        console.log(`[DeepResearchService] 这一迭代使用 ${currentCategory} 类别的搜索引擎`)

        // 1. 使用DeepSearch获取当前查询的结果，指定搜索引擎类别
        this.sendProgress(
          iterationCount + 1,
          `正在搜索: ${currentQuery}`,
          Math.round((iterationCount / this.analysisConfig.maxIterations) * 100)
        )
        // This call needs to be adapted to use the main-process DeepSearch logic
        // Call the internal search method
        const searchResponse = await this.performSearch(currentQuery, webSearchState, currentCategory)

        // 限制结果数量
        const limitedResults = searchResponse.results.slice(0, this.analysisConfig.maxResultsPerQuery)

        // 2. 分析搜索结果
        this.sendProgress(
          iterationCount + 1,
          `正在分析 ${limitedResults.length} 个结果...`,
          Math.round((iterationCount / this.analysisConfig.maxIterations) * 100)
        )
        // Need to implement analyzeResultsForReport in main process
        const analysis = await this.analyzeResultsForReport(limitedResults, currentQuery, report)

        // 3. 生成后续查询
        this.sendProgress(
          iterationCount + 1,
          `正在生成后续查询...`,
          Math.round((iterationCount / this.analysisConfig.maxIterations) * 100)
        )
        // Need to implement generateFollowUpQueries in main process
        const followUpQueries = await this.generateFollowUpQueries(analysis, currentQuery, report.iterations)

        // 4. 记录这次迭代
        const iteration: ResearchIteration = {
          query: currentQuery,
          results: limitedResults,
          analysis,
          followUpQueries
        }

        report.iterations.push(iteration)

        // 5. 收集源
        limitedResults.forEach((result) => {
          if (result.url) {
            allSources.add(result.url)
          }
        })

        // 6. 检查是否继续迭代
        if (followUpQueries.length === 0) {
          console.log(`[DeepResearchService] 没有更多的后续查询，结束迭代`)
          this.sendProgress(
            iterationCount + 1,
            `迭代完成，没有更多后续查询`,
            Math.round(((iterationCount + 1) / this.analysisConfig.maxIterations) * 100)
          )
          break
        }

        // 7. 更新查询并继续
        currentQuery = followUpQueries[0] // 使用第一个后续查询
        iterationCount++
      }

      // Generate final summary, insights, and direct answer (Need to implement these in main process)
      this.sendProgress(iterationCount, `正在生成研究总结...`, 70)
      report.summary = await this.generateSummary(report.iterations, report)

      this.sendProgress(iterationCount, `正在提取关键见解...`, 80)
      report.keyInsights = await this.extractKeyInsights(report.iterations, report)

      this.sendProgress(iterationCount, `正在生成问题回答...`, 90)
      report.directAnswer = await this.generateDirectAnswer(query, report.summary, report.keyInsights, report)

      report.sources = Array.from(allSources)

      // 根据 maxReportLinks 限制最终报告的链接数量
      if (this.analysisConfig.maxReportLinks !== undefined && this.analysisConfig.maxReportLinks >= 0) {
        report.sources = report.sources.slice(0, this.analysisConfig.maxReportLinks)
        console.log(`[DeepResearchService] 根据设置限制最终报告链接数量为: ${report.sources.length}`)
      }

      this.sendProgress(iterationCount, `研究完成`, 100)

      console.log(`[DeepResearchService] 完成深度研究，共 ${report.iterations.length} 次迭代`)

      // --- Migration of DeepResearchProvider.research logic ends here ---

      // Send completion result
      this.mainWindow?.webContents.send(IpcChannel.DeepResearch_Complete, { success: true, report })
    } catch (error: any) {
      console.error('[DeepResearchService] Deep research failed:', error)
      // Send error result
      this.mainWindow?.webContents.send(IpcChannel.DeepResearch_Complete, { success: false, error: error.message })
    } finally {
      this.isResearching = false
      // this._currentResearch = null
    }
  }

  /**
   * 取消深度研究
   */
  cancelResearch(): void {
    if (this.isResearching) {
      console.log('[DeepResearchService] Cancelling deep research.')
      this.isResearching = false // This flag will be checked in the research loop
      // The loop will handle sending the cancelled status and completion message
    } else {
      console.log('[DeepResearchService] No research in progress to cancel.')
    }
  }

  /**
   * 发送进度更新到渲染进程
   * @param iteration 当前迭代次数
   * @param status 当前状态描述
   * @param percent 完成百分比 (-1 for cancelled)
   */
  private sendProgress(iteration: number, status: string, percent: number): void {
    this.mainWindow?.webContents.send(IpcChannel.DeepResearch_Progress, { iteration, status, percent })
  }

  // --- Placeholder methods for migrated logic ---
  // These methods need to be fully implemented by copying/adapting logic from DeepResearchProvider and DeepSearchProvider

  private async optimizeQuery(query: string): Promise<string> {
    // Implement logic from DeepResearchProvider.optimizeQuery
    console.warn('[DeepResearchService] optimizeQuery not fully implemented.')
    // Need to use main process's fetchGenerate or equivalent
    // Need to import fetchGenerate from main process services
    // Example placeholder:
    // const { fetchGenerate } = await import('./ApiService'); // Assuming ApiService is in main process
    // ... rest of the logic ...
    return query // Return original query as placeholder
  }

  private async analyzeResultsForReport(
    _results: WebSearchResult[],
    query: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _report?: ResearchReport
  ): Promise<string> {
    // Implement logic from DeepResearchProvider.analyzeResults and analyzeWithModel
    console.warn('[DeepResearchService] analyzeResultsForReport not fully implemented.')
    // Need to use main process's fetchGenerate or equivalent
    // Need to import fetchGenerate from main process services
    // Example placeholder:
    // const { fetchGenerate } = await import('./ApiService'); // Assuming ApiService is in main process
    // ... rest of the logic ...
    return `分析结果的占位符内容 for "${query}"`
  }

  private async generateFollowUpQueries(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _analysis: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currentQuery: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _previousIterations: ResearchIteration[]
  ): Promise<string[]> {
    // Implement logic from DeepResearchProvider.generateFollowUpQueries
    console.warn('[DeepResearchService] generateFollowUpQueries not fully implemented.')
    // Need to use main process's fetchGenerate or equivalent
    // Need to import fetchGenerate from main process services
    // Example placeholder:
    // const { fetchGenerate } = await import('./ApiService'); // Assuming ApiService is in main process
    // ... rest of the logic ...
    return [] // Return empty array as placeholder
  }

  private async generateSummary(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _iterations: ResearchIteration[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _report?: ResearchReport
  ): Promise<string> {
    // Implement logic from DeepResearchProvider.generateSummary
    console.warn('[DeepResearchService] generateSummary not fully implemented.')
    // Need to use main process's fetchGenerate or equivalent
    // Need to import fetchGenerate from main process services
    // Example placeholder:
    // const { fetchGenerate } = await import('./ApiService'); // Assuming ApiService is in main process
    // ... rest of the logic ...
    return '研究总结的占位符内容'
  }

  private async extractKeyInsights(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _iterations: ResearchIteration[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _report?: ResearchReport
  ): Promise<string[]> {
    // Implement logic from DeepResearchProvider.extractKeyInsights
    console.warn('[DeepResearchService] extractKeyInsights not fully implemented.')
    // Need to use main process's fetchGenerate or equivalent
    // Need to import fetchGenerate from main process services
    // Example placeholder:
    // const { fetchGenerate } = await import('./ApiService'); // Assuming ApiService is in main process
    // ... rest of the logic ...
    return ['关键见解的占位符内容']
  }

  private async generateDirectAnswer(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _originalQuery: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _summary: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _keyInsights: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _report?: ResearchReport
  ): Promise<string> {
    // Implement logic from DeepResearchProvider.generateDirectAnswer
    console.warn('[DeepResearchService] generateDirectAnswer not fully implemented.')
    // Need to use main process's fetchGenerate or equivalent
    // Need to import fetchGenerate from main process services
    // Example placeholder:
    // const { fetchGenerate } = await import('./ApiService'); // Assuming ApiService is in main process
    // ... rest of the logic ...
    return '直接回答的占位符内容'
  }

  // 估算文本的token数量
  // 注意：此方法暂时未使用，但保留以备将来实现
  /*
  private _estimateTokens(text: string): number {
    // Implement logic from DeepResearchProvider.estimateTokens
    console.warn('[DeepResearchService] _estimateTokens not fully implemented.')
    return Math.ceil(text.length / 2) // Simple placeholder estimation
  }
  */

  // --- Migrated DeepSearchProvider methods ---

  /**
   * Perform the actual search using multiple engines (Migrated from DeepSearchProvider.search)
   * @param query Search query
   * @param websearch WebSearch state
   * @param engineCategory Optional engine category to filter by
   * @returns Search response
   */
  private async performSearch(
    query: string,
    websearch: WebSearchState,
    engineCategory?: string
  ): Promise<WebSearchResponse> {
    try {
      if (!query.trim()) {
        throw new Error('Search query cannot be empty')
      }

      const cleanedQuery = query.split('\r\n')[1] ?? query
      console.log(`[DeepResearchService] 开始多引擎并行搜索: ${cleanedQuery}`)

      const allItems: Array<{ title: string; url: string; source: string }> = []

      let enginesToUse = this.searchEngines

      if (engineCategory) {
        enginesToUse = this.searchEngines.filter((engine) => engine.category === engineCategory)
        if (enginesToUse.length === 0) {
          enginesToUse = this.searchEngines
        }
      } else if (websearch.deepSearchConfig?.enabledEngines) {
        const enabledEngines = websearch.deepSearchConfig.enabledEngines
        enginesToUse = this.searchEngines.filter((engine) => {
          // Simplified check for enabled engines
          const engineNameLower = engine.name.toLowerCase()
          return enabledEngines[engineNameLower] === true
        })

        if (enginesToUse.length === 0) {
          enginesToUse = this.searchEngines.filter((engine) => engine.name === 'Baidu')
        }
      }

      const enabledEngineNames = enginesToUse.map((engine) => engine.name)
      console.log(
        `[DeepResearchService] 使用${engineCategory || '所有'}类别的搜索引擎，共 ${enginesToUse.length} 个: ${enabledEngineNames.join(', ')}`
      )

      const searchPromises = enginesToUse.map(async (engine) => {
        try {
          const uid = `deep-search-${engine.name.toLowerCase()}-${nanoid()}`
          const url = engine.url.replace('%s', encodeURIComponent(cleanedQuery))

          console.log(`[DeepResearchService] 使用${engine.name}搜索: ${url}`)

          // Use main process searchService
          // This requires the main window's webContents to call an embedder function.
          // This might need adjustment depending on how searchService is exposed in the main process.
          // Assuming searchService is available via a direct import or a service locator pattern in main.
          // For now, using a placeholder call structure.
          // const content = await this.mainWindow?.webContents.session.callEmbedderFunction('searchService.openUrlInSearchWindow', uid, url);
          // Let's assume searchService is directly importable in main process services.
          const { searchService } = await import('./SearchService') // Assuming SearchService is in the same directory
          const content = await searchService.openUrlInSearchWindow(uid, url)

          const searchItems = this.parseValidUrls(content)
          console.log(`[DeepResearchService] ${engine.name}找到 ${searchItems.length} 个结果`)

          return searchItems.map((item) => ({
            ...item,
            source: engine.name
          }))
        } catch (engineError) {
          console.error(`[DeepResearchService] ${engine.name}搜索失败:`, engineError)
          return []
        }
      })

      // Handle custom provider URL if exists (Need to get this from websearch state or config)
      // Assuming websearch state contains provider info or we can access config
      // For now, skipping custom provider logic unless it's part of websearch state
      // If websearch.provider exists and has a url:
      if (websearch.provider && websearch.provider.url) {
        searchPromises.push(
          (async () => {
            try {
              const uid = `deep-search-custom-${nanoid()}`
              // 我们已经检查了 websearch.provider 和 websearch.provider.url 是否存在
              // 但 TypeScript 仍然认为它可能是 undefined，所以我们使用非空断言
              const providerUrl = websearch.provider!.url!
              const url = providerUrl.replace('%s', encodeURIComponent(cleanedQuery))

              console.log(`[DeepResearchService] 使用自定义搜索: ${url}`)

              const { searchService } = await import('./SearchService')
              const content = await searchService.openUrlInSearchWindow(uid, url)

              const searchItems = this.parseValidUrls(content)
              console.log(`[DeepResearchService] 自定义搜索找到 ${searchItems.length} 个结果`)

              return searchItems.map((item) => ({
                ...item,
                source: '自定义'
              }))
            } catch (customError) {
              console.error('[DeepResearchService] 自定义搜索失败:', customError)
              return []
            }
          })()
        )
      }

      const searchResults = await Promise.all(searchPromises)

      for (const results of searchResults) {
        allItems.push(...results)
      }

      console.log(`[DeepResearchService] 总共找到 ${allItems.length} 个结果`)

      const uniqueUrls = new Set<string>()
      const uniqueItems = allItems.filter((item) => {
        if (uniqueUrls.has(item.url)) {
          return false
        }
        uniqueUrls.add(item.url)
        return true
      })

      console.log(`[DeepResearchService] 去重后有 ${uniqueItems.length} 个结果`)

      const validItems = uniqueItems.filter((item) => item.url.startsWith('http') || item.url.startsWith('https'))

      console.log(`[DeepResearchService] 过滤后有 ${validItems.length} 个有效结果`)

      // Fetch content for valid URLs
      const results = await this.fetchContentsWithDepth(validItems, websearch)

      // Analyze results (using the migrated analyzeResults method)
      let analyzedResults: WebSearchResult[] = results
      if (this.analyzeConfig.enabled) {
        // 使用第二个 analyzeResults 方法，它返回 AnalyzedResult[]
        const analyzed = await this.analyzeResults(results, cleanedQuery)
        analyzedResults = analyzed as WebSearchResult[] // 类型转换
      }

      // Add source and summary/keywords to title/content
      const resultsWithSource = analyzedResults.map((result) => {
        // Find the original item to get the source
        const originalItem = validItems.find((item) => item.url === result.url)
        const source = originalItem ? originalItem.source : '未知来源'

        let enhancedContent = result.content
        const summary = (result as AnalyzedResult).summary
        const keywords = (result as AnalyzedResult).keywords

        if (summary && summary !== enhancedContent.substring(0, summary.length)) {
          enhancedContent = `**摘要**: ${summary}\n\n---\n\n${enhancedContent}`
        }

        if (keywords && keywords.length > 0) {
          enhancedContent = `**关键词**: ${keywords.join(', ')}\n\n${enhancedContent}`
        }

        return {
          ...result,
          title: `[${source}] ${result.title}`,
          content: enhancedContent
        }
      })

      // Sort by relevance score
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
      console.error('[DeepResearchService] Search failed:', error)
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parse valid URLs from HTML content (Migrated from DeepSearchProvider.parseValidUrls)
   */
  private parseValidUrls(htmlContent: string): Array<{ title: string; url: string; meta?: Record<string, any> }> {
    // This method relies on DOMParser, which is available in the renderer process.
    // In the main process, we might need a different approach or a library to parse HTML.
    // For now, keeping the structure but noting the dependency.
    console.warn('[DeepResearchService] parseValidUrls needs main process HTML parsing implementation.')
    // Placeholder implementation:
    const results: Array<{ title: string; url: string; meta?: Record<string, any> }> = []
    // Simple regex to find URLs as a temporary placeholder
    const urlRegex = /https?:\/\/[^\s"'<>()]+/g
    let match: RegExpExecArray | null
    while ((match = urlRegex.exec(htmlContent)) !== null) {
      const url = match[0]
      if (!this.shouldFilterUrl(url)) {
        // Use migrated filter method
        const priorityScore = this.getUrlPriorityScore(url) // Use migrated priority score method
        results.push({ title: url, url: url, meta: { priorityScore } })
      }
    }
    return results
  }

  /**
   * Check if a URL should be filtered (Migrated from DeepSearchProvider.shouldFilterUrl)
   */
  private shouldFilterUrl(url: string): boolean {
    if (!url || !url.startsWith('http')) return true
    const urlLower = url.toLowerCase()
    // Simplified filter logic for placeholder
    if (urlLower.includes('google.com/search') || urlLower.includes('bing.com/search')) return true
    for (const domain of this.urlFilters.excludedDomains) {
      if (urlLower.includes(domain)) return true
    }
    for (const fileType of this.urlFilters.excludedFileTypes) {
      if (urlLower.endsWith(fileType)) return true
    }
    return false
  }

  /**
   * Calculate URL priority score (Migrated from DeepSearchProvider.getUrlPriorityScore)
   */
  private getUrlPriorityScore(url: string): number {
    if (!url) return 0
    const urlLower = url.toLowerCase()
    for (let i = 0; i < this.urlFilters.priorityDomains.length; i++) {
      const domain = this.urlFilters.priorityDomains[i]
      if (urlLower.includes(domain)) {
        return 1 - (i / this.urlFilters.priorityDomains.length) * 0.5
      }
    }
    return 0
  }

  /**
   * Fetch content with depth (Migrated from DeepSearchProvider.fetchContentsWithDepth)
   */
  private async fetchContentsWithDepth(
    items: Array<{ title: string; url: string; source?: string }>,
    websearch: WebSearchState,
    depth: number = 1
  ): Promise<WebSearchResult[]> {
    console.log(`[DeepResearchService] 开始获取内容，深度为 ${depth}`)

    // 第一层：直接获取传入的URL内容
    const results: WebSearchResult[] = []
    for (const item of items) {
      try {
        const content = await fetchWebContent(item.url, 'markdown', true) // 使用浏览器模式获取内容
        results.push({ title: item.title, content: content.content, url: item.url, source: item.source })
      } catch (error) {
        console.error(`[DeepResearchService] Failed to fetch content for ${item.url}:`, error)
        results.push({ title: item.title, content: noContent, url: item.url, source: item.source })
      }
    }

    // 如果深度大于1，则从第一层内容中提取链接并继续获取
    if (depth > 1) {
      // 从第一层结果中提取链接
      const secondLevelUrls: Set<string> = new Set()

      results.forEach((result) => {
        if (result.content !== noContent) {
          // 使用 _extractUrlsFromMarkdown 方法从Markdown内容中提取URL
          const urls = this._extractUrlsFromMarkdown(result.content)
          urls.forEach((url) => {
            // 过滤URL
            if (!this.shouldFilterUrl(url)) {
              secondLevelUrls.add(url)
            }
          })
        }
      })

      // 限制第二层URL数量
      const maxSecondLevelUrls = Math.min(secondLevelUrls.size, 10)
      const secondLevelUrlsArray = Array.from(secondLevelUrls).slice(0, maxSecondLevelUrls)

      console.log(
        `[DeepResearchService] 第二层找到 ${secondLevelUrls.size} 个URL，将抓取 ${secondLevelUrlsArray.length} 个`
      )

      // 抓取第二层URL的内容
      const secondLevelItems = secondLevelUrlsArray.map((url) => ({
        title: url,
        url: url,
        source: '深度链接' // 标记为深度链接
      }))

      // 递归调用，但深度减1
      const secondLevelResults = await this.fetchContentsWithDepth(secondLevelItems, websearch, depth - 1)

      // 合并两层结果
      results.push(...secondLevelResults)
    }

    return results
  }

  /**
   * Extract URLs from Markdown content (Migrated from DeepSearchProvider.extractUrlsFromMarkdown)
   * 注意：此方法使用 fetch.ts 中实现的 extractUrlsFromMarkdown 函数
   */
  private _extractUrlsFromMarkdown(markdown: string): string[] {
    // 使用 require 导入 extractUrlsFromMarkdown 函数
    const { extractUrlsFromMarkdown } = require('./fetch')
    return extractUrlsFromMarkdown(markdown)
  }

  /**
   * Check if content contains garbage (Migrated from DeepSearchProvider.containsGarbage)
   */
  private containsGarbage(content: string): boolean {
    console.warn('[DeepResearchService] containsGarbage not fully implemented.')
    // This method needs a main process implementation.
    // Placeholder implementation:
    if (!content || content.length < 50) return true
    return false // Simple check for now
  }

  // The analyzeResults method from DeepSearchProvider also needs to be migrated and integrated.
  // It relies on the AnalyzedResult interface defined above.
  // It also relies on the containsGarbage method.
  // It does NOT rely on window.api, so it can be copied more directly, but needs the AnalyzedResult type.
  // Let's add the analyzeResults method from DeepSearchProvider here.

  /**
   * Analyze search results, extract summary and keywords (Migrated from DeepSearchProvider.analyzeResults)
   * @param results Search results
   * @param query Search query
   * @returns Analyzed results
   */
  private async analyzeResults(results: WebSearchResult[], query: string): Promise<AnalyzedResult[]> {
    console.log(`[DeepResearchService] 开始分析 ${results.length} 个结果`)

    const batchSize = this.analyzeConfig.batchSize
    const analyzedResults: AnalyzedResult[] = [...results]

    const queryWords = query.toLowerCase().split(/\s+/)

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

    const keywordWeights = new Map<string, number>()
    queryWords.forEach((word, index) => {
      if (word.length > 2 && !stopWords.has(word)) {
        const positionWeight = 1 - (index / queryWords.length) * 0.5
        const lengthWeight = Math.min(1, word.length / 10)
        const weight = positionWeight * 0.7 + lengthWeight * 0.3
        keywordWeights.set(word, weight)
      }
    })

    if (keywordWeights.size === 0) {
      queryWords.forEach((word) => {
        if (word.length > 2) {
          keywordWeights.set(word, 1.0)
        }
      })
    }

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.content === noContent) continue

      try {
        const maxLength = this.analyzeConfig.maxSummaryLength
        const content = result.content.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
        const sentences = content.split(/(?<=[.!?])\s+/)

        const sentenceScores = sentences.map((sentence) => {
          const sentenceLower = sentence.toLowerCase()
          let score = 0
          for (const [keyword, weight] of keywordWeights.entries()) {
            if (sentenceLower.includes(keyword)) {
              score += weight
              if (sentenceLower.indexOf(keyword) < 20) {
                score += weight * 0.5
              }
            }
          }
          return { sentence, score }
        })

        sentenceScores.sort((a, b) => b.score - a.score)

        let summary = ''
        let currentLength = 0

        if (sentenceScores.length > 0 && sentenceScores[0].score > 0) {
          summary = sentenceScores[0].sentence
          currentLength = summary.length
        }

        for (let j = 1; j < sentenceScores.length && currentLength < maxLength; j++) {
          if (sentenceScores[j].score > 0) {
            const nextSentence = sentenceScores[j].sentence
            if (currentLength + nextSentence.length + 1 <= maxLength) {
              summary += ' ' + nextSentence
              currentLength += nextSentence.length + 1
            }
          }
        }

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

        const contentLower = result.content.toLowerCase()
        const keywordScores = new Map<string, number>()
        const contentWords = contentLower.split(/\W+/).filter((word) => word.length > 3 && !stopWords.has(word))

        const wordFrequency = new Map<string, number>()
        contentWords.forEach((word) => {
          wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1)
        })

        for (const [word, freq] of wordFrequency.entries()) {
          let score = freq
          if (keywordWeights.has(word)) {
            score += freq * keywordWeights.get(word)! * 3
          }
          if (result.title.toLowerCase().includes(word)) {
            score += 5
          }
          keywordScores.set(word, score)
        }

        for (const [keyword, weight] of keywordWeights.entries()) {
          if (contentLower.includes(keyword) && !keywordScores.has(keyword)) {
            keywordScores.set(keyword, weight * 3)
          }
        }

        const sortedKeywords = Array.from(keywordScores.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map((entry) => entry[0])

        let relevanceScore = 0
        let keywordMatchScore = 0

        for (const [keyword, weight] of keywordWeights.entries()) {
          let count = 0
          let pos = contentLower.indexOf(keyword)
          while (pos !== -1) {
            count++
            pos = contentLower.indexOf(keyword, pos + 1)
          }
          if (count > 0) {
            keywordMatchScore += (weight * Math.min(10, count)) / 10
          }
        }

        if (keywordWeights.size > 0) {
          keywordMatchScore = keywordMatchScore / keywordWeights.size
        }

        let titleScore = 0
        const titleLower = result.title.toLowerCase()
        for (const [keyword, weight] of keywordWeights.entries()) {
          if (titleLower.includes(keyword)) {
            titleScore += weight
          }
        }

        if (keywordWeights.size > 0) {
          titleScore = titleScore / keywordWeights.size
        }

        const contentLength = result.content.length
        const lengthScore = Math.min(1, contentLength / 2000) * (contentLength < 50000 ? 1 : 0.5)

        let urlScore = 0
        const url = result.url.toLowerCase()
        if (result.meta && result.meta.priorityScore) {
          urlScore = result.meta.priorityScore
        } else {
          if (url.includes('github.com/augment') || url.includes('augmentcode.com') || url.includes('augment.dev')) {
            urlScore = 1.0
          } else if (
            url.includes('github.com') ||
            url.includes('stackoverflow.com') ||
            url.includes('medium.com') ||
            url.includes('dev.to')
          ) {
            urlScore = 0.8
          } else if (!url.includes('login') && !url.includes('signup') && !url.includes('register')) {
            urlScore = 0.5
          }
        }

        relevanceScore = keywordMatchScore * 0.4 + titleScore * 0.3 + lengthScore * 0.05 + urlScore * 0.25
        relevanceScore = Math.min(1, Math.max(0, relevanceScore))

        analyzedResults[i] = {
          ...analyzedResults[i],
          summary,
          keywords: sortedKeywords,
          relevanceScore
        }

        if (i % batchSize === 0 || i === results.length - 1) {
          console.log(`[DeepResearchService] 已分析 ${i + 1}/${results.length} 个结果`)
        }
      } catch (error) {
        console.error(`[DeepResearchService] 分析结果 ${i} 失败:`, error)
      }
    }

    analyzedResults.sort((a, b) => {
      const scoreA = (a as AnalyzedResult).relevanceScore || 0
      const scoreB = (b as AnalyzedResult).relevanceScore || 0
      return scoreB - scoreA
    })

    const filteredResults = analyzedResults.filter((result) => {
      const score = (result as AnalyzedResult).relevanceScore || 0
      if (score <= 0.05) return false
      if (this.containsGarbage(result.content)) {
        // Use migrated containsGarbage method
        console.log(`[DeepResearchService] 过滤乱码或广告内容: ${result.title}`)
        return false
      }
      return true
    })

    console.log(`[DeepResearchService] 完成分析 ${results.length} 个结果，过滤后剩余 ${filteredResults.length} 个结果`)
    return filteredResults
  }
}

export const deepResearchService = new DeepResearchService()
