const fs = require('fs')
const path = require('path')

// 读取agents.json文件
const filePath = path.join('resources', 'data', 'agents.json')
fs.readFile(filePath, (err, data) => {
  if (err) {
    console.error('读取文件失败:', err)
    return
  }

  // 输出文件的前20个字节的十六进制表示
  console.log('文件前20个字节:')
  for (let i = 0; i < Math.min(20, data.length); i++) {
    console.log(`字节 ${i}: 0x${data[i].toString(16)} (${String.fromCharCode(data[i])})`)
  }

  // 尝试不同的方式解析JSON
  console.log('\n尝试不同的方式解析JSON:')

  // 1. 直接解析
  try {
    JSON.parse(data)
    console.log('方法1成功: 直接解析')
  } catch (e) {
    console.error('方法1失败:', e.message)
  }

  // 2. 转换为字符串后解析
  try {
    JSON.parse(data.toString())
    console.log('方法2成功: 转换为字符串后解析')
  } catch (e) {
    console.error('方法2失败:', e.message)
  }

  // 3. 移除BOM后解析
  try {
    const str = data.toString()
    const noBomStr = str.charCodeAt(0) === 0xfeff ? str.slice(1) : str
    JSON.parse(noBomStr)
    console.log('方法3成功: 移除BOM后解析')
  } catch (e) {
    console.error('方法3失败:', e.message)
  }

  // 4. 移除前3个字符后解析
  try {
    const str = data.toString().slice(3)
    JSON.parse(str)
    console.log('方法4成功: 移除前3个字符后解析')
  } catch (e) {
    console.error('方法4失败:', e.message)
  }

  // 5. 移除所有非ASCII字符后解析
  try {
    const str = data.toString().replace(/[^\x20-\x7E]/g, '')
    JSON.parse(str)
    console.log('方法5成功: 移除所有非ASCII字符后解析')
  } catch (e) {
    console.error('方法5失败:', e.message)
  }
})
