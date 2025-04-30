/**
 * 插件文件处理服务
 */
import { PluginMeta } from '@renderer/types/plugin'

// 解析插件文件
export async function parsePluginFile(file: File): Promise<PluginMeta | null> {
  try {
    // 处理单个JS/TS文件
    if (
      file.name.endsWith('.js') ||
      file.name.endsWith('.ts') ||
      file.name.endsWith('.jsx') ||
      file.name.endsWith('.tsx')
    ) {
      return await parseSingleScriptFile(file)
    }

    // 处理ZIP包
    if (file.name.endsWith('.zip')) {
      return await parseZipFile(file)
    }

    console.error('不支持的文件类型:', file.type)
    return null
  } catch (error) {
    console.error('解析插件文件失败:', error)
    return null
  }
}

// 解析单个脚本文件
async function parseSingleScriptFile(file: File): Promise<PluginMeta | null> {
  try {
    const code = await readFileAsText(file)

    // 提取元数据
    const id = file.name.replace(/\.(js|ts|jsx|tsx)$/, '')
    const metadata: PluginMeta = {
      id,
      name: id,
      description: `从${file.name}导入的插件`,
      version: '1.0.0',
      author: '用户上传',
      icon: '📦',
      requiredModules: [],
      code
    }

    return metadata
  } catch (error) {
    console.error('解析脚本文件失败:', error)
    return null
  }
}

// 解析ZIP包
async function parseZipFile(file: File): Promise<PluginMeta | null> {
  // 由于Electron环境限制，我们模拟一个基本实现
  // 实际实现需要使用JSZip或Node.js的fs模块
  try {
    // 提取ZIP中的manifest.json
    const fileName = file.name.replace('.zip', '')
    const metadata: PluginMeta = {
      id: fileName,
      name: fileName,
      description: `从${file.name}导入的插件包`,
      version: '1.0.0',
      author: '用户上传',
      icon: '📦',
      requiredModules: [],
      isPackage: true,
      packageFile: file
    }

    return metadata
  } catch (error) {
    console.error('解析ZIP文件失败:', error)
    return null
  }
}

// 读取文件为文本
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

// 执行插件代码
export function executePluginCode(code: string): any {
  try {
    // 注意：这种方式不安全，生产环境应使用安全沙箱
    // 创建一个沙箱环境
    const sandbox = {}
    const sandboxFunction = new Function('sandbox', `with(sandbox) { ${code} }`)
    sandboxFunction(sandbox)

    return sandbox
  } catch (error) {
    console.error('执行插件代码失败:', error)
    return null
  }
}

// 注册上传的插件
export function preparePluginFromCode(code: string): PluginMeta | null {
  try {
    // 从代码中提取插件信息
    // 这里简化处理，实际应该解析代码并验证

    // 构造一个临时ID
    const id = `custom-plugin-${Date.now()}`

    return {
      id,
      name: '自定义插件',
      description: '用户上传的自定义插件',
      version: '1.0.0',
      author: '用户',
      icon: '📦',
      requiredModules: [],
      code
    }
  } catch (error) {
    console.error('创建插件失败:', error)
    return null
  }
}
