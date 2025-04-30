/**
 * 插件系统类型定义
 */

import { ComponentType, ReactElement, ReactNode } from 'react'

/**
 * 扩展点定义 - 应用中可以被插件扩展的位置
 */
export interface ExtensionPoint {
  id: string
  name: string
  description: string
  required?: boolean
  multiple?: boolean
  extensions?: Array<{
    pluginId: string
    component: any
    priority: number
  }>
}

/**
 * 扩展 - 插件向扩展点提供的实际实现
 */
export interface Extension {
  id: string
  pluginId: string
  extensionPointId: string
  priority?: number
  component?: ComponentType<any>
  render?: (props: any) => ReactElement
  handler?: (...args: any[]) => any
  data?: any
}

/**
 * 插件依赖
 */
export interface PluginDependency {
  id: string
  version: string
  required: boolean
}

/**
 * 插件元数据
 */
export interface PluginMeta {
  id: string
  name: string
  version: string
  description: string
  author: string
  homepage?: string
  repository?: string
  size?: string
  icon: ReactNode | string
  tags?: string[]
  dependencies?: Record<string, string>
  requiredModules: string[]
  code?: string
  isPackage?: boolean
  packageFile?: File
}

/**
 * 插件配置
 */
export interface PluginConfig {
  [key: string]: any
}

/**
 * 插件状态
 */
export interface PluginState {
  isInstalled: boolean
  isActive: boolean
  isLoading?: boolean
  isLoaded: boolean
  hasError: boolean
  errorMessage?: string
}

/**
 * 插件UI相关配置
 */
export interface PluginUI {
  settingsComponent?: ReactElement // 插件设置界面组件
  sidebarIcon?: ReactElement // 侧边栏图标
  sidebarPath?: string // 侧边栏点击后的路由路径
  registerExtensions?: PluginExtensionRegistry // 使用统一的PluginExtensionRegistry类型
}

/**
 * 插件生命周期钩子接口
 */
export interface PluginLifecycle {
  onInstall?: () => Promise<boolean> | boolean // 安装时调用
  onActivate?: () => Promise<boolean> | boolean // 激活时调用
  onDeactivate?: () => Promise<boolean> | boolean // 停用时调用
  onUninstall?: () => Promise<boolean> | boolean // 卸载时调用
  onUpdate?: () => Promise<boolean> | boolean // 更新时调用
}

/**
 * 完整的插件接口
 */
export interface Plugin extends Omit<PluginMeta, 'requiredModules'>, Partial<PluginLifecycle>, Partial<PluginUI> {
  state: PluginState // 插件状态
  enabled?: boolean
  loaded?: boolean
  isBuiltIn?: boolean
  extensionPoints?: ExtensionPoint[]
  extensions?: Extension[]
  pluginDependencies?: PluginDependency[]
  requiredModules?: string[] // 解决与PluginMeta冲突
  config?: PluginConfig
  path?: string
  entryPoint?: string
  error?: string
  api?: any
  onInstall?: () => Promise<boolean>
  onUninstall?: () => Promise<boolean>
  onActivate?: () => Promise<boolean>
  onDeactivate?: () => Promise<boolean>
  registerExtensions?: PluginExtensionRegistry
}

/**
 * 插件API - 提供给插件开发者的API接口
 */
export interface PluginAPI {
  // 注册扩展
  registerExtension: (extension: {
    extensionPointId: string
    component?: ReactNode
    render?: ReactNode
    priority?: number
  }) => string

  // 获取扩展点
  getExtensionPoint: (id: string) => ExtensionPoint | undefined

  // 获取所有扩展点
  getExtensionPoints: () => Record<string, ExtensionPoint>

  // 获取插件
  getPlugin: (id: string) => Plugin | undefined

  // 获取所有插件
  getPlugins: () => Record<string, Plugin>

  // 获取当前插件
  getCurrentPlugin: () => Plugin

  // 获取配置
  getConfig: () => any

  // 更新配置
  updateConfig: (config: any) => void

