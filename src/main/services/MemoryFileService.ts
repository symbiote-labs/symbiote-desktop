import log from 'electron-log'
import { promises as fs } from 'fs'
import path from 'path'

import { getConfigDir } from '../utils/file'

// 定义记忆文件路径
const memoryDataPath = path.join(getConfigDir(), 'memory-data.json')
// 定义长期记忆文件路径
const longTermMemoryDataPath = path.join(getConfigDir(), 'long-term-memory-data.json')

export class MemoryFileService {
  constructor() {
    // 注册处理函数已移至ipc.ts文件中
    // 这里不需要在构造函数中调用注册方法
  }

  async loadData() {
    try {
      // 确保配置目录存在
      const configDir = path.dirname(memoryDataPath)
      try {
        await fs.mkdir(configDir, { recursive: true })
      } catch (mkdirError) {
        log.warn('Failed to create config directory, it may already exist:', mkdirError)
      }

      // 检查文件是否存在
      try {
        await fs.access(memoryDataPath)
      } catch (accessError) {
        // 文件不存在，创建默认文件
        log.info('Memory data file does not exist, creating default file')
        const defaultData = {
          memoryLists: [
            {
              id: 'default',
              name: '默认列表',
              isActive: true
            }
          ],
          shortMemories: [],
          assistantMemories: [],
          assistantMemoryActive: true,
          assistantMemoryAnalyzeModel: 'gpt-3.5-turbo',
          analyzeModel: 'gpt-3.5-turbo',
          shortMemoryAnalyzeModel: 'gpt-3.5-turbo',
          historicalContextAnalyzeModel: 'gpt-3.5-turbo',
          vectorizeModel: 'gpt-3.5-turbo'
        }
        await fs.writeFile(memoryDataPath, JSON.stringify(defaultData, null, 2))
        return defaultData
      }

      // 读取文件
      const data = await fs.readFile(memoryDataPath, 'utf-8')
      const parsedData = JSON.parse(data)
      log.info('Memory data loaded successfully')
      return parsedData
    } catch (error) {
      log.error('Failed to load memory data:', error)
      return null
    }
  }

  async saveData(data: any, forceOverwrite: boolean = false) {
    try {
      // 确保配置目录存在
      const configDir = path.dirname(memoryDataPath)
      try {
        await fs.mkdir(configDir, { recursive: true })
      } catch (mkdirError) {
        log.warn('Failed to create config directory, it may already exist:', mkdirError)
      }

      // 如果强制覆盖，直接使用传入的数据
      if (forceOverwrite) {
        log.info('Force overwrite enabled for short memory data, using provided data directly')

        // 确保数据包含必要的字段
        const defaultData = {
          memoryLists: [],
          shortMemories: [],
          assistantMemories: [],
          assistantMemoryActive: true,
          assistantMemoryAnalyzeModel: '',
          analyzeModel: '',
          shortMemoryAnalyzeModel: '',
          historicalContextAnalyzeModel: '',
          vectorizeModel: ''
        }

        // 合并默认数据和传入的数据，确保数据结构完整
        const completeData = { ...defaultData, ...data }

        // 保存数据
        await fs.writeFile(memoryDataPath, JSON.stringify(completeData, null, 2))
        log.info('Memory data saved successfully (force overwrite)')
        return true
      }

      // 尝试读取现有数据并合并
      let existingData = {}
      try {
        await fs.access(memoryDataPath)
        const fileContent = await fs.readFile(memoryDataPath, 'utf-8')
        existingData = JSON.parse(fileContent)
        log.info('Existing memory data loaded for merging')
      } catch (readError) {
        log.warn('No existing memory data found or failed to read:', readError)
        // 如果文件不存在或读取失败，使用空对象
      }

      // 合并接收到的部分数据 (data) 到现有数据 (existingData)
      // 使用 Object.assign 或 spread operator 进行浅合并
      // 对于嵌套对象或数组，如果需要深度合并，可能需要更复杂的逻辑，
      // 但对于顶层设置（如提示词字符串），浅合并足够。
      const mergedData = { ...existingData, ...data }
      log.info('Merging partial data into existing memory data')

      // 保存合并后的数据
      await fs.writeFile(memoryDataPath, JSON.stringify(mergedData, null, 2))
      log.info('Memory data saved successfully')
      return true
    } catch (error) {
      log.error('Failed to save memory data:', error)
      return false
    }
  }

