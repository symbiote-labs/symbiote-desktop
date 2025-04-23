import { RootState } from '@renderer/store'
import { updateProvider } from '@renderer/store/llm'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'

/**
 * GeminiInitializer组件
 * 用于在应用启动时检查Gemini API的配置
 * 如果没有配置API密钥，则禁用Gemini API
 */
const GeminiInitializer = () => {
  const dispatch = useDispatch()
  const providers = useSelector((state: RootState) => state.llm.providers)

  useEffect(() => {
    // 检查Gemini提供商
    const geminiProvider = providers.find((provider) => provider.id === 'gemini')

    // 如果Gemini提供商存在且已启用，但没有API密钥，则禁用它
    if (geminiProvider && geminiProvider.enabled && !geminiProvider.apiKey) {
      dispatch(
        updateProvider({
          ...geminiProvider,
          enabled: false
        })
      )
      console.log('Gemini API disabled due to missing API key')
    }
  }, [dispatch, providers])

  // 这是一个初始化组件，不需要渲染任何UI
  return null
}

export default GeminiInitializer
