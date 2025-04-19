// 检查重复消息的脚本
const { app } = require('electron')
const path = require('path')
const fs = require('fs')

// 获取数据库文件路径
const userDataPath = app.getPath('userData')
const dbFilePath = path.join(userDataPath, 'CherryStudio.db')

console.log('数据库文件路径:', dbFilePath)

// 检查文件是否存在
if (fs.existsSync(dbFilePath)) {
  console.log('数据库文件存在')

  // 读取数据库内容
  const dbContent = fs.readFileSync(dbFilePath, 'utf8')

  // 解析数据库内容
  try {
    const data = JSON.parse(dbContent)

    // 检查topics表中的消息
    if (data.topics) {
      console.log('找到topics表，共有', data.topics.length, '个主题')

      // 遍历每个主题
      data.topics.forEach((topic) => {
        console.log(`检查主题: ${topic.id}`)

        if (topic.messages && Array.isArray(topic.messages)) {
          console.log(`  主题消息数量: ${topic.messages.length}`)

          // 检查重复消息
          const messageIds = new Set()
          const duplicates = []

          topic.messages.forEach((message) => {
            if (messageIds.has(message.id)) {
              duplicates.push(message.id)
            } else {
              messageIds.add(message.id)
            }
          })

          if (duplicates.length > 0) {
            console.log(`  发现${duplicates.length}条重复消息ID:`, duplicates)
          } else {
            console.log('  未发现重复消息ID')
          }

          // 检查重复的askId (对于助手消息)
          const askIds = {}
          topic.messages.forEach((message) => {
            if (message.role === 'assistant' && message.askId) {
              if (!askIds[message.askId]) {
                askIds[message.askId] = []
              }
              askIds[message.askId].push(message.id)
            }
          })

          // 输出每个askId对应的助手消息数量
          Object.entries(askIds).forEach(([askId, messageIds]) => {
            if (messageIds.length > 1) {
              console.log(`  askId ${askId} 有 ${messageIds.length} 条助手消息`)
            }
          })
        }
      })
    }
  } catch (error) {
    console.error('解析数据库内容失败:', error)
  }
} else {
  console.log('数据库文件不存在')
}