  // 注销扩展
  unregisterExtension: (extensionPointId: string) => void

  // 获取应用API
  getAppAPI: () => any

  // 翻译
  translate: (key: string, options?: any) => string

  // 路由
  navigate: (path: string) => void

  // 通知
  notify: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void

  // 获取插件设置
  getSettings: (pluginId: string) => any

  // 保存插件设置
  saveSettings: (pluginId: string, settings: any) => void

  registerFunction: (name: string, fn: (...args: any[]) => any) => void // 使用具体的函数类型
  registerMenuItem: (item: any) => void
  registerSettingsPanel: (panel: any) => void
  getPluginPath: () => string
  i18n: {
    t: (key: string, options?: any) => string
    changeLanguage: (language: string) => void
    getCurrentLanguage: () => string
  }
}

/**
 * 插件模块 - 插件入口文件导出的模块
 */
export interface PluginModule {
  activate: (api: PluginAPI) => void | Promise<void>
  deactivate?: () => void | Promise<void>
}

// 扩展点注册表
export type ExtensionPointRegistry = {
  [pointId: string]: ExtensionPoint
}

// 插件管理器接口
export interface PluginManager {
  installPlugin: (pluginId: string) => Promise<void>
  uninstallPlugin: (pluginId: string) => Promise<void>
  activatePlugin: (pluginId: string) => Promise<void>
  deactivatePlugin: (pluginId: string) => Promise<void>
  getPlugin: (pluginId: string) => Plugin | undefined
  getPlugins: () => Plugin[]
  getExtensionPoint: (extensionPointId: string) => ExtensionPoint | undefined
  getExtensionPoints: () => Record<string, ExtensionPoint>
  getExtensions: (extensionPointId: string) => Extension[]
}

// 插件加载器接口
export interface PluginLoader {
  loadPlugin: (plugin: Plugin) => Promise<void>
  unloadPlugin: (pluginId: string) => Promise<void>
}

// 插件仓库信息
export interface PluginRepository {
  id: string
  name: string
  url: string
  isOfficial: boolean
}

// 插件搜索结果
export interface PluginSearchResult {
  id: string
  name: string
  version: string
  description: string
  author: string
  downloads: number
  rating?: number
  tags?: string[]
  updatedAt?: string
  repository: PluginRepository
}

// 插件功能接口
export interface PluginFunction {
  id: string
  name: string
  description: string
  icon?: ReactNode
  active: boolean
  moduleId: string
}

// 注册插件时使用的接口
export interface PluginRegistration {
  meta: PluginMeta
  setup: (api: PluginAPI) => void
  activate: () => Promise<void>
  deactivate: () => Promise<void>
}

// 菜单项配置
export interface MenuItemConfig {
  id: string
  title: string
  icon?: ReactNode
  path: string
  order?: number
  parent?: string
}

// 设置面板配置
export interface SettingsPanelConfig {
  id: string
  title: string
  icon?: ReactNode
  component: React.ComponentType
  order?: number
}

// 扩展点类型枚举
export enum ExtensionPointType {
  FUNCTION = 'function',
  MENU_ITEM = 'menuItem',
  SETTINGS_PANEL = 'settingsPanel',
  THEME = 'theme',
  COMMAND = 'command'
}

// NPM包信息
export interface NpmPackageInfo {
  name: string
  version: string
  description: string
  author:
    | {
        name: string
      }
    | string
  homepage?: string
  repository?:
    | {
        url: string
      }
    | string
  dist?: {
    tarball: string
    size: number
  }
  keywords?: string[]
}

// 安装插件请求
export interface InstallPluginRequest {
  pluginId: string
}

// 卸载插件请求
export interface UninstallPluginRequest {
  pluginId: string
}

// 切换插件激活状态请求
export interface TogglePluginRequest {
  pluginId: string
  active: boolean
}

// 插件扩展
export interface PluginExtension {
  component: ReactNode
  render?: ReactNode
  priority?: number
}

// 插件扩展点注册
export interface PluginExtensionRegistry {
  [key: string]: PluginExtension
}
