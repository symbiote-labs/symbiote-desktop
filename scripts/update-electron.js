/**
 * Electron 版本更新脚本
 *
 * 这个脚本帮助您逐步更新到更新版本的 Electron
 * 使用方法: node scripts/update-electron.js [target-version]
 *
 * 例如: node scripts/update-electron.js 32.0.0
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')
const https = require('https')

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

// 从 npm 获取 Electron 的可用版本
function getAvailableElectronVersions() {
  return new Promise((resolve, reject) => {
    https
      .get('https://registry.npmjs.org/electron', (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            const versions = Object.keys(json.versions)
              .filter((v) => !v.includes('-')) // 过滤掉预发布版本
              .sort((a, b) => compareVersions(a, b))
            resolve(versions)
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', (error) => {
        reject(error)
      })
  })
}

// 比较版本号
function compareVersions(a, b) {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0
    const partB = partsB[i] || 0

    if (partA < partB) return -1
    if (partA > partB) return 1
  }

  return 0
}

// 获取从当前版本到目标版本的升级路径
function getUpgradePath(currentVersion, targetVersion, allVersions) {
  // 清理版本号，移除可能的前缀（如 ^、~）
  currentVersion = currentVersion.replace(/[^0-9.]/g, '')

  // 过滤出在当前版本和目标版本之间的所有版本
  const relevantVersions = allVersions.filter(
    (v) => compareVersions(v, currentVersion) > 0 && compareVersions(v, targetVersion) <= 0
  )

  // 按主要版本分组
  const versionsByMajor = {}
  relevantVersions.forEach((v) => {
    const major = v.split('.')[0]
    if (!versionsByMajor[major]) {
      versionsByMajor[major] = []
    }
    versionsByMajor[major].push(v)
  })

  // 为每个主要版本选择最新的次要版本
  const upgradePath = []
  Object.keys(versionsByMajor)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((major) => {
      const versions = versionsByMajor[major]
      // 添加该主要版本的最新版本
      upgradePath.push(versions[versions.length - 1])
    })

  // 确保包含目标版本
  if (upgradePath.length === 0 || upgradePath[upgradePath.length - 1] !== targetVersion) {
    upgradePath.push(targetVersion)
  }

  return upgradePath
}

// 主函数
async function main() {
  try {
    const currentVersionFull = getCurrentElectronVersion()
    const currentVersion = currentVersionFull.replace(/[^0-9.]/g, '')
    console.log(`当前 Electron 版本: ${currentVersionFull} (${currentVersion})`)

    // 获取可用的 Electron 版本
    console.log('正在获取可用的 Electron 版本...')
    const allVersions = await getAvailableElectronVersions()

    // 获取最新版本
    const latestVersion = allVersions[allVersions.length - 1]
    console.log(`最新的 Electron 版本: ${latestVersion}`)

    // 确定目标版本
    let targetVersion = process.argv[2] || latestVersion

    if (compareVersions(targetVersion, currentVersion) <= 0) {
      console.log(`目标版本 ${targetVersion} 不高于当前版本 ${currentVersion}，无需更新`)
      rl.close()
      return
    }

    // 获取升级路径
    const upgradePath = getUpgradePath(currentVersion, targetVersion, allVersions)

    console.log(`\n从 ${currentVersion} 到 ${targetVersion} 的推荐升级路径:`)
    upgradePath.forEach((v, i) => {
      console.log(`${i + 1}. ${v}`)
    })

    rl.question('\n是否按照推荐路径逐步升级？(y/n) ', async (answer) => {
      if (answer.toLowerCase() !== 'y') {
        console.log('操作已取消')
        rl.close()
        return
      }

      // 保存原始版本，以便在失败时恢复
      const originalVersion = currentVersionFull

      // 逐步升级
      for (let i = 0; i < upgradePath.length; i++) {
        const version = upgradePath[i]
        console.log(`\n===== 正在升级到 Electron ${version} (${i + 1}/${upgradePath.length}) =====`)

        updateElectronVersion(version)

        if (!installDependencies()) {
          console.log(`Electron ${version} 安装依赖失败`)

          const restoreAnswer = await new Promise((resolve) => {
            rl.question('是否恢复到原始版本？(y/n) ', resolve)
          })

          if (restoreAnswer.toLowerCase() === 'y') {
            console.log(`正在恢复到原始版本 ${originalVersion}`)
            updateElectronVersion(originalVersion)
            installDependencies()
          }

          rl.close()
          return
        }

        const testAnswer = await new Promise((resolve) => {
          rl.question(`依赖安装成功，是否测试 Electron ${version}？(y/n) `, resolve)
        })

        if (testAnswer.toLowerCase() === 'y') {
          if (!testApp()) {
            console.log(`Electron ${version} 测试失败`)

            const restoreAnswer = await new Promise((resolve) => {
              rl.question('是否恢复到原始版本？(y/n) ', resolve)
            })

            if (restoreAnswer.toLowerCase() === 'y') {
              console.log(`正在恢复到原始版本 ${originalVersion}`)
              updateElectronVersion(originalVersion)
              installDependencies()
            }

            rl.close()
            return
          }

          console.log(`Electron ${version} 测试成功！`)
        }

        if (i < upgradePath.length - 1) {
          const continueAnswer = await new Promise((resolve) => {
            rl.question('是否继续升级到下一个版本？(y/n) ', resolve)
          })

          if (continueAnswer.toLowerCase() !== 'y') {
            console.log(`升级停止在 Electron ${version}`)
            rl.close()
            return
          }
        }
      }

      console.log(`\n成功升级到 Electron ${targetVersion}！`)
      rl.close()
    })
  } catch (error) {
    console.error('发生错误:', error)
    rl.close()
  }
}

// 运行主函数
main()
