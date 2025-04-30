/**
 * 插件索引文件
 * 用于集中导出所有自定义插件
 */
import { Plugin } from '@renderer/types/plugin'

import SimpleTextTools from './SimpleTextTools'

/**
 * 日历插件定义
 * 直接在这里定义，不需要单独的文件
 */
const SimpleCalendar: Plugin = {
  // 插件元数据
  id: 'simple-calendar',
  name: '简易日历',
  description: '提供简单的日历视图与日程管理功能',
  version: '1.0.0',
  author: 'Cherry Ludi',
  icon: '📅',
  requiredModules: ['dayjs'],

  // 插件状态
  state: {
    isInstalled: false,
    isActive: false,
    isLoaded: false,
    hasError: false
  },

  // 储存API引用
  api: null,

  // 安装钩子
  onInstall: async function (): Promise<boolean> {
    console.log('安装简易日历插件')
    return true
  },

  // 激活钩子
  onActivate: async function (): Promise<boolean> {
    console.log('激活简易日历插件')
    return true
  },

  // 停用钩子
  onDeactivate: async function (): Promise<boolean> {
    console.log('停用简易日历插件')
    return true
  },

  // 卸载钩子
  onUninstall: async function (): Promise<boolean> {
    console.log('卸载简易日历插件')
    return true
  }
}

/**
 * Markdown编辑器插件定义
 */
const MarkdownEditor: Plugin = {
  // 插件元数据
  id: 'markdown-editor',
  name: '高级Markdown编辑器',
  description: '提供语法高亮、预览和导出功能的Markdown编辑器',
  version: '1.0.0',
  author: 'Cherry Ludi',
  icon: '📝',
  requiredModules: ['npm'],

  // 插件状态
  state: {
    isInstalled: false,
    isActive: false,
    isLoaded: false,
    hasError: false
  },

  // 储存API引用
  api: null,

  // 安装钩子
  onInstall: async function (): Promise<boolean> {
    console.log('安装高级Markdown编辑器插件')
    return true
  },

  // 激活钩子
  onActivate: async function (): Promise<boolean> {
    console.log('激活高级Markdown编辑器插件')
    return true
  },

  // 停用钩子
  onDeactivate: async function (): Promise<boolean> {
    console.log('停用高级Markdown编辑器插件')
    return true
  },

  // 卸载钩子
  onUninstall: async function (): Promise<boolean> {
    console.log('卸载高级Markdown编辑器插件')
    return true
  }
}

/**
 * 代码分析工具插件定义
 */
const CodeAnalyzer: Plugin = {
  // 插件元数据
  id: 'code-analyzer',
  name: '代码分析工具',
  description: '分析代码质量并提供改进建议',
  version: '1.0.0',
  author: 'Cherry Ludi',
  icon: '🔍',
  requiredModules: ['vue-codemirror-multi'],

  // 插件状态
  state: {
    isInstalled: false,
    isActive: false,
    isLoaded: false,
    hasError: false
  },

  // 储存API引用
  api: null,

  // 安装钩子
  onInstall: async function (): Promise<boolean> {
    console.log('安装代码分析工具插件')
    return true
  },

  // 激活钩子
  onActivate: async function (): Promise<boolean> {
    console.log('激活代码分析工具插件')
    return true
  },

  // 停用钩子
  onDeactivate: async function (): Promise<boolean> {
    console.log('停用代码分析工具插件')
    return true
  },

  // 卸载钩子
  onUninstall: async function (): Promise<boolean> {
    console.log('卸载代码分析工具插件')
    return true
  }
}

/**
 * PDF转Word插件定义
 */
const PDFToWord: Plugin = {
  // 插件元数据
  id: 'pdf-to-word',
  name: 'PDF转Word工具',
  description: '将PDF文件转换为Word文档格式',
  version: '1.0.0',
  author: 'Cherry Ludi',
  icon: '📄',
  requiredModules: ['pdf-parse', 'docx', 'pdf-lib', 'pdfjs-dist'],

  // 插件状态
  state: {
    isInstalled: false,
    isActive: false,
    isLoaded: false,
    hasError: false
  },

  // 储存API引用
  api: null,

  // 安装钩子
  onInstall: async function (): Promise<boolean> {
    console.log('安装PDF转Word插件')
    return true
  },

  // 激活钩子
  onActivate: async function (): Promise<boolean> {
    console.log('激活PDF转Word插件')
    return true
  },

  // 停用钩子
  onDeactivate: async function (): Promise<boolean> {
    console.log('停用PDF转Word插件')
    return true
  },

  // 卸载钩子
  onUninstall: async function (): Promise<boolean> {
    console.log('卸载PDF转Word插件')
    return true
  }
}

// 导出插件列表 - 所有插件都在这里注册
export default [SimpleTextTools, SimpleCalendar, MarkdownEditor, CodeAnalyzer, PDFToWord]

// 导出单个插件，方便单独访问
export { CodeAnalyzer, MarkdownEditor, PDFToWord, SimpleCalendar, SimpleTextTools }
