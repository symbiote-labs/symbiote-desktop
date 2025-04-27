# 浏览器组件参考文档

本文档提供了浏览器组件中所有文件的详细参考，包括每个文件的主要功能、导出的函数/组件及其用途。

## 组件 (Components)

### `WebviewContainer.tsx`

**用途**: 管理所有Webview实例的容器组件

**导出**:
- `WebviewContainer`: 主组件，渲染所有标签页的webview元素

**主要函数**:
- `handleWebviewInit`: 处理webview初始化/销毁事件

### `WebviewItem.tsx`

**用途**: 管理单个Webview实例的组件

**导出**:
- `WebviewItem`: 单个webview组件，处理webview的生命周期和事件

**主要函数**:
- `ref回调`: 设置webview引用和事件监听器

### `WebviewError.tsx`

**用途**: 显示webview错误的组件

**导出**:
- `WebviewErrorType`: 错误类型枚举
- `WebviewError`: 错误显示组件

**主要函数**:
- `getErrorMessage`: 获取用户友好的错误消息
- `getTitle`: 获取错误标题
- `handleReload`: 处理重新加载
- `handleGoBack`: 处理返回

### `WebviewErrorContainer.tsx`

**用途**: 管理错误状态和处理用户交互的容器组件

**导出**:
- `WebviewErrorContainer`: 错误容器组件

**主要函数**:
- `handleReload`: 处理重新加载
- `handleGoBack`: 处理返回

### `TabBar.tsx`

**用途**: 标签栏组件，显示所有标签页

**导出**:
- `TabBar`: 标签栏组件

**主要函数**:
- `handleTabClick`: 处理标签页点击
- `handleTabClose`: 处理标签页关闭
- `handleAddTab`: 处理添加标签页
- `handleTabDragStart`: 处理标签页拖拽开始
- `handleTabDragOver`: 处理标签页拖拽悬停
- `handleTabDrop`: 处理标签页拖拽放置

### `TabItem.tsx`

**用途**: 单个标签页组件

**导出**:
- `TabItem`: 单个标签页组件

**主要函数**:
- `handleClick`: 处理点击
- `handleClose`: 处理关闭
- `handleDragStart`: 处理拖拽开始
- `handleDragOver`: 处理拖拽悬停
- `handleDrop`: 处理拖拽放置

### `GoogleLoginTip.tsx`

**用途**: Google登录提示组件

**导出**:
- `GoogleLoginTip`: Google登录提示组件

**主要函数**:
- `handleClose`: 处理关闭
- `handleUseGoogleMobile`: 处理使用Google移动版
- `handleClearData`: 处理清除数据

## Hooks

### `useWebviewEvents.ts`

**用途**: 处理Webview的各种事件

**导出**:
- `userAgent`: 用户代理字符串
- `useWebviewEvents`: 主Hook函数

**主要函数**:
- `setupWebviewListeners`: 设置webview事件监听器
- `handleDidStartLoading`: 处理开始加载事件
- `handleDidStopLoading`: 处理停止加载事件
- `handleDidNavigate`: 处理导航事件
- `handleDidNavigateInPage`: 处理页内导航事件
- `handlePageTitleUpdated`: 处理页面标题更新事件
- `handleNewWindow`: 处理新窗口事件
- `handleConsoleMessage`: 处理控制台消息事件
- `handleDidFailLoad`: 处理加载失败事件
- `handleCrashed`: 处理崩溃事件
- `handleUnresponsive`: 处理未响应事件
- `handleResponsive`: 处理恢复响应事件

### `useWebviewEventHandler.ts`

**用途**: 管理Webview事件监听器的设置和清理

**导出**:
- `useWebviewEventHandler`: 主Hook函数

**主要函数**:
- `setupListeners`: 设置事件监听器
- `cleanupListeners`: 清理事件监听器

### `useWebviewLifecycle.ts`

**用途**: 管理Webview的生命周期

**导出**:
- `useWebviewLifecycle`: 主Hook函数

**主要函数**:
- `handleWebviewRef`: 处理webview引用设置

### `useWebviewAttributes.ts`

**用途**: 管理Webview的属性设置和配置

**导出**:
- `useWebviewAttributes`: 主Hook函数

**主要函数**:
- `standardAttributes`: 获取标准webview属性
- `setupBooleanAttributes`: 设置布尔属性
- `shouldResetup`: 检测是否需要重新设置

### `useWebviewNavigation.ts`

**用途**: 管理Webview的导航操作

