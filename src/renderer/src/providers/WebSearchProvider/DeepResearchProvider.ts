import { WebSearchState } from '@renderer/store/websearch'
import {
  ResearchIteration,
  ResearchReport,
  WebSearchProvider,
  WebSearchResponse,
  WebSearchResult
} from '@renderer/types'

import BaseWebSearchProvider from './BaseWebSearchProvider'
import DeepSearchProvider from './DeepSearchProvider'

/**
 * 分析配置接口
 */
interface AnalysisConfig {
  maxIterations: number
  maxResultsPerQuery: number
  minConfidenceScore: number
  autoSummary: boolean
  modelId?: string
  minOutputTokens?: number // 最小输出token数
  maxInputTokens?: number // 最大输入token数
  enableLinkRelevanceFilter?: boolean // 启用链接相关性过滤
  linkRelevanceModelId?: string // 链接相关性评估模型ID
  linkRelevanceThreshold?: number // 链接相关性阈值，低于此值的链接将被过滤
}

// 使用从 types/index.ts 导入的 ResearchIteration 和 ResearchReport 类型

/**
 * DeepResearchProvider 类
 * 提供深度研究功能，包括多轮搜索、分析和总结
 */
class DeepResearchProvider extends BaseWebSearchProvider {
  private deepSearchProvider: DeepSearchProvider
  private analysisConfig: AnalysisConfig

  // 存储研究过程中打开的浏览器窗口ID
  private searchWindowIds: string[] = []

  constructor(provider: WebSearchProvider) {
    super(provider)
    this.deepSearchProvider = new DeepSearchProvider(provider)
    this.analysisConfig = {
      maxIterations: 3, // 默认最大迭代次数
      maxResultsPerQuery: 50, // 每次查询的最大结果数
      minConfidenceScore: 0.6, // 最小可信度分数
      autoSummary: true, // 自动生成摘要
      minOutputTokens: 20000, // 最小输出20,000 tokens
      maxInputTokens: 200000, // 最大输入200,000 tokens
      enableLinkRelevanceFilter: true, // 默认启用链接相关性过滤
      linkRelevanceThreshold: 0.6 // 默认链接相关性阈值
    }
  }

  // 实现 BaseWebSearchProvider 的抽象方法
  public async search(query: string, websearch: WebSearchState): Promise<WebSearchResponse> {
    // 调用 research 方法并将结果转换为 WebSearchResponse 格式
    const researchResults = await this.research(query, websearch)

    // 从研究结果中提取搜索结果
    const allResults = researchResults.iterations.flatMap((iter) => iter.results)

    // 返回标准的 WebSearchResponse 格式
    return {
      query,
      results: allResults
    }
  }

  /**
   * 优化查询
   * @param query 用户原始查询
   * @returns 优化后的查询
   */
  private async optimizeQuery(query: string): Promise<string> {
    try {
      console.log(`[DeepResearch] 正在优化查询: "${query}"`)

      // 使用模型优化查询
      const { fetchGenerate } = await import('@renderer/services/ApiService')
      const prompt = `你是一个搜索优化专家，负责将用户的问题转化为最有效的搜索查询。

用户问题: "${query}"

请分析这个问题，并生成一个更有效的搜索查询。你的查询应该:
1. 提取关键概念和术语
2. 去除不必要的虚词和介词
3. 增加相关的同义词或专业术语(如果适用)
4. 保持简洁明确，不超过 10 个关键词

只返回优化后的查询词，不要添加任何解释或其他文本。`

      const optimizedQuery = await fetchGenerate({
        prompt,
        content: ' ', // 确保内容不为空
        modelId: this.analysisConfig.modelId
      })

      // 如果优化失败，返回原始查询
      if (!optimizedQuery || optimizedQuery.trim() === '') {
        return query
      }

      console.log(`[DeepResearch] 查询优化结果: "${optimizedQuery}"`)
      return optimizedQuery.trim()
    } catch (error) {
      console.error('[DeepResearch] 查询优化失败:', error)
      return query // 出错时返回原始查询
    }
  }

