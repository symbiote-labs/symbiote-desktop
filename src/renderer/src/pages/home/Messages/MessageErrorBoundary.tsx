import { Alert } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  fallback?: React.ReactNode
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

const ErrorFallback = ({ fallback, error }: { fallback?: React.ReactNode; error?: Error }) => {
  const { t } = useTranslation()

  // 如果有详细错误信息，添加到描述中
  const errorDescription =
    process.env.NODE_ENV !== 'production' && error
      ? `${t('error.render.description')}: ${error.message}`
      : t('error.render.description')

  return fallback || <Alert message={t('error.render.title')} description={errorDescription} type="error" showIcon />
}

class MessageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  // 正确缩进 componentDidCatch
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the detailed error information to the console
    console.error('MessageErrorBoundary caught an error:', error, errorInfo)

    // 如果是特定错误，记录更多信息
    if (error.message === 'rememberInstructions is not defined') {
      console.warn('Known issue with rememberInstructions detected in MessageErrorBoundary')
    } else if (error.message === 'network error') {
      console.warn('Network error detected in MessageErrorBoundary')
    } else if (
      typeof error.message === 'string' &&
      (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('connection'))
    ) {
      console.warn('Network-related error detected in MessageErrorBoundary:', error.message)
    }
  }

  // 正确缩进 render
  render() {
    if (this.state.hasError) {
      return <ErrorFallback fallback={this.props.fallback} error={this.state.error} />
    }
    return this.props.children
  }
} // MessageErrorBoundary 类的结束括号，已删除多余的括号

export default MessageErrorBoundary