**导出**:
- `useWebviewNavigation`: 主Hook函数

**主要函数**:
- `navigateTo`: 导航到指定URL
- `goBack`: 导航后退
- `goForward`: 导航前进
- `refresh`: 刷新页面
- `stopLoading`: 停止加载

### `useTabStateManager.ts`

**用途**: 管理标签页状态

**导出**:
- `useTabStateManager`: 主Hook函数

**主要函数**:
- `updateTabInfo`: 更新标签页信息
- `addTab`: 添加新标签页
- `closeTab`: 关闭标签页
- `openUrlInTab`: 在新标签页中打开URL

### `useTabDragManager.ts`

**用途**: 管理标签页拖拽逻辑

**导出**:
- `useTabDragManager`: 主Hook函数

**主要函数**:
- `handleDragStart`: 处理拖拽开始
- `handleDragEnd`: 处理拖拽结束
- `handleDragOver`: 处理拖拽悬停
- `handleDrop`: 处理拖拽放置

### `useTabUIState.ts`

**用途**: 管理标签页UI状态

**导出**:
- `useTabUIState`: 主Hook函数

**主要函数**:
- `handleTabHover`: 处理标签页悬停
- `handleTabContextMenu`: 处理标签页右键菜单
- `closeContextMenu`: 关闭右键菜单

### `useTabHistory.ts`

**用途**: 管理标签页历史记录

**导出**:
- `useTabHistory`: 主Hook函数

**主要函数**:
- `addHistory`: 添加历史记录
- `getPrevious`: 获取上一个历史记录
- `getNext`: 获取下一个历史记录
- `goBack`: 后退
- `goForward`: 前进
- `clearHistory`: 清除历史记录

## 工具函数 (Utils)

### `webviewUtils.ts`

**用途**: Webview相关工具函数

**导出**:
- `setupWebviewBooleanAttributes`: 设置webview的布尔属性
- `getWebviewAttributes`: 获取webview的标准属性配置
- `shouldResetupWebview`: 检测webview是否需要重新设置事件监听器

### `tabStorageUtils.ts`

**用途**: 标签页存储工具函数

**导出**:
- `saveTabs`: 保存标签页到本地存储
- `loadTabs`: 从本地存储加载标签页
- `clearTabs`: 清除本地存储中的标签页

### `tabSortingUtils.ts`

**用途**: 标签页排序工具函数

**导出**:
- `reorderTabs`: 重新排序标签页
- `groupTabsByDomain`: 根据域名对标签页进行分组
- `sortTabsByTitle`: 根据标题对标签页进行排序

### `tabContentUtils.ts`

**用途**: 标签页内容工具函数

**导出**:
- `getDisplayTitle`: 生成标签页的显示标题
- `getTabTooltip`: 生成标签页的工具提示
- `getTabIconUrl`: 获取标签页的图标URL
- `truncateTitle`: 截断标题以适应显示
- `isBlankTab`: 检查标签页是否是空白页

### `urlUtils.ts`

**用途**: URL处理工具函数

**导出**:
- `formatUrl`: 格式化URL，确保包含协议
- `extractDomain`: 从URL中提取域名
- `extractPath`: 从URL中提取路径
- `formatUrlForDisplay`: 格式化URL以便显示
- `isSearchEngineUrl`: 检查URL是否是搜索引擎URL
- `extractSearchQuery`: 从搜索引擎URL中提取搜索查询

### `errorHandlingUtils.ts`

**用途**: 错误处理工具函数

**导出**:
- `createErrorState`: 创建错误状态对象
- `handleWebviewLoadError`: 处理webview加载错误
- `handleWebviewCrash`: 处理webview渲染进程崩溃
- `handleWebviewUnresponsive`: 处理webview未响应
- `resetErrorState`: 重置错误状态

## 类型定义 (Types)

### `index.ts`

**用途**: 定义浏览器组件使用的类型

**导出**:
- `Tab`: 标签页类型
- `TabUpdate`: 标签页更新类型
- `DragDirection`: 拖拽方向类型

## 样式 (Styles)

### `BrowserStyles.ts`

**用途**: 浏览器组件样式定义

**导出**:
- `WebviewContainer`: Webview容器样式
- `TabBar`: 标签栏样式
- `TabItem`: 标签页样式
- `TabTitle`: 标签页标题样式
- `TabIcon`: 标签页图标样式
- `TabClose`: 标签页关闭按钮样式
- `AddTabButton`: 添加标签页按钮样式