  /**
   * 执行深度研究
   * @param query 初始查询
   * @param websearch WebSearch状态
   * @param progressCallback 进度回调函数
   * @returns 研究报告
   */
  public async research(
    query: string,
    websearch?: WebSearchState,
    progressCallback?: (iteration: number, status: string, percent: number) => void
  ): Promise<ResearchReport> {
    // 确保 websearch 存在
    const webSearchState: WebSearchState = websearch || {
      defaultProvider: '',
      providers: [],
      maxResults: 10,
      excludeDomains: [],
      searchWithTime: false,
      subscribeSources: [],
      enhanceMode: true,
      overwrite: false,
      deepResearchConfig: {
        maxIterations: this.analysisConfig.maxIterations,
        maxResultsPerQuery: this.analysisConfig.maxResultsPerQuery,
        autoSummary: this.analysisConfig.autoSummary || true
      }
    }
    console.log(`[DeepResearch] 开始深度研究: "${query}"`)

    // 根据配置决定是否优化查询
    let optimizedQuery = query
    if (webSearchState.deepResearchConfig?.enableQueryOptimization !== false) {
      console.log(`[DeepResearch] 启用查询优化`)
      optimizedQuery = await this.optimizeQuery(query)
    } else {
      console.log(`[DeepResearch] 未启用查询优化`)
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

    // 定义搜索引擎类别列表
    const engineCategories = ['chinese', 'international', 'meta', 'academic']

    // 迭代研究过程
    while (iterationCount < this.analysisConfig.maxIterations) {
      // 调用进度回调
      if (progressCallback) {
        const percent = Math.round((iterationCount / this.analysisConfig.maxIterations) * 100)
        progressCallback(iterationCount + 1, `迭代 ${iterationCount + 1}: ${currentQuery}`, percent)
      }

      console.log(`[DeepResearch] 迭代 ${iterationCount + 1}: "${currentQuery}"`)

      // 根据当前迭代选择搜索引擎类别
      const categoryIndex = iterationCount % engineCategories.length
      const currentCategory = engineCategories[categoryIndex]
      console.log(`[DeepResearch] 这一迭代使用 ${currentCategory} 类别的搜索引擎`)

      // 1. 使用DeepSearch获取当前查询的结果，指定搜索引擎类别
      if (progressCallback) {
        progressCallback(
          iterationCount + 1,
          `正在搜索: ${currentQuery}`,
          Math.round((iterationCount / this.analysisConfig.maxIterations) * 100)
        )
      }
      const searchResponse = await this.deepSearchProvider.search(currentQuery, webSearchState, currentCategory)

      // 限制结果数量
      let limitedResults = searchResponse.results.slice(0, this.analysisConfig.maxResultsPerQuery)

      // 如果启用了链接相关性过滤，则评估链接相关性并过滤不相关的链接
      if (this.analysisConfig.enableLinkRelevanceFilter) {
        if (progressCallback) {
          progressCallback(
            iterationCount + 1,
            `正在评估 ${limitedResults.length} 个链接的相关性...`,
            Math.round((iterationCount / this.analysisConfig.maxIterations) * 100)
          )
        }
        limitedResults = await this.filterRelevantLinks(limitedResults, query)
        console.log(`[DeepResearch] 过滤后剩余 ${limitedResults.length} 个相关链接`)
      }

      // 2. 分析搜索结果
      if (progressCallback) {
        progressCallback(
          iterationCount + 1,
          `正在分析 ${limitedResults.length} 个结果...`,
          Math.round((iterationCount / this.analysisConfig.maxIterations) * 100)
        )
      }
      const analysis = await this.analyzeResults(limitedResults, currentQuery, report)

      // 3. 生成后续查询
      if (progressCallback) {
        progressCallback(
          iterationCount + 1,
          `正在生成后续查询...`,
          Math.round((iterationCount / this.analysisConfig.maxIterations) * 100)
        )
      }
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
        console.log(`[DeepResearch] 没有更多的后续查询，结束迭代`)
        if (progressCallback) {
          progressCallback(
            iterationCount + 1,
            `迭代完成，没有更多后续查询`,
            Math.round(((iterationCount + 1) / this.analysisConfig.maxIterations) * 100)
          )
        }
        break
      }

      // 7. 更新查询并继续
      currentQuery = followUpQueries[0] // 使用第一个后续查询
      iterationCount++
    }

    // 生成最终总结
    if (progressCallback) {
      progressCallback(iterationCount, `正在生成研究总结...`, 70)
    }
    report.summary = await this.generateSummary(report.iterations, report)

    if (progressCallback) {
      progressCallback(iterationCount, `正在提取关键见解...`, 80)
    }
    report.keyInsights = await this.extractKeyInsights(report.iterations, report)

    if (progressCallback) {
      progressCallback(iterationCount, `正在生成问题回答...`, 90)
    }
    report.directAnswer = await this.generateDirectAnswer(query, report.summary, report.keyInsights, report)

    report.sources = Array.from(allSources)

    if (progressCallback) {
      progressCallback(iterationCount, `研究完成`, 100)
    }

    console.log(`[DeepResearch] 完成深度研究，共 ${report.iterations.length} 次迭代`)

    // 清理所有打开的浏览器窗口
    await this.cleanupSearchWindows()

    return report
  }

