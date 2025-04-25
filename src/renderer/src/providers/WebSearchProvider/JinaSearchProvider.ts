import { WebSearchState } from '@renderer/store/websearch'
import { WebSearchProvider, WebSearchResponse } from '@renderer/types'

import BaseWebSearchProvider from './BaseWebSearchProvider'

export default class JinaSearchProvider extends BaseWebSearchProvider {
  constructor(provider: WebSearchProvider) {
    super(provider)
    if (!this.apiKey) {
      throw new Error('API key is required for Jina provider')
    }
  }

  /**
   * 使用Jina Search API搜索
   * @param query 搜索查询
   * @param topK 返回结果数量
   * @param searchType 搜索类型
   * @returns 搜索结果
   */
  private async searchWithJinaS(query: string, options: any): Promise<any> {
    // 构建URL，使用查询参数
    const url = new URL('https://s.jina.ai/')

    // 根据Jina API文档，正确的请求方式是POST请求体中包含q参数
    const requestBody: any = {
      q: query
    }

    // 添加其他参数
    if (options.topK) {
      requestBody['num'] = options.topK
    }

    if (options.country) {
      requestBody['gl'] = options.country
    }

    if (options.locale) {
      requestBody['hl'] = options.locale.split('-')[0] // 只取语言代码部分，如zh-CN取zh
    }

    console.log('Jina Search API URL:', url.toString())
    console.log('Jina Search API Request Body:', requestBody)

    // 构建请求头
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    }

    // 添加可选请求头
    if (options.noCache) {
      headers['X-No-Cache'] = 'true'
    }

    if (options.withFavicon) {
      headers['X-With-Favicons'] = 'true'
    }

    if (options.withLinks) {
      headers['X-With-Links-Summary'] = 'true'
    }

    if (options.withImages) {
      headers['X-With-Images-Summary'] = 'true'
    }

    if (options.returnFormat) {
      headers['X-Return-Format'] = options.returnFormat
    }

    if (options.engine) {
      headers['X-Engine'] = options.engine
    }

    if (options.site) {
      headers['X-Site'] = options.site
    }

    if (options.timeout) {
      headers['X-Timeout'] = options.timeout.toString()
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Jina search failed with status ${response.status}: ${errorText}`)
    }

    // 尝试解析响应为JSON，如果失败则作为文本处理
    let data: any
    const responseText = await response.text()
    try {
      data = JSON.parse(responseText)
      return data
    } catch (error) {
      console.log('Search response is not JSON, treating as text:', responseText)
      // 如果不是JSON，则将文本转换为我们需要的格式
      const lines = responseText.split('\n')
      let title = 'Jina Search Result'
      let url = ''
      const content = responseText

      // 尝试从文本中提取标题和URL
      for (const line of lines) {
        if (line.startsWith('Title:')) {
          title = line.substring(6).trim()
        } else if (line.startsWith('URL:') || line.startsWith('http')) {
          url = line.replace('URL:', '').trim()
        }
      }

      // 创建一个模拟的搜索结果数组
      return [
        {
          title,
          url,
          content
        }
      ]
    }
  }

  /**
   * 使用Jina Reader API读取网页内容
   * @param url 网页URL
   * @param useReranker 是否使用重排序
   * @returns 网页内容
   */
  private async readWithJinaR(url: string, options: any): Promise<any> {
    // 构建Jina Reader API URL
    const readerUrl = new URL(`https://r.jina.ai/${url}`)

    console.log('Jina Reader API URL:', readerUrl.toString())

    // 构建请求头
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json' // 添加 Content-Type
    }

    // 添加可选请求头
    if (options.useReranker !== undefined) {
      headers['X-Use-Reranker'] = options.useReranker ? 'true' : 'false'
    }

    if (options.returnFormat) {
      headers['X-Return-Format'] = options.returnFormat
    } else {
      headers['X-Return-Format'] = 'markdown'
    }

    if (options.withLinks) {
      headers['X-With-Links-Summary'] = 'true'
    }

    if (options.withImages) {
      headers['X-With-Images-Summary'] = 'true'
    }

    if (options.noCache) {
      headers['X-No-Cache'] = 'true'
    }

    if (options.engine) {
      headers['X-Engine'] = options.engine
    }

    if (options.timeout) {
      headers['X-Timeout'] = options.timeout.toString()
    }

    if (options.locale) {
      headers['X-Locale'] = options.locale
    }

