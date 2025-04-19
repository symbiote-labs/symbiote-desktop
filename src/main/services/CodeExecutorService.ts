import { spawn } from 'child_process'
// 如果将来需要使用这些工具函数，可以取消注释
// import { getBinaryPath, isBinaryExists } from '@main/utils/process'
import log from 'electron-log'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// 支持的语言类型
export enum CodeLanguage {
  JavaScript = 'javascript',
  Python = 'python'
}

// 执行结果接口
export interface ExecutionResult {
  success: boolean
  output: string
  error?: string
}

/**
 * 代码执行器服务
 * 提供安全的代码执行环境，支持 JavaScript 和 Python
 */
export class CodeExecutorService {
  private readonly tempDir: string

  constructor() {
    // 创建临时目录用于存放执行的代码文件
    this.tempDir = path.join(os.tmpdir(), 'cherry-code-executor')
    this.ensureTempDir()
  }

  /**
   * 确保临时目录存在
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  /**
   * 获取支持的编程语言列表
   */
  public async getSupportedLanguages(): Promise<string[]> {
    const languages = [CodeLanguage.JavaScript]

    // 检查是否安装了 Python
    if (await this.isPythonAvailable()) {
      languages.push(CodeLanguage.Python)
    }

    return languages
  }

  /**
   * 检查 Python 是否可用
   */
  private async isPythonAvailable(): Promise<boolean> {
    try {
      const pythonProcess = spawn('python', ['--version'])
      return new Promise<boolean>((resolve) => {
        pythonProcess.on('close', (code) => {
          resolve(code === 0)
        })

        // 设置超时
        setTimeout(() => resolve(false), 1000)
      })
    } catch (error) {
      return false
    }
  }

  /**
   * 执行 JavaScript 代码
   * @param code JavaScript 代码
   * @returns 执行结果
   */
  public async executeJavaScript(code: string): Promise<ExecutionResult> {
    const fileId = uuidv4()
    const tempFilePath = path.join(this.tempDir, `${fileId}.js`)

    try {
      // 写入临时文件
      fs.writeFileSync(tempFilePath, code)

      // 使用 Node.js 执行代码
      return await this.runNodeScript(tempFilePath)
    } catch (error) {
      log.error('[CodeExecutor] Error executing JavaScript:', error)
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      // 清理临时文件
      this.cleanupTempFile(tempFilePath)
    }
  }

  /**
   * 执行 Python 代码
   * @param code Python 代码
   * @returns 执行结果
   */
  public async executePython(code: string): Promise<ExecutionResult> {
    const fileId = uuidv4()
    const tempFilePath = path.join(this.tempDir, `${fileId}.py`)

    try {
      // 写入临时文件
      fs.writeFileSync(tempFilePath, code)

      // 执行 Python 代码
      return await this.runPythonScript(tempFilePath)
    } catch (error) {
      log.error('[CodeExecutor] Error executing Python:', error)
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      // 清理临时文件
      this.cleanupTempFile(tempFilePath)
    }
  }

  /**
   * 运行 Node.js 脚本
   * @param scriptPath 脚本路径
   * @returns 执行结果
   */
  private async runNodeScript(scriptPath: string): Promise<ExecutionResult> {
    return new Promise<ExecutionResult>((resolve) => {
      let stdout = ''
      let stderr = ''

      // 使用 Node.js 执行脚本
      const nodeProcess = spawn(process.execPath, [scriptPath], {
        env: {
          ...process.env,
          // 设置为 Node.js 模式，确保在 Electron 环境中正确执行
          ELECTRON_RUN_AS_NODE: '1',
          // 限制访问权限
          NODE_OPTIONS: '--no-warnings --experimental-permission --allow-fs-read=* --allow-fs-write=' + this.tempDir
        }
      })

      nodeProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      nodeProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      nodeProcess.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: stdout
          })
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr
          })
        }
      })

      // 设置超时（10秒）
      setTimeout(() => {
        nodeProcess.kill()
        resolve({
          success: false,
          output: stdout,
          error: 'Execution timed out after 10 seconds'
        })
      }, 10000)
    })
  }

  /**
   * 运行 Python 脚本
   * @param scriptPath 脚本路径
   * @returns 执行结果
   */
  private async runPythonScript(scriptPath: string): Promise<ExecutionResult> {
    return new Promise<ExecutionResult>((resolve) => {
      let stdout = ''
      let stderr = ''

      // 使用 Python 执行脚本
      const pythonProcess = spawn('python', [scriptPath], {
        env: { ...process.env }
      })

      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: stdout
          })
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr
          })
        }
      })

      // 设置超时（10秒）
      setTimeout(() => {
        pythonProcess.kill()
        resolve({
          success: false,
          output: stdout,
          error: 'Execution timed out after 10 seconds'
        })
      }, 10000)
    })
  }

  /**
   * 清理临时文件
   * @param filePath 文件路径
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch (error) {
      log.error('[CodeExecutor] Error cleaning up temp file:', error)
    }
  }
}

// 创建单例
export const codeExecutorService = new CodeExecutorService()