  /**
   * 分析搜索结果
   * @param results 搜索结果
   * @param query 当前查询
   * @returns 分析文本
   */
  private async analyzeResults(results: WebSearchResult[], query: string, report?: ResearchReport): Promise<string> {
    if (results.length === 0) {
      return `没有找到关于"${query}"的相关信息。`
    }

    try {
      console.log(`[DeepResearch] 分析 ${results.length} 个结果`)

      // 提取关键信息
      const contentSummaries = results
        .map((result, index) => {
          const content = result.content || '无内容'
          // 提取前300个字符作为摘要
          const summary = content.length > 300 ? content.substring(0, 300) + '...' : content

          return `[${index + 1}] ${result.title}\n${summary}\n来源: ${result.url}\n`
        })
        .join('\n')

      // 使用模型分析内容
      const analysis = await this.analyzeWithModel(contentSummaries, query, report)

      return analysis
    } catch (error: any) {
      console.error('[DeepResearch] 分析结果时出错:', error)
      return `分析过程中出现错误: ${error?.message || '未知错误'}`
    }
  }

  /**
   * 使用项目中的模型分析搜索结果
   */
  private async analyzeWithModel(contentSummaries: string, query: string, report?: ResearchReport): Promise<string> {
    try {
      console.log(`[DeepResearch] 使用模型分析搜索结果`)

      // 分析提示词
      const prompt = `你是一个高级研究分析师，负责深入分析搜索结果并提取全面、详细的见解。
请对以下关于"${query}"的搜索结果进行彻底分析，并提供以下内容：

1. 主要发现（详细列出5-8个要点，每个要点至少包含3-4句解释）
2. 争议点或不同观点（详细分析各方观点及其依据）
3. 技术细节和实现方法（如适用）
4. 历史背景和发展脉络（如适用）
5. 最新进展和趋势
6. 专家共识和最佳实践
7. 需要进一步研究的领域（列出3-5个方向，并解释为什么这些方向值得探索）

请使用学术性、分析性的语言，提供深入的分析而非简单总结。确保你的分析：
- 包含具体的事实、数据和例子
- 引用搜索结果中的具体信息源
- 区分已确认的事实和推测性内容
- 指出信息的可靠性和局限性

搜索结果内容：
${contentSummaries}`

      // 检查内容是否为空
      if (!contentSummaries || contentSummaries.trim() === '') {
        return `没有找到关于"${query}"的有效内容可供分析。`
      }

      // 限制输入token数量
      let trimmedContent = contentSummaries
      const maxInputTokens = this.analysisConfig.maxInputTokens || 200000
      const inputTokens = this.estimateTokens(prompt + trimmedContent)

      if (inputTokens > maxInputTokens) {
        console.log(`[DeepResearch] 输入内容超过最大token限制(${inputTokens} > ${maxInputTokens})，进行裁剪`)
        // 计算需要保留的比例
        const ratio = maxInputTokens / inputTokens
        const contentTokens = this.estimateTokens(trimmedContent)
        const targetContentTokens = Math.floor(contentTokens * ratio) - 1000 // 留出一些空间给提示词

        // 按比例裁剪内容
        const contentLines = trimmedContent.split('\n')
        let currentTokens = 0
        const truncatedLines: string[] = []

        for (const line of contentLines) {
          const lineTokens = this.estimateTokens(line)
          if (currentTokens + lineTokens <= targetContentTokens) {
            truncatedLines.push(line)
            currentTokens += lineTokens
          } else {
            break
          }
        }

        trimmedContent = truncatedLines.join('\n')
        console.log(`[DeepResearch] 内容已裁剪至约 ${this.estimateTokens(trimmedContent)} tokens`)
      }

      // 使用项目中的 fetchGenerate 函数调用模型
      const { fetchGenerate } = await import('@renderer/services/ApiService')
      const analysis = await fetchGenerate({
        prompt,
        content: trimmedContent || ' ', // 使用裁剪后的内容
        modelId: this.analysisConfig.modelId // 使用指定的模型
      })

      // 更新token统计
      if (report?.tokenUsage) {
        report.tokenUsage.inputTokens += this.estimateTokens(prompt + trimmedContent)
        report.tokenUsage.outputTokens += this.estimateTokens(analysis || '')
        report.tokenUsage.totalTokens = report.tokenUsage.inputTokens + report.tokenUsage.outputTokens
      }

      return analysis || `分析失败，无法获取结果。`
    } catch (error: any) {
      console.error('[DeepResearch] 模型分析失败:', error)
      return `分析过程中出现错误: ${error?.message || '未知错误'}`
    }
  }

