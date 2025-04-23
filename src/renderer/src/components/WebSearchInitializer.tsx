import { RootState } from '@renderer/store'
import { addWebSearchProvider } from '@renderer/store/websearch'
import { WebSearchProvider } from '@renderer/types'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

/**
 * WebSearchInitializer组件
 * 用于在应用启动时初始化WebSearchService
 * 确保DeepSearch在应用启动时被正确设置
 */
const WebSearchInitializer = () => {
  const dispatch = useDispatch()
  const providers = useSelector((state: RootState) => state.websearch.providers)

  useEffect(() => {
    // 检查是否已经存在DeepSearch提供商
    const hasDeepSearch = providers.some((provider) => provider.id === 'deep-search')

    // 如果不存在，添加DeepSearch提供商
    if (!hasDeepSearch) {
      const deepSearchProvider: WebSearchProvider = {
        id: 'deep-search',
        name: 'DeepSearch',
        usingBrowser: true,
        contentLimit: 10000,
        description: '多引擎深度搜索'
      }
      dispatch(addWebSearchProvider(deepSearchProvider))
    }
  }, [dispatch, providers])

  // 这是一个初始化组件，不需要渲染任何UI
  return null
}

export default WebSearchInitializer