  async loadLongTermData() {
    try {
      // 确保配置目录存在
      const configDir = path.dirname(longTermMemoryDataPath)
      try {
        await fs.mkdir(configDir, { recursive: true })
      } catch (mkdirError) {
        log.warn('Failed to create config directory, it may already exist:', mkdirError)
      }

      // 检查文件是否存在
      try {
        await fs.access(longTermMemoryDataPath)
      } catch (accessError) {
        // 文件不存在，创建默认文件
        log.info('Long-term memory data file does not exist, creating default file')
        const now = new Date().toISOString()
        const defaultData = {
          memoryLists: [
            {
              id: 'default',
              name: '默认列表',
              isActive: true,
              createdAt: now,
              updatedAt: now
            }
          ],
          memories: [],
          currentListId: 'default',
          analyzeModel: 'gpt-3.5-turbo'
        }
        await fs.writeFile(longTermMemoryDataPath, JSON.stringify(defaultData, null, 2))
        return defaultData
      }

      // 读取文件
      const data = await fs.readFile(longTermMemoryDataPath, 'utf-8')
      const parsedData = JSON.parse(data)
      log.info('Long-term memory data loaded successfully')
      return parsedData
    } catch (error) {
      log.error('Failed to load long-term memory data:', error)
      return null
    }
  }

  async saveLongTermData(data: any, forceOverwrite: boolean = false) {
    try {
      // 确保配置目录存在
      const configDir = path.dirname(longTermMemoryDataPath)
      try {
        await fs.mkdir(configDir, { recursive: true })
      } catch (mkdirError) {
        log.warn('Failed to create config directory, it may already exist:', mkdirError)
      }

      // 如果强制覆盖，直接使用传入的数据
      if (forceOverwrite) {
        log.info('Force overwrite enabled, using provided data directly')

        // 确保数据包含必要的字段
        const defaultData = {
          memoryLists: [],
          memories: [],
          currentListId: '',
          analyzeModel: ''
        }

        // 合并默认数据和传入的数据，确保数据结构完整
        const completeData = { ...defaultData, ...data }

        // 保存数据
        await fs.writeFile(longTermMemoryDataPath, JSON.stringify(completeData, null, 2))
        log.info('Long-term memory data saved successfully (force overwrite)')
        return true
      }

      // 尝试读取现有数据并合并
      let existingData = {}
      try {
        await fs.access(longTermMemoryDataPath)
        const fileContent = await fs.readFile(longTermMemoryDataPath, 'utf-8')
        existingData = JSON.parse(fileContent)
        log.info('Existing long-term memory data loaded for merging')
      } catch (readError) {
        log.warn('No existing long-term memory data found or failed to read:', readError)
        // 如果文件不存在或读取失败，使用空对象
      }

      // 合并数据，注意数组的处理
      const mergedData = { ...existingData }

      // 处理每个属性
      Object.entries(data).forEach(([key, value]) => {
        // 如果是数组属性，需要特殊处理
        if (Array.isArray(value) && Array.isArray(mergedData[key])) {
          // 对于 memories 和 shortMemories，直接使用传入的数组，完全替换现有的记忆
          if (key === 'memories' || key === 'shortMemories') {
            mergedData[key] = value
            log.info(`Replacing ${key} array with provided data`)
          } else {
            // 其他数组属性，使用新值
            mergedData[key] = value
          }
        } else {
          // 非数组属性，直接使用新值
          mergedData[key] = value
        }
      })

      // 保存合并后的数据
      await fs.writeFile(longTermMemoryDataPath, JSON.stringify(mergedData, null, 2))
      log.info('Long-term memory data saved successfully')
      return true
    } catch (error) {
      log.error('Failed to save long-term memory data:', error)
      return false
    }
  }

  /**
   * 删除指定ID的短期记忆
   * @param id 要删除的短期记忆ID
   * @returns 是否成功删除
   */
  async deleteShortMemoryById(id: string) {
    try {
      // 检查文件是否存在
      try {
        await fs.access(memoryDataPath)
      } catch (accessError) {
        log.error('Memory data file does not exist, cannot delete memory')
        return false
      }

      // 读取文件
      const fileContent = await fs.readFile(memoryDataPath, 'utf-8')
      const data = JSON.parse(fileContent)

      // 检查shortMemories数组是否存在
      if (!data.shortMemories || !Array.isArray(data.shortMemories)) {
        log.error('No shortMemories array found in memory data file')
        return false
      }

      // 过滤掉要删除的记忆
      const originalLength = data.shortMemories.length
      data.shortMemories = data.shortMemories.filter((memory: any) => memory.id !== id)

      // 如果长度没变，说明没有找到要删除的记忆
      if (data.shortMemories.length === originalLength) {
        log.warn(`Short memory with ID ${id} not found, nothing to delete`)
        return false
      }

      // 写回文件
      await fs.writeFile(memoryDataPath, JSON.stringify(data, null, 2))
      log.info(`Successfully deleted short memory with ID ${id}`)
      return true
    } catch (error) {
      log.error('Failed to delete short memory:', error)
      return false
    }
  }

  // 注册IPC处理程序的方法已移至ipc.ts
  // 保留此注释作为提醒
}

// 创建并导出MemoryFileService实例
export const memoryFileService = new MemoryFileService()