    // 添加 Reader API 特有请求头
    if (options.removeSelectors) {
      headers['X-Remove-Selector'] = options.removeSelectors
    }
    if (options.targetSelectors) {
      headers['X-Target-Selector'] = options.targetSelectors
    }
    if (options.waitForSelectors) {
      headers['X-Wait-For-Selector'] = options.waitForSelectors
    }
    if (options.withGeneratedAlt) {
      headers['X-With-Generated-Alt'] = options.withGeneratedAlt ? 'true' : 'false'
    }
    if (options.withIframe) {
      headers['X-With-Iframe'] = options.withIframe ? 'true' : 'false'
    }
    if (options.tokenBudget) {
      headers['X-Token-Budget'] = options.tokenBudget.toString()
    }
    if (options.retainImages) {
      headers['X-Retain-Images'] = options.retainImages
    }
    if (options.respondWith) {
      headers['X-Respond-With'] = options.respondWith
    }
    if (options.proxy) {
      headers['X-Proxy'] = options.proxy
    }
    if (options.country) {
      // 将 country 映射到 X-Proxy
      headers['X-Proxy'] = options.country
    }
    if (options.dnt) {
      headers['DNT'] = options.dnt ? '1' : '0'
    }
    if (options.noGfm) {
      headers['X-No-Gfm'] = options.noGfm ? 'true' : 'false'
    }
    if (options.robotsTxt) {
      headers['X-Robots-Txt'] = options.robotsTxt
    }
    if (options.withShadowDom) {
      headers['X-With-Shadow-Dom'] = options.withShadowDom ? 'true' : 'false'
    }
    if (options.base) {
      headers['X-Base'] = options.base
    }
    if (options.mdHeadingStyle) {
      headers['X-Md-Heading-Style'] = options.mdHeadingStyle
    }
    if (options.mdHr) {
      headers['X-Md-Hr'] = options.mdHr
    }
    if (options.mdBulletListMarker) {
      headers['X-Md-Bullet-List-Marker'] = options.mdBulletListMarker
    }
    if (options.mdEmDelimiter) {
      headers['X-Md-Em-Delimiter'] = options.mdEmDelimiter
    }
    if (options.mdStrongDelimiter) {
      headers['X-Md-Strong-Delimiter'] = options.mdStrongDelimiter
    }
    if (options.mdLinkStyle) {
      headers['X-Md-Link-Style'] = options.mdLinkStyle
    }
    if (options.mdLinkReferenceStyle) {
      headers['X-Md-Link-Reference-Style'] = options.mdLinkReferenceStyle
    }
    if (options.setCookie) {
      headers['X-Set-Cookie'] = options.setCookie
    }
    if (options.proxyUrl) {
      headers['X-Proxy-Url'] = options.proxyUrl
    }

    const requestBody: any = {
      url: url // Reader API 请求体需要 url 参数
    }

    // 添加请求体可选参数
    if (options.viewport) {
      requestBody['viewport'] = options.viewport
    }
    if (options.injectPageScript) {
      requestBody['injectPageScript'] = options.injectPageScript
    }