  /**
   * 生成后续查询
   * @param analysis 当前分析
   * @param currentQuery 当前查询
   * @param previousIterations 之前的迭代
   * @returns 后续查询列表
   */
  private async generateFollowUpQueries(
    analysis: string,
    currentQuery: string,
    previousIterations: ResearchIteration[]
  ): Promise<string[]> {
    try {
      // 避免重复查询
      const previousQueries = new Set(previousIterations.map((i) => i.query))
      previousQueries.add(currentQuery)

      // 使用模型生成后续查询
      const { fetchGenerate } = await import('@renderer/services/ApiService')
      const prompt = `你是一个研究助手，负责生成后续查询。
基于以下关于"${currentQuery}"的分析，生成 2-3 个后续查询，以深入探索该主题。

分析内容：
${analysis}

请仅返回查询列表，每行一个，不要添加编号或其他标记。确保查询简洁、具体且与原始查询"${currentQuery}"相关。`

      const result = await fetchGenerate({
        prompt,
        content: ' ', // 确保内容不为空
        modelId: this.analysisConfig.modelId // 使用指定的模型
      })

      if (!result) {
        return []
      }

      // 处理生成的查询
      const candidateQueries = result
        .split('\n')
        .map((q) => q.trim())
        .filter((q) => q.length > 0)

      // 过滤掉已经查询过的
      const newQueries = candidateQueries.filter((q) => !previousQueries.has(q))

      // 限制查询数量
      return newQueries.slice(0, 3)
    } catch (error: any) {
      console.error('[DeepResearch] 生成后续查询失败:', error)
      return []
    }
  }

