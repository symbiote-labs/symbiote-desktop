import React, { useCallback } from 'react'
import styled from 'styled-components'

import { resetErrorState } from '../utils/errorHandlingUtils'
import WebviewError, { WebviewErrorType } from './WebviewError'

// 错误容器样式
const ErrorContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10;
  background-color: #f8f9fa;
  display: flex; // Add display flex for centering content
  flex-direction: column; // Arrange content vertically
  justify-content: center; // Center content vertically
  align-items: center; // Center content horizontally
  padding: 20px; // Add some padding
  box-sizing: border-box; // Include padding in element's total width and height
`

// 错误容器属性
interface WebviewErrorContainerProps {
  tabId: string
  hasError: boolean
  errorType: WebviewErrorType | null
  errorData: any
  updateTabInfo: (tabId: string, updates: any) => void
  onReload: (tabId: string) => void
  onGoBack: (tabId: string) => void
}

/**
 * Webview错误容器组件
 * 用于在WebviewItem中显示错误
 */
const WebviewErrorContainer: React.FC<WebviewErrorContainerProps> = ({
  tabId,
  hasError,
  errorType,
  errorData,
  updateTabInfo,
  onReload,
  onGoBack
}) => {
  // 将 useCallback 移到条件判断之前
  // 处理重新加载
  const handleReload = useCallback(() => {
    console.log(`[WebviewErrorContainer] Reloading tab: ${tabId}`)

    // 重置错误状态
    updateTabInfo(tabId, resetErrorState())

    // 调用重新加载回调
    onReload(tabId)
  }, [tabId, updateTabInfo, onReload]) // 依赖项正确

  // 将 useCallback 移到条件判断之前
  // 处理返回
  const handleGoBack = useCallback(() => {
    console.log(`[WebviewErrorContainer] Going back from tab: ${tabId}`)

    // 重置错误状态
    updateTabInfo(tabId, resetErrorState())

    // 调用返回回调
    onGoBack(tabId)
  }, [tabId, updateTabInfo, onGoBack]) // 依赖项正确

  // 如果没有错误，不显示任何内容
  if (!hasError || !errorType) {
    return null
  }

  // 根据 errorType 决定是否显示“返回”按钮
  const showGoBackButton = errorType === WebviewErrorType.UNRESPONSIVE // 根据旧的HTML生成逻辑推断，只有未响应页面有返回按钮

  return (
    <ErrorContainer>
      <WebviewError
        type={errorType}
        errorCode={errorData?.errorCode}
        errorDescription={errorData?.errorDescription}
        validatedURL={errorData?.validatedURL}
        reason={errorData?.reason}
        exitCode={errorData?.exitCode}
        onReload={handleReload}
        // 只有当需要显示返回按钮时才传递 onGoBack prop
        onGoBack={showGoBackButton ? handleGoBack : undefined}
      />
    </ErrorContainer>
  )
}

export default WebviewErrorContainer
