import { useEffect } from 'react'
import WebSearchService from '@renderer/services/WebSearchService'

/**
 * 初始化WebSearch服务的组件
 * 确保DeepSearch供应商被添加到列表中
 */
const WebSearchInitializer = () => {
  useEffect(() => {
    // 触发WebSearchService的初始化
    // 这将确保DeepSearch供应商被添加到列表中
    WebSearchService.getWebSearchProvider()
    console.log('[WebSearchInitializer] 初始化WebSearch服务')
  }, [])

  // 这个组件不渲染任何内容
  return null
}

export default WebSearchInitializer