  /**
   * 生成研究总结
   * @param iterations 所有迭代
   * @returns 总结文本
   */
  private async generateSummary(iterations: ResearchIteration[], report?: ResearchReport): Promise<string> {
    if (iterations.length === 0) {
      return '没有足够的研究数据来生成总结。'
    }

    try {
      const mainQuery = iterations[0].query

      // 收集所有迭代的分析和查询
      const iterationsData = iterations
        .map((iter, index) => {
          return `迭代 ${index + 1}:\n查询: ${iter.query}\n分析:\n${iter.analysis}\n`
        })
        .join('\n---\n\n')

      // 使用模型生成总结
      const { fetchGenerate } = await import('@renderer/services/ApiService')
      const prompt = `你是一个高级学术研究分析师，负责生成深入、全面的研究总结。
请基于以下关于"${mainQuery}"的多轮研究迭代，生成一份学术水准的综合研究报告。

报告应包含以下部分，每部分都应详细、深入，并包含具体例证：

1. 摘要（简要总结整个研究的主要发现）

2. 背景与历史背景
   - 该主题的起源与发展过程
   - 关键里程碑与转折点

3. 主要发现（详细列出至少8-10个要点）
   - 每个发现应有充分的说明和例证
   - 引用具体数据、研究或信息源

4. 争议点与不同观点
   - 详细分析各方立场及其依据
   - 客观评估各种观点的合理性和限制

5. 技术细节与实现方法（如适用）
   - 当前技术实现的详细分析
   - 各种方法的比较与评估

6. 当前领域状态
   - 最新研究进展与突破
   - 主要参与者与机构
   - 当前面临的挑战与障碍

7. 专家共识与最佳实践
   - 行业公认的标准与方法
   - 成功案例与经验教训

8. 未来发展趋势
   - 预测的发展方向与变革
   - 潜在的机遇与风险

9. 研究局限性
   - 当前研究的不足与局限
   - 数据或方法的可靠性考量

10. 建议的未来研究方向
    - 具体的研究问题与方法建议
    - 为什么这些方向值得探索

请使用学术性、分析性的语言，提供深入的分析而非简单总结。确保你的分析：
- 包含具体的事实、数据和例子
- 引用搜索结果中的具体信息源
- 区分已确认的事实和推测性内容
- 指出信息的可靠性和局限性

研究迭代数据：
${iterationsData}`

      // 确保内容不为空
      if (!iterationsData || iterationsData.trim() === '') {
        return `没有足够的数据来生成关于"${mainQuery}"的研究总结。`
      }

      // 限制输入token数量
      let trimmedData = iterationsData
      const maxInputTokens = this.analysisConfig.maxInputTokens || 200000
      const inputTokens = this.estimateTokens(prompt + trimmedData)

      if (inputTokens > maxInputTokens) {
        console.log(`[DeepResearch] 总结输入超过最大token限制(${inputTokens} > ${maxInputTokens})，进行裁剪`)
        const ratio = maxInputTokens / inputTokens
        const contentTokens = this.estimateTokens(trimmedData)
        const targetContentTokens = Math.floor(contentTokens * ratio) - 1000

        const contentLines = trimmedData.split('\n')
        let currentTokens = 0
        const truncatedLines: string[] = []

        for (const line of contentLines) {
          const lineTokens = this.estimateTokens(line)
          if (currentTokens + lineTokens <= targetContentTokens) {
            truncatedLines.push(line)
            currentTokens += lineTokens
          } else {
            break
          }
        }

        trimmedData = truncatedLines.join('\n')
        console.log(`[DeepResearch] 总结内容已裁剪至约 ${this.estimateTokens(trimmedData)} tokens`)
      }

      const summary = await fetchGenerate({
        prompt,
        content: trimmedData || ' ',
        modelId: this.analysisConfig.modelId
      })

      // 更新token统计
      if (report?.tokenUsage) {
        report.tokenUsage.inputTokens += this.estimateTokens(prompt + trimmedData)
        report.tokenUsage.outputTokens += this.estimateTokens(summary || '')
        report.tokenUsage.totalTokens = report.tokenUsage.inputTokens + report.tokenUsage.outputTokens
      }

      return summary || `无法生成关于 "${mainQuery}" 的研究总结。`
    } catch (error: any) {
      console.error('[DeepResearch] 生成研究总结失败:', error)
      return `生成研究总结时出错: ${error?.message || '未知错误'}`
    }
  }

