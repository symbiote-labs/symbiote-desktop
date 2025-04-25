import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  BugOutlined,
  CloseOutlined,
  DeleteOutlined,
  ExportOutlined,
  HomeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { Button, Input, Space, Tabs, Tooltip } from 'antd'
import { WebviewTag } from 'electron'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const BrowserContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`

const NavBar = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--color-bg-1);
  border-bottom: 1px solid var(--color-border);
  -webkit-app-region: drag; /* 允许拖动窗口 */
`

const AddressBar = styled(Input)`
  flex: 1;
  margin: 0 12px;
  max-width: calc(75% - 320px); // 减少四分之一的长度
  -webkit-app-region: no-drag; /* 确保输入框可以正常交互 */
`

const TabsContainer = styled.div`
  background-color: var(--color-bg-1);
  border-bottom: 1px solid var(--color-border);

  .ant-tabs-nav {
    margin-bottom: 0;
  }

  .ant-tabs-tab {
    padding: 8px 16px;

    .anticon-close {
      margin-left: 8px;
      font-size: 12px;
      opacity: 0.5;

      &:hover {
        opacity: 1;
      }
    }
  }

  .add-tab-button {
    margin: 0 8px;
    padding: 0 8px;
    background: transparent;
    border: none;
    cursor: pointer;

    &:hover {
      color: var(--color-primary);
    }
  }
`

const WebviewContainer = styled.div`
  flex: 1;
  height: calc(100% - 90px); // 调整高度以适应选项卡
  position: relative;

  .webview-wrapper {
    width: 100%;
    height: 100%;
    display: none;

    &.active {
      display: block;
    }
  }

  & webview {
    width: 100%;
    height: 100%;
  }
`

const GoogleLoginTip = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 10px;
  z-index: 1000;
  display: flex;
  justify-content: center;

  .tip-content {
    max-width: 600px;
    text-align: center;

    p {
      margin-bottom: 10px;
    }
  }
