import { useRuntime } from '@renderer/hooks/useRuntime'
import { Agent } from '@renderer/types'
import { runAsyncFunction } from '@renderer/utils'
import { useEffect, useState } from 'react'

let _agents: Agent[] = []

export const getAgentsFromSystemAgents = (systemAgents: any) => {
  const agents: Agent[] = []
  for (let i = 0; i < systemAgents.length; i++) {
    for (let j = 0; j < systemAgents[i].group.length; j++) {
      const agent = { ...systemAgents[i], group: systemAgents[i].group[j], topics: [], type: 'agent' } as Agent
      agents.push(agent)
    }
  }
  return agents
}

export function useSystemAgents() {
  const [agents, setAgents] = useState<Agent[]>(_agents)
  const { resourcesPath } = useRuntime()

  useEffect(() => {
    runAsyncFunction(async () => {
      if (!resourcesPath || _agents.length > 0) return
      try {
        // 使用window.api.fs.read读取文件
        const fileContent = await window.api.fs.read(resourcesPath + '/data/agents.json')
        console.log('成功读取agents.json文件', typeof fileContent)

        // 输出对象的结构，以便于调试
        if (typeof fileContent === 'object' && fileContent !== null) {
          console.log('文件内容对象的属性:', Object.keys(fileContent))
          console.log('文件内容对象的类型:', Object.prototype.toString.call(fileContent))
          if ('toString' in fileContent) {
            console.log('文件内容的toString结果:', fileContent.toString().substring(0, 100) + '...')
          }
        }

        // 处理Uint8Array类型（二进制数据）
        if (
          fileContent instanceof Uint8Array ||
          Object.prototype.toString.call(fileContent) === '[object Uint8Array]'
        ) {
          console.log('文件内容是Uint8Array类型，转换为字符串')
          // 将Uint8Array转换为字符串
          const decoder = new TextDecoder('utf-8')
          const contentStr = decoder.decode(fileContent)
          console.log('转换后的字符串前100个字符:', contentStr.substring(0, 100))

          try {
            // 尝试解析JSON
            _agents = JSON.parse(contentStr) as Agent[]
            console.log('成功解析Uint8Array内容')
          } catch (parseError) {
            console.error('Uint8Array解析失败:', parseError)
            _agents = []
          }
        }
        // 处理字符串类型
        else if (typeof fileContent === 'string') {
          console.log('文件内容是字符串类型')
          try {
            _agents = JSON.parse(fileContent) as Agent[]
            console.log('成功解析字符串内容')
          } catch (parseError) {
            console.error('字符串解析失败:', parseError)
            _agents = []
          }
        }
        // 处理数组类型
        else if (Array.isArray(fileContent)) {
          console.log('文件内容是数组类型，直接使用')
          _agents = fileContent as Agent[]
        }
        // 处理其他对象类型
        else if (typeof fileContent === 'object' && fileContent !== null) {
          console.log('文件内容是其他对象类型')
          // 如果对象有data属性，尝试使用它
          if ('data' in fileContent) {
            const data = (fileContent as any).data
            if (Array.isArray(data)) {
              _agents = data as Agent[]
              console.log('成功使用对象的data属性')
            } else {
              console.error('data属性不是数组')
              _agents = []
            }
          } else {
            console.error('对象没有data属性')
            _agents = []
          }
        }
        // 处理其他类型
        else {
          console.error('未知类型的文件内容:', typeof fileContent)
          _agents = []
        }

        // 确保_agents是数组
        if (!Array.isArray(_agents)) {
          console.error('_agents不是数组，重置为空数组')
          _agents = []
        }
      } catch (error) {
        console.error('读取或解析agents.json失败:', error)
        _agents = []
      }
      setAgents(_agents)
    })
  }, [resourcesPath])

  return agents
}

export function groupByCategories(data: Agent[]) {
  // 防止非数组输入
  if (!Array.isArray(data)) {
    console.error('groupByCategories函数收到非数组输入:', data)
    return {}
  }

  const groupedMap = new Map<string, Agent[]>()

  // 遍历数组中的每个项
  data.forEach((item) => {
    // 确保item是对象且有group属性
    if (item && typeof item === 'object' && item.group) {
      // 确保group是数组
      const groups = Array.isArray(item.group) ? item.group : [item.group]

      groups.forEach((category) => {
        if (typeof category === 'string') {
          if (!groupedMap.has(category)) {
            groupedMap.set(category, [])
          }
          groupedMap.get(category)?.push(item)
        }
      })
    }
  })

  const result: Record<string, Agent[]> = {}
  Array.from(groupedMap.entries()).forEach(([category, items]) => {
    result[category] = items
  })

  return result
}