  /**
   * 生成对原始问题的直接回答
   * @param originalQuery 原始查询
   * @param summary 研究总结
   * @param keyInsights 关键见解
   * @returns 直接回答文本
   */
  private async generateDirectAnswer(
    originalQuery: string,
    summary: string,
    keyInsights: string[],
    report?: ResearchReport
  ): Promise<string> {
    try {
      console.log(`[DeepResearch] 正在生成对原始问题的直接回答`)

      // 使用模型生成直接回答
      const { fetchGenerate } = await import('@renderer/services/ApiService')
      const prompt = `你是一个专业的问题解答专家，负责提供清晰、准确、全面的回答。

用户原始问题: "${originalQuery}"

基于以下研究总结和关键见解，请直接回答用户的问题。你的回答应该：

1. 直接回应用户的原始问题，而不是提供一般性的信息
2. 简洁明确，但包含充分的细节和深度
3. 如果问题有多个方面，请全面考虑每个方面
4. 如果有不同观点，请客观地呈现各种观点
5. 如果问题有具体答案，请直接提供答案
6. 如果问题没有单一答案，请提供最佳建议或解决方案

请在回答中使用二级标题和项目符号来组织内容，使其易于阅读。回答应在500-1000字左右，不要过长。

研究总结：
${summary}

关键见解：
${keyInsights.join('\n')}`

      // 确保内容不为空
      if (!summary || summary.trim() === '') {
        return `没有足够的数据来生成关于"${originalQuery}"的直接回答。`
      }

      const directAnswer = await fetchGenerate({
        prompt,
        content: ' ', // 确保内容不为空
        modelId: this.analysisConfig.modelId // 使用指定的模型
      })

      // 更新token统计
      if (report?.tokenUsage) {
        report.tokenUsage.inputTokens += this.estimateTokens(prompt)
        report.tokenUsage.outputTokens += this.estimateTokens(directAnswer || '')
        report.tokenUsage.totalTokens = report.tokenUsage.inputTokens + report.tokenUsage.outputTokens
      }

      return directAnswer || `无法生成关于 "${originalQuery}" 的直接回答。`
    } catch (error: any) {
      console.error('[DeepResearch] 生成直接回答失败:', error)
      return `生成直接回答时出错: ${error?.message || '未知错误'}`
    }
  }

