import { WebviewTag } from 'electron'

// 使用Chrome 126的用户代理字符串，但保留Chrome 134的功能
export const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// 控制是否启用浏览器模拟脚本
const ENABLE_BROWSER_EMULATION = false

/**
 * 创建一个钩子来设置webview的所有事件监听器
 * 处理webview的各种事件，包括导航、加载状态、页面标题更新等
 */
export const useWebviewEvents = () => {
  // 添加一个注释作为检测点
  const setupWebviewListeners = (
    webview: WebviewTag,
    tabId: string,
    activeTabId: string,
    updateTabInfo: (tabId: string, updates: any) => void,
    setIsLoading: (isLoading: boolean) => void,
    setCurrentUrl: (url: string) => void,
    setCanGoBack: (canGoBack: boolean) => void,
    setCanGoForward: (canGoForward: boolean) => void,
    openUrlInTab: (url: string, inNewTab?: boolean, title?: string) => void,
    setDisplayUrl?: (url: string) => void, // 可选参数，用于更新地址栏显示的URL
    linkOpenMode: 'newTab' | 'newWindow' = 'newTab' // 链接打开方式，默认为新标签页
  ) => {
    // console.log('Setting up event listeners for tab:', tabId) // 注释掉日志

    // 添加WebView就绪状态标志
    let isWebViewReady = false

    // 处理加载开始事件
    const handleDidStartLoading = () => {
      // 只更新当前活动标签页的UI状态
      if (tabId === activeTabId) {
        setIsLoading(true)
      }

      // 更新选项卡状态
      updateTabInfo(tabId, { isLoading: true })
    }

    // 处理加载结束事件
    const handleDidStopLoading = () => {
      const currentURL = webview.getURL()
      // 安全地获取标题，确保WebView已准备好
      let pageTitle = currentURL
      if (isWebViewReady) {
        try {
          pageTitle = webview.getTitle() || currentURL
        } catch (err) {
          console.warn(`[Tab ${tabId}] Failed to get title, WebView may not be ready:`, err)
        }
      }

      console.log(`[Tab ${tabId}] Page loaded: ${currentURL}, title: ${pageTitle}`)

      // 只更新当前活动标签页的UI状态
      if (tabId === activeTabId) {
        setIsLoading(false)
        setCurrentUrl(currentURL)
        // 如果提供了setDisplayUrl函数，也更新显示URL
        if (setDisplayUrl) {
          setDisplayUrl(currentURL)
        }
      }

      // 更新选项卡状态 (立即更新 isLoading)
      updateTabInfo(tabId, {
        isLoading: false,
        url: currentURL,
        title: pageTitle, // 使用初始获取的pageTitle
        canGoBack: isWebViewReady ? webview.canGoBack() : false,
        canGoForward: isWebViewReady ? webview.canGoForward() : false
      })

      console.log(`[Tab ${tabId}] Updated tab info after stop loading with title: ${pageTitle}`)

      // 使用setTimeout确保在下一个事件循环中更新标题 (如果需要更精确的最终标题)
      // 但不在这里更新 isLoading
      if (isWebViewReady) {
        setTimeout(() => {
          try {
            const finalTitle = webview.getTitle() || currentURL
            if (finalTitle !== pageTitle) {
              updateTabInfo(tabId, { title: finalTitle })
              console.log(`[Tab ${tabId}] Final title updated: ${finalTitle}`)
            }
          } catch (err) {
            console.warn(`[Tab ${tabId}] Failed to get final title:`, err)
          }
        }, 100)
      }
    }

    // 处理导航事件
    const handleDidNavigate = (e: any) => {
      // 仅当WebView准备好时才获取导航状态
      let canGoBackStatus = false
      let canGoForwardStatus = false
      let pageTitle = e.url

      if (isWebViewReady) {
        try {
          canGoBackStatus = webview.canGoBack()
          canGoForwardStatus = webview.canGoForward()
          pageTitle = webview.getTitle() || e.url
        } catch (err) {
          console.warn(`[Tab ${tabId}] Failed to get navigation status:`, err)
        }
      }

      console.log(`[Tab ${tabId}] Navigation: ${e.url}, title: ${pageTitle}`)

      // 只更新当前活动标签页的UI状态
      if (tabId === activeTabId) {
        setCurrentUrl(e.url)
        // 如果提供了setDisplayUrl函数，也更新显示URL
        if (setDisplayUrl) {
          setDisplayUrl(e.url)
        }
        setCanGoBack(canGoBackStatus)
        setCanGoForward(canGoForwardStatus)
      }

      // 更新选项卡状态
      updateTabInfo(tabId, {
        url: e.url,
        title: pageTitle,
        canGoBack: canGoBackStatus,
        canGoForward: canGoForwardStatus
      })
    }

    // 处理页内导航事件
    const handleDidNavigateInPage = (e: any) => {
      // 仅当WebView准备好时才获取导航状态
      let canGoBackStatus = false
      let canGoForwardStatus = false
      let pageTitle = e.url

      if (isWebViewReady) {
        try {
          canGoBackStatus = webview.canGoBack()
          canGoForwardStatus = webview.canGoForward()
          pageTitle = webview.getTitle() || e.url
        } catch (err) {
          console.warn(`[Tab ${tabId}] Failed to get in-page navigation status:`, err)
        }
      }

      console.log(`[Tab ${tabId}] In-page navigation: ${e.url}, title: ${pageTitle}`)

      // 只更新当前活动标签页的UI状态
      if (tabId === activeTabId) {
        setCurrentUrl(e.url)
        // 如果提供了setDisplayUrl函数，也更新显示URL
        if (setDisplayUrl) {
          setDisplayUrl(e.url)
        }
        setCanGoBack(canGoBackStatus)
        setCanGoForward(canGoForwardStatus)
      }

      // 更新选项卡状态
      updateTabInfo(tabId, {
        url: e.url,
        title: pageTitle,
        canGoBack: canGoBackStatus,
        canGoForward: canGoForwardStatus
      })
    }

    // 处理页面标题更新事件
    const handlePageTitleUpdated = (e: any) => {
      const newTitle = e.title || webview.getURL()
      console.log(`[Tab ${tabId}] Title updated: ${newTitle}`)

      // 立即更新选项卡标题
      setTimeout(() => {
        updateTabInfo(tabId, { title: newTitle })
      }, 0)
    }

    // 处理网站图标更新事件
    const handlePageFaviconUpdated = (e: any) => {
      // 更新选项卡图标
      updateTabInfo(tabId, { favicon: e.favicons[0] })
    }

    // 处理DOM就绪事件
    const handleDomReady = () => {
      // 标记WebView已准备好
      isWebViewReady = true

      // 更新导航状态
      let canGoBackStatus = false
      let canGoForwardStatus = false

      try {
        canGoBackStatus = webview.canGoBack()
        canGoForwardStatus = webview.canGoForward()
      } catch (err) {
        console.warn(`[Tab ${tabId}] Failed to get navigation status in dom-ready:`, err)
      }

      // 更新选项卡状态
      updateTabInfo(tabId, {
        canGoBack: canGoBackStatus,
        canGoForward: canGoForwardStatus
      })

      // 只更新当前活动标签页的UI状态
      if (tabId === activeTabId) {
        setCanGoBack(canGoBackStatus)
        setCanGoForward(canGoForwardStatus)
      }

      // 注入链接点击拦截脚本
      webview.executeJavaScript(`
        (function() {
          // 已经注入过脚本，不再重复注入
          if (window.__linkInterceptorInjected) return;
          window.__linkInterceptorInjected = true;

          // 创建一个全局函数，用于在控制台中调用以打开新标签页
          window.__openInNewTab = function(url, title) {
            console.log('OPEN_NEW_TAB:' + JSON.stringify({url: url, title: title || url}));
          };

          // 拦截所有链接点击
          document.addEventListener('click', function(e) {
            // 查找被点击的链接元素
            let target = e.target;
            while (target && target.tagName !== 'A') {
              target = target.parentElement;
              if (!target) return; // 不是链接，直接返回
            }

            // 找到了链接元素
            if (target.tagName === 'A' && target.href) {
              // 检查是否应该在新标签页中打开
              const inNewTab = e.ctrlKey || e.metaKey || target.target === '_blank';

              // 阻止默认行为
              e.preventDefault();
              e.stopPropagation();

              // 使用一个特殊的数据属性来标记这个链接
              const linkData = {
                url: target.href,
                title: target.textContent || target.title || target.href,
                inNewTab: inNewTab
              };

              // 将数据转换为字符串并存储在自定义属性中
              document.body.setAttribute('data-last-clicked-link', JSON.stringify(linkData));

              // 触发一个自定义事件
              const event = new CustomEvent('link-clicked', { detail: linkData });
              document.dispatchEvent(event);

              console.log('Link interceptor: Click event captured.');
              // 使用控制台消息通知Electron
              console.log('LINK_CLICKED:' + JSON.stringify(linkData));
              console.log('Link interceptor: Message sent to console.');

              if (!inNewTab) {
                // 在当前标签页中打开链接
                window.location.href = target.href;
              }

              return false;
            }
          }, true);

          // 打印一条消息，确认链接拦截脚本已经注入
          console.log('Link interceptor script injected successfully');
        })();
      `)

      // 注入浏览器模拟脚本
      webview.executeJavaScript(`
        (function() {
          // 检查是否启用浏览器模拟
          const ENABLE_BROWSER_EMULATION = ${ENABLE_BROWSER_EMULATION};
          const userAgent = '${userAgent.replace(/'/g, "\\'").replace(/\n/g, '\\n')}'; // 转义单引号和换行符

          if (ENABLE_BROWSER_EMULATION) {
            try {
              // 覆盖navigator.userAgent
              Object.defineProperty(navigator, 'userAgent', {
                value: userAgent,
                writable: false
              });

              console.log('Browser emulation script injected successfully');
            } catch (e) {
              console.error('Failed to inject browser emulation:', e);
            }
          } else {
             console.log('Browser emulation is disabled by preload script.');
          }
        })();
      `)

      // Cloudflare 验证处理已完全移除
      // 测试表明不需要特殊的 CF 验证处理，移除后没有任何影响
      // 如果将来需要，可以参考备份文件：src\renderer\src\pages\Browser\utils\cloudflareHandler.ts.bak
    }

    // 处理新窗口打开请求
    const handleNewWindow = (e: any) => {
      console.log(`[Tab ${tabId}] handleNewWindow called with event object:`, e) // 添加日志打印事件对象
      console.log(`[Tab ${tabId}] handleNewWindow called for url: ${e.url}`)
      e.preventDefault() // 阻止默认行为

      console.log(
        `[Tab ${tabId}] New window request: ${e.url}, frameName: ${e.frameName || '未指定'}, linkOpenMode: ${linkOpenMode}`
      )

      // 只有当e.url存在时才处理新窗口请求
      if (e.url) {
        if (linkOpenMode === 'newTab') {
          // 在新标签页中打开
          openUrlInTab(e.url, true, e.frameName || '加载中...')
        } else if (linkOpenMode === 'newWindow') {
          // 调用主进程打开新窗口
          console.log(`[Tab ${tabId}] Opening link in new window:`, e.url)
          if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer
              .invoke('browser:openNewWindow', { url: e.url, title: e.frameName || e.url })
              .then(() => {
                console.log(`[Tab ${tabId}] Successfully opened new window`)
                // 同步cookie (虽然使用相同的session，但为了确保可以添加这个调用)
                return window.electron.ipcRenderer.invoke('browser:syncCookies')
              })
              .then((result) => {
                console.log(`[Tab ${tabId}] Cookie sync result:`, result)
              })
              .catch((error) => {
                console.error(`[Tab ${tabId}] Error opening new window or syncing cookies:`, error)
              })
          }
        }
      } else {
        console.warn(`[Tab ${tabId}] New window request ignored due to undefined URL:`, e)
      }
    }

    // 处理将要导航的事件
    const handleWillNavigate = (e: any) => {
      console.log(`[Tab ${tabId}] handleWillNavigate called for url: ${e.url}`)
      // 更新当前标签页的URL
      updateTabInfo(tabId, { url: e.url })
    }

    // 处理控制台消息事件 - 用于链接点击拦截
    const handleConsoleMessage = (event: any) => {
      console.log(`[Tab ${tabId}] handleConsoleMessage called with message: ${event.message}`)
      // 打印所有控制台消息，便于调试
      console.log(`[Tab ${tabId}] Console message:`, event.message)

      // 处理新的链接点击消息
      if (event.message && event.message.startsWith('LINK_CLICKED:')) {
        try {
          const dataStr = event.message.replace('LINK_CLICKED:', '')
          const data = JSON.parse(dataStr)

          console.log(`[Tab ${tabId}] Link clicked:`, data)

          // 根据 linkOpenMode 决定打开方式
          if (data.url && data.inNewTab) {
            if (linkOpenMode === 'newTab') {
              // 在新标签页中打开链接
              console.log(`[Tab ${tabId}] Opening link in new tab:`, data.url)
              openUrlInTab(data.url, true, data.title || data.url)
            } else if (linkOpenMode === 'newWindow') {
              // 调用主进程打开新窗口
              console.log(`[Tab ${tabId}] Opening link in new window:`, data.url)
              console.log(`[Tab ${tabId}] Calling IPC 'browser:openNewWindow' with args:`, {
                url: data.url,
                title: data.title || data.url
              })

              // 使用 window.electron.ipcRenderer.invoke 调用 IPC
              if (window.electron && window.electron.ipcRenderer) {
                window.electron.ipcRenderer
                  .invoke('browser:openNewWindow', { url: data.url, title: data.title || data.url })
                  .then(() => {
                    console.log(`[Tab ${tabId}] Successfully opened new window`)
                    // 同步cookie (虽然使用相同的session，但为了确保可以添加这个调用)
                    return window.electron.ipcRenderer.invoke('browser:syncCookies')
                  })
                  .then((result: any) => {
                    console.log(`[Tab ${tabId}] Cookie sync result:`, result)
                  })
                  .catch((error: any) => {
                    console.error(`[Tab ${tabId}] Error opening new window or syncing cookies:`, error)
                  })
              }
            }
          }
        } catch (error) {
          console.error('Failed to parse link data:', error)
        }
      }

      // 保留对旧消息格式的支持
      else if (event.message && event.message.startsWith('OPEN_NEW_TAB:')) {
        try {
          const dataStr = event.message.replace('OPEN_NEW_TAB:', '')
          const data = JSON.parse(dataStr)

          console.log(`[Tab ${tabId}] Opening link in new tab (legacy format):`, data)

          if (data.url) {
            // 在新标签页中打开链接
            openUrlInTab(data.url, true, data.title || data.url)
          }
        } catch (error) {
          console.error('Failed to parse link data:', error)
        }
      }
    }

    // 处理加载失败事件
    const handleDidFailLoad = (e: any) => {
      console.log(
        `[Tab ${tabId}] New window request: ${e.url}, frameName: ${e.frameName || '未指定'}, linkOpenMode: ${linkOpenMode}`
      )

      if (linkOpenMode === 'newTab') {
        // 在新标签页中打开
        openUrlInTab(e.url, true, e.frameName || '加载中...')
      } else if (linkOpenMode === 'newWindow') {
        // 调用主进程打开新窗口
        console.log(`[Tab ${tabId}] Attempting to open new window via IPC (did-fail-load event):`, e.url)
        // 使用 window.electron.ipcRenderer.invoke 调用 IPC
        if (window.electron && window.electron.ipcRenderer) {
          window.electron.ipcRenderer
            .invoke('browser:openNewWindow', { url: e.url, title: e.frameName || e.url })
            .then((result: any) =>
              console.log(`[Tab ${tabId}] IPC 'browser:openNewWindow' success (did-fail-load event):`, result)
            )
            .catch((error: any) =>
              console.error(`[Tab ${tabId}] IPC 'browser:openNewWindow' failed (did-fail-load event):`, error)
            )
        } else {
          console.error(
            `[Tab ${tabId}] window.electron.ipcRenderer is not available. Preload script might not be loaded correctly.`
          )
        }
      }
    }

    // 处理崩溃事件
    const handleCrashed = (e: any) => {
      console.log(`[Tab ${tabId}] Crashed: reason: ${e.reason}, exitCode: ${e.exitCode}`)

      // 导入错误处理工具函数
      const { handleWebviewCrash } = require('../utils/errorHandlingUtils')

      // 更新标签页状态，显示崩溃页面
      updateTabInfo(tabId, handleWebviewCrash(e.reason, e.exitCode))
    }

    // 处理未响应事件
    const handleUnresponsive = () => {
      console.log(`[Tab ${tabId}] Unresponsive`)

      // 导入错误处理工具函数
      const { handleWebviewUnresponsive } = require('../utils/errorHandlingUtils')

      // 更新标签页状态，显示未响应页面
      updateTabInfo(tabId, handleWebviewUnresponsive())
    }

    // 处理恢复响应事件
    const handleResponsive = () => {
      console.log(`[Tab ${tabId}] Responsive again`)

      // 导入错误处理工具函数
      const { resetErrorState } = require('../utils/errorHandlingUtils')

      // 更新标签页状态，清除错误状态
      updateTabInfo(tabId, resetErrorState())
    }

    // 添加所有事件监听器
    webview.addEventListener('did-start-loading', handleDidStartLoading)
    webview.addEventListener('did-stop-loading', handleDidStopLoading)
    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('page-title-updated', handlePageTitleUpdated)
    webview.addEventListener('page-favicon-updated', handlePageFaviconUpdated)
    webview.addEventListener('new-window', handleNewWindow)
    webview.addEventListener('will-navigate', handleWillNavigate)
    webview.addEventListener('console-message', handleConsoleMessage)
    webview.addEventListener('did-fail-load', handleDidFailLoad)
    webview.addEventListener('crashed', handleCrashed)
    webview.addEventListener('unresponsive', handleUnresponsive)
    webview.addEventListener('responsive', handleResponsive)

    // 处理 did-create-window 事件
    const handleDidCreateWindow = (e: any) => {
      console.log(`[Tab ${tabId}] did-create-window called for url: ${e.url}`)
      // 阻止默认行为
      e.preventDefault()

      // 调用主进程打开新窗口
      // 使用 window.electron.ipcRenderer.invoke 调用 IPC
      if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer
          .invoke('browser:openNewWindow', { url: e.url, title: e.frameName || e.url })
          .then((result: any) => {
            console.log(`[Tab ${tabId}] Successfully opened new window:`, result)
          })
          .catch((error: any) => {
            console.error(`[Tab ${tabId}] Error opening new window:`, error)
          })
      } else {
        console.error(
          `[Tab ${tabId}] window.electron.ipcRenderer is not available. Preload script might not be loaded correctly.`
        )
      }
    }

    // 添加所有事件监听器
    webview.addEventListener('did-start-loading', handleDidStartLoading)
    webview.addEventListener('did-stop-loading', handleDidStopLoading)
    webview.addEventListener('did-navigate', handleDidNavigate)
    webview.addEventListener('did-navigate-in-page', handleDidNavigateInPage)
    webview.addEventListener('dom-ready', handleDomReady)
    webview.addEventListener('page-title-updated', handlePageTitleUpdated)
    webview.addEventListener('page-favicon-updated', handlePageFaviconUpdated)
    webview.addEventListener('new-window', handleNewWindow)
    webview.addEventListener('will-navigate', handleWillNavigate)
    webview.addEventListener('console-message', handleConsoleMessage)
    webview.addEventListener('did-fail-load', handleDidFailLoad)
    webview.addEventListener('crashed', handleCrashed)
    webview.addEventListener('unresponsive', handleUnresponsive)
    webview.addEventListener('responsive', handleResponsive)
    webview.addEventListener('did-create-window', handleDidCreateWindow) // 添加 did-create-window 监听器

    // 返回清理函数
    return () => {
      // console.log('Cleaning up event listeners for tab:', tabId) // 注释掉日志
      webview.removeEventListener('did-start-loading', handleDidStartLoading)
      webview.removeEventListener('did-stop-loading', handleDidStopLoading)
      webview.removeEventListener('did-navigate', handleDidNavigate)
      webview.removeEventListener('did-navigate-in-page', handleDidNavigateInPage)
      webview.removeEventListener('dom-ready', handleDomReady)
      webview.removeEventListener('page-title-updated', handlePageTitleUpdated)
      webview.removeEventListener('page-favicon-updated', handlePageFaviconUpdated)
      webview.removeEventListener('new-window', handleNewWindow)
      webview.removeEventListener('will-navigate', handleWillNavigate)
      webview.removeEventListener('console-message', handleConsoleMessage)
      webview.removeEventListener('did-fail-load', handleDidFailLoad)
      webview.removeEventListener('crashed', handleCrashed)
      webview.removeEventListener('unresponsive', handleUnresponsive)
      webview.removeEventListener('responsive', handleResponsive)
      webview.removeEventListener('did-create-window', handleDidCreateWindow) // 移除 did-create-window 监听器
    }
  }

  return { setupWebviewListeners }
}
