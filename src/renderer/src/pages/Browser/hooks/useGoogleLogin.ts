import { WebviewTag } from 'electron'
import { useEffect, useState } from 'react'

export const useGoogleLogin = (currentUrl: string, activeTabId: string, webviewRef: React.RefObject<WebviewTag>) => {
  // 检测Google登录页面
  const [showGoogleLoginTip, setShowGoogleLoginTip] = useState(false)

  // 添加是否已经手动关闭提示的状态
  const [googleTipDismissed, setGoogleTipDismissed] = useState(false)

  // 处理关闭Google登录提示
  const handleCloseGoogleTip = () => {
    setGoogleTipDismissed(true)
    setShowGoogleLoginTip(false)
  }

  // 处理Google登录
  const handleGoogleLogin = () => {
    if (webviewRef.current) {
      // 使用Google移动版登录页面，检测可能不那么严格
      const mobileLoginUrl =
        'https://accounts.google.com/signin/v2/identifier?hl=zh-CN&flowName=GlifWebSignIn&flowEntry=ServiceLogin&service=mail&continue=https://mail.google.com/mail/&rip=1&TL=AM3QAYbxUXwQx_6Jq_0I5HwQZvPcnVOJ1mKZQjwPXpR7LWiKGdz8ZLVEwgfTUPg4&platform=mobile'
      webviewRef.current.loadURL(mobileLoginUrl)
    }
  }

  // 检测Google登录页面
  useEffect(() => {
    // 检测是否是Google登录页面
    if (currentUrl.includes('accounts.google.com') && !googleTipDismissed) {
      setShowGoogleLoginTip(true)

      // 如果是Google登录页面，添加最小化的处理
      if (webviewRef.current) {
        const webview = webviewRef.current

        // 最小化的脚本，只设置必要的cookie
        webview.executeJavaScript(`
          // 设置必要的cookie
          document.cookie = "CONSENT=YES+; domain=.google.com; path=/; expires=" + new Date(Date.now() + 86400000).toUTCString();

          // 检查是否显示了错误消息
          if (document.body.textContent.includes('无法登录') || document.body.textContent.includes('不安全')) {
            // 如果有错误，尝试使用移动版登录页面
            console.log('检测到登录错误，将尝试使用移动版登录页面');
          }

          console.log('最小化的Google登录处理脚本已注入');
        `)
      }
    } else if (!currentUrl.includes('accounts.google.com')) {
      // 只有当URL不再是Google登录页面时，重置dismissed状态
      setGoogleTipDismissed(false)
      setShowGoogleLoginTip(false)
    }
  }, [currentUrl, activeTabId, googleTipDismissed, webviewRef])

  return {
    showGoogleLoginTip,
    handleCloseGoogleTip,
    handleGoogleLogin
  }
}