    const response = await fetch(readerUrl.toString(), {
      method: 'POST', // 改为 POST
      headers,
      body: JSON.stringify(requestBody) // 添加 body
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Jina reader failed with status ${response.status}: ${errorText}`)
    }

    // 尝试解析响应为JSON，如果失败则作为文本处理
    let data: any
    const responseText = await response.text()
    try {
      data = JSON.parse(responseText)
      return data
    } catch (error) {
      console.log('Reader response is not JSON, treating as text:', responseText)
      // 如果不是JSON，则将文本转换为我们需要的格式
      const lines = responseText.split('\n')
      let title = 'Jina Reader Result'
      let url = readerUrl.toString()
      const content = responseText

      // 尝试从文本中提取标题和URL
      for (const line of lines) {
        if (line.startsWith('Title:')) {
          title = line.substring(6).trim()
        } else if (line.startsWith('URL:') || line.startsWith('http')) {
          url = line.replace('URL:', '').trim()
        }
      }

      // 创建一个模拟的JSON响应
      return {
        data: {
          title,
          url,
          content
        }
      }
    }
  }

  public async search(query: string, websearch: WebSearchState): Promise<WebSearchResponse> {
    try {
      if (!query.trim()) {
        throw new Error('Search query cannot be empty')
      }

      // 使用提供商特定配置或默认值
      const topK = this.provider.topK || Math.max(1, websearch.maxResults)
      const searchType = this.provider.searchType || 'hybrid'
      const useReranker = this.provider.useReranker !== false // 默认为true
      const apiEndpoint = this.provider.apiEndpoint || 'search' // 默认使用搜索API

      // 根据选择的API端点使用不同的API
      if (apiEndpoint === 'search') {
        // 使用Jina Search API
        console.log('Using Jina Search API (s.jina.ai)...')

        // 构建搜索选项
        const searchOptions = {
          topK,
          searchType,
          useReranker,
          locale: this.provider.locale,
          country: this.provider.country,
          timeout: this.provider.timeout,
          noCache: this.provider.noCache,
          withFavicon: this.provider.withFavicon,
          withLinks: this.provider.withLinks,
          withImages: this.provider.withImages,
          returnFormat: this.provider.returnFormat,
          engine: this.provider.engine,
          site: this.provider.site,
          jsonResponse: this.provider.jsonResponse,
          fetchFavicons: this.provider.fetchFavicons
        }

        try {
          const searchResults = await this.searchWithJinaS(query, searchOptions)

          if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
            console.log('Jina Search API successful')
            return {
              query,
              results: searchResults.map((result: any) => ({
                title: result.title || 'No title',
                content: result.content || result.snippet || '',
                url: result.url || '',
                source: 'Jina'
              }))
            }
          } else {
            throw new Error('No search results returned')
          }
        } catch (searchError) {
          console.warn('Jina Search API failed:', searchError)
          throw searchError
        }
      } else {
        // 使用Jina Reader API
        console.log('Using Jina Reader API (r.jina.ai)...')

        // 使用Google搜索URL
        const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`

        // 构建Reader选项
        const readerOptions = {
          useReranker,
          locale: this.provider.locale,
          country: this.provider.country,
          timeout: this.provider.timeout,
          noCache: this.provider.noCache,
          withLinks: this.provider.withLinks,
          withImages: this.provider.withImages,
          returnFormat: this.provider.returnFormat,
          engine: this.provider.engine,
          removeSelectors: this.provider.removeSelectors,
          targetSelectors: this.provider.targetSelectors,
          waitForSelectors: this.provider.waitForSelectors,
          withGeneratedAlt: this.provider.withGeneratedAlt,
          withIframe: this.provider.withIframe,
          tokenBudget: this.provider.tokenBudget,
          retainImages: this.provider.retainImages,
          respondWith: this.provider.respondWith,
          proxy: this.provider.proxy
        }

        try {
          // 调用readWithJinaR方法
          const readerResult = await this.readWithJinaR(googleSearchUrl, readerOptions)
          return this.processReaderResult(readerResult, query)
        } catch (readerError) {
          console.warn('Jina Reader API failed:', readerError)
          throw readerError
        }
      }
    } catch (error) {
      console.error('Jina search failed:', error)
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * 处理Reader API的响应结果
   * @param responseData Reader API的响应结果
   * @param query 搜索查询
   * @returns 处理后的搜索响应
   */
  private processReaderResult(responseData: any, query: string): WebSearchResponse {
    console.log('Processing Jina Reader response:', responseData)

    // 处理Jina API的响应格式
    if (responseData && typeof responseData === 'object') {
      // 如果是Reader API响应 (r.jina.ai)
      if (responseData.data && responseData.data.content) {
        const content = responseData.data.content || ''
        const title = responseData.data.title || 'Jina Reader Result'
        const url = responseData.data.url || 'https://example.com'

        return {
          query,
          results: [
            {
              title: title,
              content: content,
              url: url,
              source: 'Jina'
            }
          ]
        }
      }
      // 如果是Search API响应 (s.jina.ai)
      else if (responseData.data && Array.isArray(responseData.data)) {
        return {
          query,
          results: responseData.data.map((result: any) => ({
            title: result.title || 'No title',
            content: result.content || result.description || '',
            url: result.url || '',
            source: 'Jina'
          }))
        }
      }
      // 如果是旧格式的Search API响应
      else if (responseData.results && Array.isArray(responseData.results)) {
        return {
          query,
          results: responseData.results.map((result: any) => ({
            title: result.title || 'No title',
            content: result.content || result.snippet || '',
            url: result.url || '',
            source: 'Jina'
          }))
        }
      }
      // 如果是数组格式
      else if (Array.isArray(responseData)) {
        return {
          query,
          results: responseData.map((result: any) => ({
            title: result.title || 'No title',
            content: result.content || result.text || '',
            url: result.url || '',
            source: 'Jina'
          }))
        }
      }
    }

    // 如果响应格式不符合预期，尝试提取有用信息
    console.warn('Unexpected Jina search response format:', responseData)
    return {
      query,
      results: [
        {
          title: 'Jina Search Result',
          content: typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
          url: '',
          source: 'Jina'
        }
      ]
    }
  }
}