  /**
   * 提取关键见解
   * @param iterations 所有迭代
   * @returns 关键见解列表
   */
  private async extractKeyInsights(iterations: ResearchIteration[], report?: ResearchReport): Promise<string[]> {
    if (iterations.length === 0) {
      return ['没有足够的研究数据来提取关键见解。']
    }

    try {
      const mainQuery = iterations[0].query

      // 收集所有迭代的分析
      const allAnalyses = iterations.map((iter) => iter.analysis).join('\n\n')

      // 使用模型提取关键见解
      const { fetchGenerate } = await import('@renderer/services/ApiService')
      const prompt = `你是一个高级研究分析师，负责提取全面、深入的关键见解。
请从以下关于"${mainQuery}"的研究分析中，提取 10-20 条最重要的关键见解。

这些见解应该是研究中最有价值、最有洞察力的发现，能够帮助读者全面理解该主题的核心要点。确保见解涵盖不同的角度和方面，包括：

- 核心概念和定义
- 历史背景和发展脉络
- 技术细节和实现方法
- 争议点和不同观点
- 最新进展和突破
- 实际应用和案例
- 挑战和限制
- 未来趋势和发展方向

请仅返回见解列表，每行一条，不要添加编号或其他标记。确保每条见解简洁、清晰、有洞察力。

研究分析内容：
${allAnalyses}`

      // 确保内容不为空
      if (!allAnalyses || allAnalyses.trim() === '') {
        return [`关于${mainQuery}的研究数据不足，无法提取有意义的见解。`, `需要更多的搜索结果来全面分析${mainQuery}。`]
      }

      // 限制输入token数量
      let trimmedAnalyses = allAnalyses
      const maxInputTokens = this.analysisConfig.maxInputTokens || 200000
      const inputTokens = this.estimateTokens(prompt + trimmedAnalyses)

      if (inputTokens > maxInputTokens) {
        console.log(`[DeepResearch] 关键见解输入超过最大token限制(${inputTokens} > ${maxInputTokens})，进行裁剪`)
        const ratio = maxInputTokens / inputTokens
        const contentTokens = this.estimateTokens(trimmedAnalyses)
        const targetContentTokens = Math.floor(contentTokens * ratio) - 1000

        const contentLines = trimmedAnalyses.split('\n')
        let currentTokens = 0
        const truncatedLines: string[] = []

        for (const line of contentLines) {
          const lineTokens = this.estimateTokens(line)
          if (currentTokens + lineTokens <= targetContentTokens) {
            truncatedLines.push(line)
            currentTokens += lineTokens
          } else {
            break
          }
        }

        trimmedAnalyses = truncatedLines.join('\n')
        console.log(`[DeepResearch] 关键见解内容已裁剪至约 ${this.estimateTokens(trimmedAnalyses)} tokens`)
      }

      const result = await fetchGenerate({
        prompt,
        content: trimmedAnalyses || ' ',
        modelId: this.analysisConfig.modelId
      })

      // 更新token统计
      if (report?.tokenUsage) {
        report.tokenUsage.inputTokens += this.estimateTokens(prompt + trimmedAnalyses)
        report.tokenUsage.outputTokens += this.estimateTokens(result || '')
        report.tokenUsage.totalTokens = report.tokenUsage.inputTokens + report.tokenUsage.outputTokens
      }

      if (!result) {
        return [
          `${mainQuery}在多个领域都有重要应用。`,
          `关于${mainQuery}的研究在近年来呈上升趋势。`,
          `${mainQuery}的最佳实践尚未达成共识。`,
          `${mainQuery}的未来发展前景广阔。`
        ]
      }

      // 处理生成的见解
      return result
        .split('\n')
        .map((insight) => insight.trim())
        .filter((insight) => insight.length > 0)
    } catch (error: any) {
      console.error('[DeepResearch] 提取关键见解失败:', error)
      return [
        `${iterations[0].query}在多个领域都有重要应用。`,
        `关于${iterations[0].query}的研究在近年来呈上升趋势。`,
        `${iterations[0].query}的最佳实践尚未达成共识。`,
        `${iterations[0].query}的未来发展前景广阔。`
      ]
    }
  }

  /**
   * 估算文本的token数量
   * @param text 要估算的文本
   * @returns 估算的token数量
   */
  private estimateTokens(text: string): number {
    // 简单估算：英文大约每4个字符为1个token，中文大约每1.5个字符为1个token
    const englishChars = text.replace(/[\u4e00-\u9fa5]/g, '').length
    const chineseChars = text.length - englishChars

    return Math.ceil(englishChars / 4 + chineseChars / 1.5)
  }

  /**
   * 设置分析配置
   * @param config 配置对象
   */
  public setAnalysisConfig(config: Partial<AnalysisConfig>): void {
    this.analysisConfig = {
      ...this.analysisConfig,
      ...config
    }
  }

  /**
   * 清理所有打开的搜索窗口
   */
  private async cleanupSearchWindows(): Promise<void> {
    console.log(`[DeepResearch] 开始清理 ${this.searchWindowIds.length} 个搜索窗口`)

    const closePromises = this.searchWindowIds.map(async (windowId) => {
      try {
        await window.api.searchService.closeSearchWindow(windowId)
        console.log(`[DeepResearch] 已关闭搜索窗口: ${windowId}`)
      } catch (error) {
        console.error(`[DeepResearch] 关闭搜索窗口 ${windowId} 失败:`, error)
      }
    })

    await Promise.all(closePromises)

    // 清空窗口ID列表
    this.searchWindowIds = []
    console.log('[DeepResearch] 所有搜索窗口已清理')
  }

