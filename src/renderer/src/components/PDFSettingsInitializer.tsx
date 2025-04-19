import { useSettings } from '@renderer/hooks/useSettings'
import store from '@renderer/store'
import { setPdfSettings } from '@renderer/store/settings'
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'

/**
 * 用于在应用启动时初始化PDF设置
 */
const PDFSettingsInitializer = () => {
  const dispatch = useDispatch()
  const { pdfSettings } = useSettings()

  // 默认PDF设置
  const defaultPdfSettings = {
    enablePdfSplitting: true,
    defaultPageRangePrompt: '输入页码范围，例如：1-5,8,10-15'
  }

  useEffect(() => {
    console.log('[PDFSettingsInitializer] Initializing PDF settings')
    // 强制初始化PDF设置，确保 enablePdfSplitting 存在且为 true
    console.log('[PDFSettingsInitializer] Current pdfSettings:', pdfSettings)

    // 创建合并的设置
    const mergedSettings = {
      ...defaultPdfSettings,
      ...pdfSettings,
      // 强制设置 enablePdfSplitting 为 true
      enablePdfSplitting: true
    }

    console.log('[PDFSettingsInitializer] Forcing initialization with settings:', mergedSettings)
    dispatch(setPdfSettings(mergedSettings))

    // 延迟1秒后再次检查设置，确保它们已经被正确应用
    const timer = setTimeout(() => {
      const state = store.getState()
      console.log('[PDFSettingsInitializer] Checking settings after delay:', state.settings.pdfSettings)

      // 如果设置仍然不正确，再次强制设置
      if (!state.settings.pdfSettings?.enablePdfSplitting) {
        console.log('[PDFSettingsInitializer] Settings still incorrect, forcing again')
        dispatch(
          setPdfSettings({
            ...state.settings.pdfSettings,
            enablePdfSplitting: true
          })
        )
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  return null
}

export default PDFSettingsInitializer
