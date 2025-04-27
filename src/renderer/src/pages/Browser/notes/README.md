# 浏览器组件注意事项

本目录包含了浏览器组件开发过程中遇到的问题和解决方案，以及一些重要的注意事项。这些文档可以帮助开发者理解组件的工作原理，避免重复踩坑。

## 目录

1. [标签页标题更新问题](./TabTitleUpdateIssue.md) - 解决标签页标题无法正确更新的问题，包含失败尝试的记录
2. [Edge风格标签页实现指南](./EdgeStyleTabsImplementation.md) - 实现Microsoft Edge风格标签页的详细指南
3. [代码组织策略](./CodeOrganization.md) - 浏览器组件的代码组织策略，包括组件拆分、自定义Hook和工具函数的设计思路
4. [浏览器组件参考文档](./BrowserComponentsReference.md) - 浏览器组件中所有文件的详细参考，包括每个文件的主要功能、导出的函数/组件及其用途
5. Webview属性设置 - 布尔属性在React中需要作为字符串传递，而不是布尔值
6. Electron安全设置 - 关于webview的安全设置和注意事项
7. 事件监听器管理 - 如何正确管理webview事件监听器的生命周期

## 最佳实践

### Webview事件监听

- 每次渲染时都重新设置事件监听器，确保事件能被正确触发
- 使用引用映射（如`webviewRefs`）来管理多个webview实例
- 使用清理函数映射（如`cleanupFunctionsRef`）来管理事件监听器的清理

### 标签页管理

- 使用唯一ID标识每个标签页
- 在标签页状态中保存完整的信息（URL、标题、加载状态等）
- 使用本地存储保存标签页状态，确保应用重启后能恢复

### 样式与交互

- 使用Edge风格的标签页设计，包括圆角、动画效果等
- 实现拖拽功能时，确保有适当的视觉反馈
- 标签页标题应该有省略号处理，避免过长

## 常见问题

1. 标签页标题不更新 - 见[标签页标题更新问题](./TabTitleUpdateIssue.md)
2. Webview布尔属性警告 - 使用`data-*`属性和`setAttribute`方法设置
3. 安全警告 - 关于`allowRunningInsecureContent`和`nodeIntegration`的安全风险
4. 内存泄漏 - 由于事件监听器未正确清理导致的内存问题
