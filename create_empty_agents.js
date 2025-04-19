const fs = require('fs')
const path = require('path')

// 创建一个空的agents.json文件
const emptyAgents = []
const filePath = path.join('resources', 'data', 'agents.json')

// 备份原始文件
fs.copyFileSync(filePath, filePath + '.bak')
console.log('已备份原始文件到 ' + filePath + '.bak')

// 写入新文件
fs.writeFileSync(filePath, JSON.stringify(emptyAgents, null, 2), 'utf8')
console.log('已创建新的agents.json文件，内容为空数组')
