# 标签页标题更新问题

## 问题描述

浏览器标签页的标题无法正确更新，始终显示默认的"New Tab"文本，而不是网页的实际标题。

## 原因分析

问题的根本原因在于WebviewContainer组件中的事件监听器设置逻辑。在原始实现中，事件监听器（包括`page-title-updated`事件）只在webview元素首次创建时设置，或者当webview引用发生变化时才会重新设置。

具体来说，问题出在以下代码逻辑中：

```typescript
// 只有在webview不存在或者是新创建的选项卡时才设置引用和加载URL
if (!existingWebview) {
  // 设置事件监听器并保存清理函数
  const cleanup = setupWebviewListeners(el as WebviewTag, tab.id)
  cleanupFunctionsRef.current[tab.id] = cleanup
} else if (existingWebview !== el) {
  // 如果引用变了（React重新创建了元素），保留原来的状态
  // 先清理旧的事件监听器
  if (cleanupFunctionsRef.current[tab.id]) {
    cleanupFunctionsRef.current[tab.id]()
  }
  // 重新设置事件监听器
  const cleanup = setupWebviewListeners(el as WebviewTag, tab.id)
  cleanupFunctionsRef.current[tab.id] = cleanup
}
```

这意味着：
1. 当标签页首次创建时，事件监听器会被设置，标题可能会正确更新一次
2. 但是当用户导航到新页面时，由于webview元素没有变化，事件监听器不会被重新设置
3. 结果是，`page-title-updated`事件不会被触发，标签页标题不会更新

## 失败的尝试

在解决这个问题的过程中，我们尝试了以下几种方法，但都没有成功：

### 尝试1：修改标题显示逻辑

```typescript
// 在TabItem组件中修改标题显示逻辑
<TabTitle title={tab.title || tab.url}>
  {tab.title || (tab.url && tab.url.replace(/^https?:\/\/(www\.)?/, ''))}
</TabTitle>
```

这种方法只是改变了标题的显示方式，但没有解决根本问题，因为`tab.title`本身没有被更新。

### 尝试2：修改标题样式

```typescript
// 修改TabTitle样式
export const TabTitle = styled.span`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  max-width: 140px; /* 限制最大宽度 */
  display: inline-block;
`
```

这只解决了标题显示的样式问题，但没有解决标题内容不更新的问题。

### 尝试3：在事件处理函数中添加日志

```typescript
// 在handlePageTitleUpdated函数中添加日志
const handlePageTitleUpdated = (e: any) => {
  console.log(`[Tab ${tabId}] Title updated: ${e.title}`)
  // 更新选项卡标题
  updateTabInfo(tabId, { title: e.title || webview.getURL() })
}
```

这有助于调试，但由于事件监听器本身没有被正确设置，所以这个函数根本没有机会被调用。

### 尝试4：修改初始标题

```typescript
// 修改handleAddTab函数中的初始标题
const handleAddTab = useCallback((url: string = 'https://www.google.com', title: string = '加载中...') => {
  // ...
}, [tabs])
```

这只是改变了初始标题，但没有解决标题不更新的根本问题。

## 解决方案

修改WebviewContainer组件，确保每次渲染时都设置事件监听器，而不仅仅是在webview首次创建或引用变化时：

```typescript
// 每次渲染时都设置事件监听器，确保标题更新事件能被触发
// 先清理旧的事件监听器
if (cleanupFunctionsRef.current[tab.id]) {
  cleanupFunctionsRef.current[tab.id]()
}

// 如果是新创建的webview或引用变了
if (!existingWebview || existingWebview !== el) {
  console.log('Setting up webview for tab:', tab.id, 'URL:', tab.url)

  // 保存webview引用
  webviewRefs.current[tab.id] = el as WebviewTag

  // 标记为已初始化
  webviewSessionsRef.current[tab.id] = true
}

// 重新设置事件监听器
const cleanup = setupWebviewListeners(el as WebviewTag, tab.id)
cleanupFunctionsRef.current[tab.id] = cleanup
```

这样，无论何时组件重新渲染，事件监听器都会被重新设置，确保标题更新事件能够被正确触发。

## 其他改进

1. 在新标签页创建时使用"加载中..."作为临时标题，而不是"New Tab"
2. 在各个事件处理函数中添加更多日志输出，便于调试
3. 确保在页面加载完成、导航和页内导航时都正确更新标题

## 注意事项

在Electron应用中处理webview事件时，需要特别注意事件监听器的生命周期管理：

1. 确保每次可能影响事件监听的操作（如导航、页面加载等）都能触发事件监听器的重新设置
2. 在清理时正确移除所有事件监听器，避免内存泄漏
3. 使用引用和清理函数的映射（如`webviewRefs`和`cleanupFunctionsRef`）来管理多个webview实例

## 相关文件

- `src/renderer/src/pages/Browser/components/WebviewContainer.tsx`
- `src/renderer/src/pages/Browser/hooks/useWebviewEvents.ts`
- `src/renderer/src/pages/Browser/hooks/useAnimatedTabs.ts`
