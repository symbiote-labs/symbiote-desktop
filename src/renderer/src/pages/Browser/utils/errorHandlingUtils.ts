import { WebviewErrorType } from '../components/WebviewError'

/**
 * 创建错误状态对象，用于更新标签页状态
 * @param errorType 错误类型
 * @param errorData 错误数据
 * @returns 错误状态对象
 */
export function createErrorState(
  errorType: WebviewErrorType,
  errorData: {
    errorCode?: number
    errorDescription?: string
    validatedURL?: string
    reason?: string
    exitCode?: number
  }
) {
  return {
    hasError: true,
    errorType,
    errorData
  }
}

/**
 * 处理webview加载错误
 * @param errorCode 错误代码
 * @param errorDescription 错误描述
 * @param validatedURL 验证的URL
 * @returns 错误状态对象
 */
export function handleWebviewLoadError(errorCode: number, errorDescription: string, validatedURL: string) {
  console.log(`[errorHandlingUtils] Load error: ${errorCode}, ${errorDescription}, ${validatedURL}`)

  return createErrorState(WebviewErrorType.LOAD_ERROR, {
    errorCode,
    errorDescription,
    validatedURL
  })
}

/**
 * 处理webview渲染进程崩溃
 * @param reason 崩溃原因
 * @param exitCode 退出代码
 * @returns 错误状态对象
 */
export function handleWebviewCrash(reason: string, exitCode: number) {
  console.log(`[errorHandlingUtils] Crash: ${reason}, ${exitCode}`)

  return createErrorState(WebviewErrorType.CRASH, {
    reason,
    exitCode
  })
}

/**
 * 处理webview未响应
 * @returns 错误状态对象
 */
export function handleWebviewUnresponsive() {
  console.log('[errorHandlingUtils] Unresponsive')

  return createErrorState(WebviewErrorType.UNRESPONSIVE, {})
}

/**
 * 重置错误状态
 * @returns 重置后的错误状态对象
 */
export function resetErrorState() {
  return {
    hasError: false,
    errorType: null,
    errorData: null
  }
}
