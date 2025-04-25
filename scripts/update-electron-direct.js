/**
 * Electron 直接版本更新脚本
 *
 * 这个脚本帮助您直接更新到指定版本的 Electron
 * 使用方法: node scripts/update-electron-direct.js [version]
 *
 * 例如: node scripts/update-electron-direct.js 32.0.0
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

// 创建命令行交互界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// 获取当前 package.json 中的 Electron 版本
function getCurrentElectronVersion() {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  return packageJson.devDependencies.electron
}

// 更新 package.json 中的 Electron 版本
function updateElectronVersion(version) {
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))

  // 保存旧版本
  const oldVersion = packageJson.devDependencies.electron

  // 更新版本
  packageJson.devDependencies.electron = version
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8')

  console.log(`已更新 package.json 中的 Electron 版本: ${oldVersion} -> ${version}`)
  return oldVersion
}

// 安装依赖
function installDependencies() {
  console.log('正在安装依赖...')
  try {
    execSync('yarn install', { stdio: 'inherit' })
    return true
  } catch (error) {
    console.error('安装依赖失败:', error.message)
    return false
  }
}

// 测试应用
function testApp() {
  console.log('正在启动开发模式测试应用...')
  try {
    execSync('npm run dev', { stdio: 'inherit' })
    return true
  } catch (error) {
    console.error('测试应用失败:', error.message)
    return false
  }
}

// 主函数
async function main() {
  const targetVersion = process.argv[2]

  if (!targetVersion) {
    console.error('请指定目标 Electron 版本')
    console.log('使用方法: node scripts/update-electron-direct.js [version]')
    console.log('例如: node scripts/update-electron-direct.js 32.0.0')
    rl.close()
    return
  }

  const currentVersion = getCurrentElectronVersion()
  console.log(`当前 Electron 版本: ${currentVersion}`)

  rl.question(`确定要直接更新到 Electron ${targetVersion} 吗？(y/n) `, (answer) => {
    if (answer.toLowerCase() !== 'y') {
      console.log('操作已取消')
      rl.close()
      return
    }

    const oldVersion = updateElectronVersion(targetVersion)

    if (!installDependencies()) {
      console.log(`Electron ${targetVersion} 安装依赖失败，正在恢复到原版本 ${oldVersion}`)
      updateElectronVersion(oldVersion)
      installDependencies()
      rl.close()
      return
    }

    rl.question('依赖安装成功，是否测试应用？(y/n) ', (answer) => {
      if (answer.toLowerCase() !== 'y') {
        console.log('跳过测试步骤')
        rl.close()
        return
      }

      if (!testApp()) {
        console.log(`Electron ${targetVersion} 测试失败`)
        rl.question(`是否恢复到原版本 ${oldVersion}？(y/n) `, (answer) => {
          if (answer.toLowerCase() === 'y') {
            console.log(`正在恢复到原版本 ${oldVersion}`)
            updateElectronVersion(oldVersion)
            installDependencies()
          }
          rl.close()
        })
        return
      }

      console.log(`Electron ${targetVersion} 更新并测试成功！`)
      rl.close()
    })
  })
}

// 运行主函数
main().catch((error) => {
  console.error('发生错误:', error)
  rl.close()
})
