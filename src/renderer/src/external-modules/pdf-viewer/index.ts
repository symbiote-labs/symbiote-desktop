// PDF预览模块入口文件
// 这个文件将在模块被激活时加载

// 模块信息
export const moduleInfo = {
  id: 'pdf-viewer',
  name: 'PDF预览',
  description: '支持在应用内直接查看PDF文件',
  version: '1.0.0',
  category: '文档处理'
}

// 模块初始化函数
export const initialize = () => {
  console.log('PDF预览模块已初始化')
  // 这里可以注册组件、添加事件监听器等
}

// 模块清理函数
export const cleanup = () => {
  console.log('PDF预览模块已清理')
  // 这里可以移除事件监听器、清理资源等
}

// 导出模块API
export default {
  moduleInfo,
  initialize,
  cleanup
}
