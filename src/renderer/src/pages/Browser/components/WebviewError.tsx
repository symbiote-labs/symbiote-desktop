import React from 'react'
import styled from 'styled-components'

// 错误类型
export enum WebviewErrorType {
  LOAD_ERROR = 'load_error',
  CRASH = 'crash',
  UNRESPONSIVE = 'unresponsive'
}

// 错误页面属性
interface WebviewErrorProps {
  type: WebviewErrorType
  errorCode?: number
  errorDescription?: string
  validatedURL?: string
  reason?: string
  exitCode?: number
  onReload?: () => void
  onGoBack?: () => void
}

// 样式化组件
const ErrorContainer = styled.div`
  text-align: center;
  padding: 20px;
  font-family:
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    sans-serif;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #f8f9fa;
`

const ErrorTitle = styled.h2`
  color: #555;
  margin-bottom: 10px;
`

const ErrorURL = styled.p`
  color: #777;
  margin-bottom: 20px;
  word-break: break-all;
  max-width: 80%;
`

const ErrorMessage = styled.p`
  color: #777;
  margin-bottom: 10px;
`

const ErrorCode = styled.p`
  color: #777;
  margin-top: 20px;
  font-size: 0.9em;
`

const ButtonContainer = styled.div`
  margin-top: 20px;
  display: flex;
  gap: 10px;
`

const ReloadButton = styled.button`
  background: #4285f4;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: #3b78e7;
  }
`

const BackButton = styled.button`
  background: #f1f3f4;
  color: #444;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;

  &:hover {
    background: #e8eaed;
  }
`

/**
 * Webview错误页面组件
 * 用于显示加载错误、崩溃和未响应等情况
 */
const WebviewError: React.FC<WebviewErrorProps> = ({
  type,
  errorCode,
  errorDescription,
  validatedURL,
  reason,
  exitCode,
  onReload,
  onGoBack
}) => {
  // 获取错误消息
  const getErrorMessage = () => {
    // 常见错误代码映射
    const errorMessages: Record<number, string> = {
      // 网络错误
      [-2]: 'Failed to connect to the server.',
      [-3]: 'The server unexpectedly dropped the connection.',
      [-4]: 'A network change was detected.',
      [-6]: 'The connection was closed.',
      [-7]: 'The server response was invalid.',
      [-21]: 'Network connection timed out.',
      [-101]: 'The server denied the connection.',
      [-102]: 'The server closed the connection without sending any data.',
      [-104]: 'Connection reset.',
      [-105]: 'The server unexpectedly closed the connection or DNS address could not be found.',
      [-106]: 'Connection timed out.',
      [-109]: 'Address unreachable.',
      [-138]: 'The server closed the connection without sending any data.',

      // DNS错误
      [-137]: 'The server hostname could not be resolved.',

      // HTTP错误
      [-200]: 'The SSL certificate is invalid.',
      [-201]: "The server's certificate is not trusted.",
      [-202]: "The server's certificate has expired.",
      [-203]: "The server's certificate is not valid yet.",
      [-204]: "The server's certificate has been revoked.",
      [-205]: "The server's certificate is invalid.",
      [-206]: "The server's certificate does not match the server's hostname.",

      // 缓存错误
      [-400]: 'The cache does not exist.',
      [-401]: 'The cache was unable to read the resource.',
      [-402]: 'The cache was unable to write the resource.',

      // FTP错误
      [-600]: 'There was a malformed FTP response.',
      [-601]: 'FTP command not supported by the server.',
      [-602]: 'The server denied the FTP connection.',
      [-603]: 'The FTP connection was closed.',
      [-604]: 'The FTP server denied the data connection.',
      [-605]: 'The FTP data connection was closed.',

      // 其他错误
      [-300]: 'The URL is invalid.',
      [-301]: 'The scheme of the URL is disallowed.',
      [-302]: 'The scheme of the URL is unknown.',
      [-303]: 'The URL is too long.',
      [-310]: 'The server redirect was invalid.',
      [-501]: "The server's response was insecure.",
      [-800]: 'The server sent an invalid or unrecognized response.',
      [-801]: 'The server sent an incomplete response.',
      [-802]: 'The server sent a response that was too large.',
      [-900]: 'The request was canceled.',
      [-901]: 'The request failed because of a network change.',
      [-902]: 'The request was blocked by the client.',
      [-903]: 'The request was blocked by the server.'
    }

    if (type === WebviewErrorType.LOAD_ERROR && errorCode !== undefined) {
      return errorMessages[errorCode] || errorDescription || 'An unknown error occurred.'
    } else if (type === WebviewErrorType.CRASH) {
      return `The page has crashed due to a problem. Reason: ${reason || 'Unknown'}`
    } else if (type === WebviewErrorType.UNRESPONSIVE) {
      return 'The page is not responding. You can wait for it to become responsive or reload the page.'
    }

    return 'An unknown error occurred.'
  }

  // 获取标题
  const getTitle = () => {
    switch (type) {
      case WebviewErrorType.LOAD_ERROR:
        return "This page isn't working"
      case WebviewErrorType.CRASH:
        return 'Page crashed'
      case WebviewErrorType.UNRESPONSIVE:
        return 'Page not responding'
      default:
        return 'Error'
    }
  }

  // 处理重新加载
  const handleReload = () => {
    if (onReload) {
      onReload()
    }
  }

  // 处理返回
  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack()
    }
  }

  return (
    <ErrorContainer>
      <ErrorTitle>{getTitle()}</ErrorTitle>

      {validatedURL && <ErrorURL>{validatedURL}</ErrorURL>}

      <ErrorMessage>{getErrorMessage()}</ErrorMessage>

      {type === WebviewErrorType.LOAD_ERROR && errorCode !== undefined && (
        <ErrorCode>Error code: {errorCode}</ErrorCode>
      )}

      {type === WebviewErrorType.CRASH && exitCode !== undefined && <ErrorCode>Exit code: {exitCode}</ErrorCode>}

      <ButtonContainer>
        <ReloadButton onClick={handleReload}>Reload</ReloadButton>
        {onGoBack && <BackButton onClick={handleGoBack}>Go back</BackButton>}
      </ButtonContainer>
    </ErrorContainer>
  )
}

export default WebviewError
