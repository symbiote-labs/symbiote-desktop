// 从 renderer 导入的类型定义
import { ResearchIteration, ResearchReport, WebSearchResult } from '../../renderer/src/types'

// 定义 WebSearchState 接口
export interface WebSearchState {
  defaultProvider: string
  providers: WebSearchProvider[]
  provider?: WebSearchProvider // 当前选中的提供商
  searchWithTime: boolean
  maxResults: number
  excludeDomains: string[]
  enhanceMode: boolean
  overwrite: boolean
  deepResearchConfig?: {
    maxIterations?: number
    maxResultsPerQuery?: number
    autoSummary?: boolean
    enableQueryOptimization?: boolean
    modelId?: string
  }
  deepSearchConfig?: {
    enabledEngines: {
      [key: string]: boolean
    }
  }
}

// 定义 WebSearchProvider 接口
export interface WebSearchProvider {
  id: string
  name: string
  apiKey?: string
  apiHost?: string
  engines?: string[]
  url?: string
  contentLimit?: number
  usingBrowser?: boolean
  description?: string
  category?: string
}

// 定义 WebSearchResponse 接口
export interface WebSearchResponse {
  query?: string
  results: WebSearchResult[]
}

export type { ResearchIteration, ResearchReport, WebSearchResult }