`

// 全局变量，控制是否禁用安全限制
const DISABLE_SECURITY = true // 设置为true表示禁用安全限制，false表示启用安全限制

// 定义选项卡接口
interface Tab {
  id: string
  title: string
  url: string
  favicon?: string
  isLoading: boolean
  canGoBack: boolean
  canGoForward: boolean
}

const Browser = () => {
  const { t } = useTranslation()

  // 选项卡状态管理
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: '1',
      title: 'Google',
      url: 'https://www.google.com',
      isLoading: false,
      canGoBack: false,
      canGoForward: false
    }
  ])
  const [activeTabId, setActiveTabId] = useState('1')

  // 获取当前活动选项卡
  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0]

  // 兼容旧代码的状态
  const [url, setUrl] = useState(activeTab.url)
  const [currentUrl, setCurrentUrl] = useState('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // 使用对象存储多个webview引用
  const webviewRefs = useRef<Record<string, WebviewTag | null>>({})

  // 获取当前活动的webview引用
  const webviewRef = {
    current: webviewRefs.current[activeTabId] || null
  } as React.RefObject<WebviewTag>

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    const handleDidStartLoading = () => {
      setIsLoading(true)
      // 更新选项卡状态
      updateTabInfo(activeTabId, { isLoading: true })
    }

    const handleDidStopLoading = () => {
      const currentURL = webview.getURL()
      setIsLoading(false)
      setCurrentUrl(currentURL)

      // 更新选项卡状态
      updateTabInfo(activeTabId, {
        isLoading: false,
        url: currentURL,
        title: webview.getTitle() || currentURL
      })
    }

    const handleDidNavigate = (e: any) => {
      const canGoBackStatus = webview.canGoBack()
      const canGoForwardStatus = webview.canGoForward()

      setCurrentUrl(e.url)
      setCanGoBack(canGoBackStatus)
      setCanGoForward(canGoForwardStatus)

      // 更新选项卡状态
      updateTabInfo(activeTabId, {
        url: e.url,
        canGoBack: canGoBackStatus,
        canGoForward: canGoForwardStatus
      })
    }

    const handleDidNavigateInPage = (e: any) => {
      const canGoBackStatus = webview.canGoBack()
      const canGoForwardStatus = webview.canGoForward()

      setCurrentUrl(e.url)
      setCanGoBack(canGoBackStatus)
      setCanGoForward(canGoForwardStatus)

      // 更新选项卡状态
      updateTabInfo(activeTabId, {
        url: e.url,
        canGoBack: canGoBackStatus,
        canGoForward: canGoForwardStatus
      })
    }

    // 处理页面标题变化
    const handlePageTitleUpdated = (e: any) => {
      // 更新选项卡标题
      updateTabInfo(activeTabId, { title: e.title })
    }

    // 处理网站图标更新
    const handlePageFaviconUpdated = (e: any) => {
      // 更新选项卡图标
      updateTabInfo(activeTabId, { favicon: e.favicons[0] })
    }

    // 检测Cloudflare验证码
    const handleDomReady = () => {
      const captchaNotice = t('browser.captcha_notice')

      // 注入浏览器模拟脚本
      webview.executeJavaScript(`
        try {
          // 覆盖navigator.userAgent
          Object.defineProperty(navigator, 'userAgent', {
            value: '${userAgent}',
            writable: false
          });

          // 覆盖navigator.platform
          Object.defineProperty(navigator, 'platform', {
            value: 'Win32',
            writable: false
          });

          // 覆盖navigator.plugins
          Object.defineProperty(navigator, 'plugins', {
            value: [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
              { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client' }
            ],
            writable: false
          });

          // 覆盖navigator.languages
          Object.defineProperty(navigator, 'languages', {
            value: ['zh-CN', 'zh', 'en-US', 'en'],
            writable: false
          });

          // 覆盖window.chrome
          window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
          };

          // 添加WebGL支持检测
          if (HTMLCanvasElement.prototype.getContext) {
            const origGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, attributes) {
              if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
                const gl = origGetContext.call(this, type, attributes);
                if (gl) {
                  // 修改WebGL参数以模拟真实浏览器
                  const getParameter = gl.getParameter.bind(gl);
                  gl.getParameter = function(parameter) {
                    // UNMASKED_VENDOR_WEBGL
                    if (parameter === 37445) {
                      return 'Google Inc. (NVIDIA)';
                    }
                    // UNMASKED_RENDERER_WEBGL
                    if (parameter === 37446) {
                      return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 Direct3D11 vs_5_0 ps_5_0, D3D11)';
                    }
                    return getParameter(parameter);
                  };
                }
                return gl;
              }
              return origGetContext.call(this, type, attributes);
            };
          }

          // 添加音频上下文支持
          if (typeof AudioContext !== 'undefined') {
            const origAudioContext = AudioContext;
            window.AudioContext = function() {
              const context = new origAudioContext();
              return context;
            };
          }

          // 添加电池API模拟
          if (navigator.getBattery) {
            navigator.getBattery = function() {
              return Promise.resolve({
                charging: true,
                chargingTime: 0,
                dischargingTime: Infinity,
                level: 1.0,
                addEventListener: function() {},
                removeEventListener: function() {}
              });
            };
          }

          // 修复Cloudflare检测
          if (document.documentElement) {
            // 添加一些随机性，使每个浏览器实例看起来都不同
            const randomFactor = Math.floor(Math.random() * 10);

            // 修改屏幕分辨率
            Object.defineProperty(window, 'innerWidth', {
              get: function() { return 1920 + randomFactor; }
            });

            Object.defineProperty(window, 'innerHeight', {
              get: function() { return 1080 + randomFactor; }
            });

            Object.defineProperty(window, 'outerWidth', {
              get: function() { return 1920 + randomFactor; }
            });

            Object.defineProperty(window, 'outerHeight', {
              get: function() { return 1080 + randomFactor; }
            });

            Object.defineProperty(screen, 'width', {
              get: function() { return 1920; }
            });

            Object.defineProperty(screen, 'height', {
              get: function() { return 1080; }
            });

            Object.defineProperty(screen, 'availWidth', {
              get: function() { return 1920; }
            });

            Object.defineProperty(screen, 'availHeight', {
              get: function() { return 1040; }
            });

            // 修改时区
            Date.prototype.getTimezoneOffset = function() {
              return -480; // 中国标准时间 (UTC+8)
            };
          }

          console.log('Browser emulation script injected successfully');
        } catch (e) {
          console.error('Failed to inject browser emulation:', e);
        }
      `)

      // 检测验证码脚本
      const script = `
        // 检测是否存在Cloudflare验证码或其他验证码
        const hasCloudflareCaptcha = document.querySelector('iframe[src*="cloudflare"]') !== null ||
                                    document.querySelector('.cf-browser-verification') !== null ||
                                    document.querySelector('.cf-im-under-attack') !== null ||
                                    document.querySelector('#challenge-form') !== null ||
                                    document.querySelector('#challenge-running') !== null ||
                                    document.querySelector('#challenge-error-title') !== null ||
                                    document.querySelector('.ray-id') !== null ||
                                    document.querySelector('.hcaptcha-box') !== null ||
                                    document.querySelector('iframe[src*="hcaptcha"]') !== null ||
                                    document.querySelector('iframe[src*="recaptcha"]') !== null;

        // 如果存在验证码，添加一些辅助功能
        if (hasCloudflareCaptcha) {
          // 尝试自动点击"我是人类"复选框
          const checkboxes = document.querySelectorAll('input[type="checkbox"]');
          checkboxes.forEach(checkbox => {
            if (checkbox.style.display !== 'none') {
              checkbox.click();
            }
          });

          // 添加一个提示，告诉用户需要手动完成验证
          const notificationDiv = document.createElement('div');
          notificationDiv.style.position = 'fixed';
          notificationDiv.style.top = '10px';
          notificationDiv.style.left = '50%';
          notificationDiv.style.transform = 'translateX(-50%)';
          notificationDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
          notificationDiv.style.color = 'white';
          notificationDiv.style.padding = '10px 20px';
          notificationDiv.style.borderRadius = '5px';
          notificationDiv.style.zIndex = '9999999';
          notificationDiv.style.fontFamily = 'Arial, sans-serif';
          notificationDiv.textContent = "${captchaNotice}";

          document.body.appendChild(notificationDiv);

          // 5秒后自动隐藏提示
          setTimeout(() => {
            notificationDiv.style.opacity = '0';
            notificationDiv.style.transition = 'opacity 1s';
            setTimeout(() => {
              notificationDiv.remove();
            }, 1000);
          }, 5000);
        }
      `

      // 替换模板字符串中的变量
      const finalScript = script.replace('${captchaNotice}', captchaNotice)
      webview.executeJavaScript(finalScript)
    }

    webview.addEventListener('did-start-loading', handleDidStartLoading)
    webview.addEventListener('did-stop-loading', handleDidStopLoading)
    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('page-title-updated', handlePageTitleUpdated)
    webview.addEventListener('page-favicon-updated', handlePageFaviconUpdated)

    // 初始加载URL
    webview.src = url

    return () => {
      webview.removeEventListener('did-start-loading', handleDidStartLoading)
      webview.removeEventListener('did-stop-loading', handleDidStopLoading)
      webview.removeEventListener('did-navigate', handleDidNavigate)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('page-title-updated', handlePageTitleUpdated)
      webview.removeEventListener('page-favicon-updated', handlePageFaviconUpdated)
    }
  }, [url, t, activeTabId])

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentUrl(e.target.value)
  }

  const handleUrlSubmit = () => {
    let processedUrl = currentUrl.trim()

    // 如果URL不包含协议，添加https://
    if (!/^https?:\/\//i.test(processedUrl)) {
      // 检查是否是搜索查询而不是URL
      if (!processedUrl.includes('.') || processedUrl.includes(' ')) {
        // 将输入视为搜索查询
        processedUrl = `https://www.google.com/search?q=${encodeURIComponent(processedUrl)}`
      } else {
        // 添加https://前缀
        processedUrl = `https://${processedUrl}`
      }
    }

    setUrl(processedUrl)
  }

  // 移除已弃用的handleKeyPress方法，直接使用onPressEnter

  const handleGoBack = () => {
    webviewRef.current?.goBack()
  }

  const handleGoForward = () => {
    webviewRef.current?.goForward()
  }

  const handleReload = () => {
    webviewRef.current?.reload()
  }

  const handleHome = () => {
    setUrl('https://www.google.com')
  }

  const handleOpenDevTools = () => {
    const webview = webviewRef.current
    if (webview) {
      webview.openDevTools()
    }
  }

  // 添加打开外部浏览器的功能
  const handleOpenExternal = () => {
    if (currentUrl && window.api && window.api.shell) {
      window.api.shell.openExternal(currentUrl)
    }
  }

  // 添加清除浏览器数据的功能
  const handleClearData = () => {
    if (window.api && window.api.ipcRenderer) {
      // 通过IPC调用主进程清除浏览器数据
      window.api.ipcRenderer.invoke('browser:clear-data').then(() => {
        // 重新加载当前页面
        if (webviewRef.current) {
          webviewRef.current.reload()
        }
      })
    }
  }

  // 使用与Sec-Ch-Ua匹配的用户代理字符串
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

  // 检测Google登录页面
  const [showGoogleLoginTip, setShowGoogleLoginTip] = useState(false)

  // 处理Google登录
  const handleGoogleLogin = () => {
    if (webviewRef.current) {
      // 使用Google移动版登录页面，检测可能不那么严格
      const mobileLoginUrl =
        'https://accounts.google.com/signin/v2/identifier?hl=zh-CN&flowName=GlifWebSignIn&flowEntry=ServiceLogin&service=mail&continue=https://mail.google.com/mail/&rip=1&TL=AM3QAYbxUXwQx_6Jq_0I5HwQZvPcnVOJ1mKZQjwPXpR7LWiKGdz8ZLVEwgfTUPg4&platform=mobile'
      webviewRef.current.loadURL(mobileLoginUrl)
    }
  }

  // 选项卡管理功能
  const handleAddTab = () => {
    const newTabId = `tab-${Date.now()}`
    const newTab: Tab = {
      id: newTabId,
      title: 'New Tab',
      url: 'https://www.google.com',
      isLoading: false,
      canGoBack: false,
      canGoForward: false
    }

    setTabs([...tabs, newTab])
    setActiveTabId(newTabId)
    setUrl('https://www.google.com')
  }

  const handleCloseTab = (tabId: string, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation() // 防止触发选项卡切换

    if (tabs.length === 1) {
      // 如果只有一个选项卡，创建一个新的空白选项卡
      handleAddTab()
    }

    // 如果关闭的是当前活动选项卡，切换到前一个选项卡
    if (tabId === activeTabId) {
      const currentIndex = tabs.findIndex((tab) => tab.id === tabId)
      const newActiveIndex = currentIndex === 0 ? 1 : currentIndex - 1
      setActiveTabId(tabs[newActiveIndex].id)
    }

    // 从选项卡列表中移除
    setTabs(tabs.filter((tab) => tab.id !== tabId))
  }

  const handleTabChange = (newActiveTabId: string) => {
    setActiveTabId(newActiveTabId)

    // 更新URL和其他状态
    const newActiveTab = tabs.find((tab) => tab.id === newActiveTabId)
    if (newActiveTab) {
      setUrl(newActiveTab.url)
      setCurrentUrl(newActiveTab.url)
      setCanGoBack(newActiveTab.canGoBack)
      setCanGoForward(newActiveTab.canGoForward)
      setIsLoading(newActiveTab.isLoading)
    }
  }

  // 更新选项卡信息
  const updateTabInfo = (tabId: string, updates: Partial<Tab>) => {
    setTabs((prevTabs) => prevTabs.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab)))
  }

  // 检测Google登录页面
  useEffect(() => {
    // 检测是否是Google登录页面
    if (currentUrl.includes('accounts.google.com')) {
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
    } else {
      setShowGoogleLoginTip(false)
    }
  }, [currentUrl, activeTabId])

  return (
    <BrowserContainer>
      <NavBar>
        <Space style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Tooltip title={t('browser.back')}>
            <Button icon={<ArrowLeftOutlined />} disabled={!canGoBack} onClick={handleGoBack} />
          </Tooltip>
          <Tooltip title={t('browser.forward')}>
            <Button icon={<ArrowRightOutlined />} disabled={!canGoForward} onClick={handleGoForward} />
          </Tooltip>
          <Tooltip title={t('browser.refresh')}>
            <Button icon={<ReloadOutlined />} onClick={handleReload} loading={isLoading} />
          </Tooltip>
          <Tooltip title={t('browser.home')}>
            <Button icon={<HomeOutlined />} onClick={handleHome} />
          </Tooltip>
          <Tooltip title={t('browser.devtools')}>
            <Button icon={<BugOutlined />} onClick={handleOpenDevTools} />
          </Tooltip>
          <Tooltip title={t('browser.open_external')}>
            <Button icon={<ExportOutlined />} onClick={handleOpenExternal} />
          </Tooltip>
          <Tooltip title={t('browser.clear_data')}>
            <Button icon={<DeleteOutlined />} onClick={handleClearData} />
          </Tooltip>
        </Space>

        <AddressBar
          value={currentUrl}
          onChange={handleUrlChange}
          onPressEnter={handleUrlSubmit}
          prefix={<SearchOutlined />}
          placeholder={t('browser.url_placeholder')}
        />
      </NavBar>

      <TabsContainer>
        <Tabs
          type="card"
          activeKey={activeTabId}
          onChange={handleTabChange}
          tabBarExtraContent={{
            right: (
              <Button
                className="add-tab-button"
                icon={<PlusOutlined />}
                onClick={handleAddTab}
                title={t('browser.new_tab')}
              />
            )
          }}
          items={tabs.map((tab) => ({
            key: tab.id,
            label: (
              <span>
                {tab.favicon && (
                  <img
                    src={tab.favicon}
                    alt=""
                    style={{ width: 16, height: 16, marginRight: 8, verticalAlign: 'middle' }}
                  />
                )}
                {tab.title || tab.url}
                <CloseOutlined onClick={(e) => handleCloseTab(tab.id, e)} />
              </span>
            )
          }))}
        />
      </TabsContainer>

      <WebviewContainer>
        {showGoogleLoginTip && (
          <GoogleLoginTip>
            <div className="tip-content">
              <p>{t('browser.google_login_tip') || '检测到Google登录页面，建议使用移动版登录页面以获得更好的体验。'}</p>
              <Space>
                <Button type="primary" onClick={handleGoogleLogin}>
                  使用移动版登录页面
                </Button>
                <Button icon={<DeleteOutlined />} onClick={handleClearData}>
                  清除数据并重试
                </Button>
              </Space>
            </div>
          </GoogleLoginTip>
        )}

        {/* 为每个选项卡创建一个webview */}
        {tabs.map((tab) => (
          <div key={tab.id} className={`webview-wrapper ${tab.id === activeTabId ? 'active' : ''}`}>
            <webview
              ref={(el: any) => {
                if (el) {
                  webviewRefs.current[tab.id] = el as WebviewTag

                  // 如果是新创建的选项卡，加载初始URL
                  if (!el.src) {
                    el.src = tab.url
                  }
                }
              }}
              allowpopups={true}
              partition="persist:browser"
              useragent={userAgent}
              preload=""
              webpreferences="contextIsolation=no, javascript=yes, webgl=yes, webaudio=yes, allowRunningInsecureContent=yes"
              disablewebsecurity={DISABLE_SECURITY}
              plugins={true}
            />
          </div>
        ))}
      </WebviewContainer>
    </BrowserContainer>
  )
}

export default Browser