  /**
   * 评估链接相关性并过滤不相关的链接
   * @param results 搜索结果
   * @param query 原始查询
   * @returns 过滤后的相关链接
   */
  private async filterRelevantLinks(results: WebSearchResult[], query: string): Promise<WebSearchResult[]> {
    if (results.length === 0) {
      return results
    }

    try {
      console.log(`[DeepResearch] 开始评估 ${results.length} 个链接的相关性`)

      // 准备批量评估
      const batchPromises: Promise<WebSearchResult & { relevanceScore: number }>[] = results.map(
        async (result): Promise<WebSearchResult & { relevanceScore: number }> => {
          try {
            // 提取链接的基本信息
            const { title, url, content } = result
            // 提取内容的前300个字符作为摘要
            const summary = content.length > 300 ? content.substring(0, 300) + '...' : content

            // 使用模型评估相关性
            const relevanceScore = await this.evaluateLinkRelevance(title, summary, url, query)

            return {
              ...result,
              relevanceScore
            }
          } catch (error) {
            console.error(`[DeepResearch] 评估链接相关性失败:`, error)
            // 如果评估失败，给一个默认的低分
            return {
              ...result,
              relevanceScore: 0.1
            }
          }
        }
      )

      // 等待所有评估完成
      const scoredResults = await Promise.all(batchPromises)

      // 根据相关性阈值过滤结果
      const threshold = this.analysisConfig.linkRelevanceThreshold || 0.6
      const filteredResults = scoredResults.filter((result) => result.relevanceScore >= threshold)

      // 按相关性得分排序
      filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore)

      console.log(
        `[DeepResearch] 链接相关性评估完成，${filteredResults.length}/${results.length} 个链接通过阈值 ${threshold}`
      )

      return filteredResults
    } catch (error) {
      console.error('[DeepResearch] 过滤相关链接时出错:', error)
      return results // 出错时返回原始结果
    }
  }

  /**
   * 评估单个链接的相关性
   * @param title 链接标题
   * @param summary 内容摘要
   * @param url 链接URL
   * @param query 原始查询
   * @returns 相关性得分 (0-1)
   */
  private async evaluateLinkRelevance(title: string, summary: string, url: string, query: string): Promise<number> {
    try {
      // 使用模型评估相关性
      const { fetchGenerate } = await import('@renderer/services/ApiService')

      const prompt = `你是一个专业的链接相关性评估专家，负责判断搜索结果与用户查询的相关程度。

请评估以下链接与用户查询"${query}"的相关性。

链接信息:
标题: ${title}
URL: ${url}
内容摘要: ${summary}

请根据以下标准评估相关性:
1. 链接内容是否直接回答或讨论了用户的查询
2. 链接内容是否提供了与查询相关的有用信息
3. 链接内容的专业性和权威性
4. 链接内容的时效性和准确性

请给出0到1之间的相关性评分，其中:
- 0.9-1.0: 极高相关，完全匹配用户查询需求
- 0.7-0.9: 高度相关，提供了大量相关信息
- 0.5-0.7: 中等相关，有一些相关信息
- 0.3-0.5: 低相关，仅有少量相关信息
- 0.0-0.3: 不相关，与用户查询无关

只返回一个0到1之间的数字作为相关性评分，不要添加任何解释或其他文本。`

      const result = await fetchGenerate({
        prompt,
        content: ' ', // 确保内容不为空
        modelId: this.analysisConfig.linkRelevanceModelId || this.analysisConfig.modelId // 优先使用专门的链接相关性评估模型
      })

      // 解析结果，提取数字
      const score = parseFloat(result.trim())

      // 验证得分是否有效
      if (isNaN(score) || score < 0 || score > 1) {
        console.warn(`[DeepResearch] 无效的相关性评分: ${result}，使用默认值0.5`)
        return 0.5 // 默认中等相关性
      }

      return score
    } catch (error) {
      console.error('[DeepResearch] 评估链接相关性失败:', error)
      return 0.5 // 出错时返回默认中等相关性
    }
  }
}

export default DeepResearchProvider
