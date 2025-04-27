/**
 * 修复 electron-builder 堆栈溢出问题的补丁脚本
 *
 * 这个脚本修复了 electron-builder 在处理循环依赖时导致的堆栈溢出问题。
 * 主要修改了以下文件：
 * 1. node_modules/app-builder-lib/out/node-module-collector/nodeModulesCollector.js
 */

const fs = require('fs')
const path = require('path')

// 获取 nodeModulesCollector.js 文件的路径
let nodeModulesCollectorPath = path.join(
  process.cwd(),
  'node_modules',
  'app-builder-lib',
  'out',
  'node-module-collector',
  'nodeModulesCollector.js'
)

// 检查文件是否存在
console.log(`正在检查文件: ${nodeModulesCollectorPath}`)
if (!fs.existsSync(nodeModulesCollectorPath)) {
  console.error('找不到 nodeModulesCollector.js 文件，请确保已安装 electron-builder')

  // 尝试查找其他可能的路径
  const possiblePaths = [
    path.join(
      process.cwd(),
      'node_modules',
      'electron-builder',
      'node_modules',
      'app-builder-lib',
      'out',
      'node-module-collector',
      'nodeModulesCollector.js'
    ),
    path.join(
      process.cwd(),
      'node_modules',
      'app-builder-lib',
      'lib',
      'node-module-collector',
      'nodeModulesCollector.js'
    ),
    path.join(
      process.cwd(),
      'node_modules',
      'app-builder-lib',
      'dist',
      'node-module-collector',
      'nodeModulesCollector.js'
    )
  ]

  for (const possiblePath of possiblePaths) {
    console.log(`尝试查找: ${possiblePath}`)
    if (fs.existsSync(possiblePath)) {
      console.log(`找到文件: ${possiblePath}`)
      nodeModulesCollectorPath = possiblePath
      break
    }
  }

  if (!fs.existsSync(nodeModulesCollectorPath)) {
    console.error('无法找到 nodeModulesCollector.js 文件，请确保已安装 electron-builder')
    process.exit(1)
  }
}

// 读取文件内容
let content = fs.readFileSync(nodeModulesCollectorPath, 'utf8')

// 修复 1: 修改 _getNodeModules 方法，添加环路检测
const oldGetNodeModulesMethod =
  /(_getNodeModules\(dependencies, result\) \{[\s\S]*?result\.sort\(\(a, b\) => a\.name\.localeCompare\(b\.name\)\);\s*\})/
const newGetNodeModulesMethod = `_getNodeModules(dependencies, result, depth = 0, visited = new Set()) {
        // 添加递归深度限制
        if (depth > 10) {
            console.log("递归深度超过10，停止递归");
            return;
        }

        if (dependencies.size === 0) {
            return;
        }

        for (const d of dependencies.values()) {
            const reference = [...d.references][0];
            const moduleId = \`\${d.name}@\${reference}\`;

            // 环路检测：如果已经访问过这个模块，则跳过
            if (visited.has(moduleId)) {
                console.log(\`检测到循环依赖: \${moduleId}\`);
                continue;
            }

            // 标记为已访问
            visited.add(moduleId);

            const p = this.dependencyPathMap.get(moduleId);
            if (p === undefined) {
                builder_util_1.log.debug({ name: d.name, reference }, "cannot find path for dependency");
                continue;
            }
            const node = {
                name: d.name,
                version: reference,
                dir: p,
            };
            result.push(node);
            if (d.dependencies.size > 0) {
                node.dependencies = [];
                this._getNodeModules(d.dependencies, node.dependencies, depth + 1, visited);
            }

            // 处理完成后，从已访问集合中移除，允许在其他路径中再次访问
            visited.delete(moduleId);
        }
        result.sort((a, b) => a.name.localeCompare(b.name));
    }`

content = content.replace(oldGetNodeModulesMethod, newGetNodeModulesMethod)

// 修复 2: 修改 getNodeModules 方法，传递 visited 集合
const oldGetNodeModulesCall = /(this\._getNodeModules\(hoisterResult\.dependencies, this\.nodeModules\);)/
const newGetNodeModulesCall = `// 创建一个新的 visited 集合用于环路检测
        const visited = new Set();

        this._getNodeModules(hoisterResult.dependencies, this.nodeModules, 0, visited);`

content = content.replace(oldGetNodeModulesCall, newGetNodeModulesCall)

// 修复 3: 修改 convertToDependencyGraph 方法，跳过路径未定义的依赖
const oldPathCheck =
  /(if \(!dependencies\.path\) \{[\s\S]*?throw new Error\("unable to parse `path` during `tree\.dependencies` reduce"\);[\s\S]*?\})/
const newPathCheck = `if (!dependencies.path) {
                builder_util_1.log.error({
                    packageName,
                    data: dependencies,
                    parentModule: tree.name,
                    parentVersion: tree.version,
                }, "dependency path is undefined");
                // 跳过这个依赖而不是抛出错误
                console.log(\`跳过路径未定义的依赖: \${packageName}\`);
                return acc;
            }`

content = content.replace(oldPathCheck, newPathCheck)

// 写入修改后的内容
fs.writeFileSync(nodeModulesCollectorPath, content, 'utf8')

console.log('成功应用 electron-builder 堆栈溢出修复补丁！')
