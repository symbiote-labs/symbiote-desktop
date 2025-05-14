// convert_agents.js
// 将 agents.json 转换为 list_assistant.json
// 一次性的(如何后面不扩展agents.json), 则不需要再运行这个脚本
const fs = require('fs')
const path = require('path')

// --- 配置路径 ---
const agentsJsonPath = path.resolve(__dirname, '../data/agents.json')
const outputDir = path.resolve(__dirname, '../data')
const outputJsonPath = path.resolve(outputDir, 'store_list_assistant.json')

// --- 映射和默认值配置 ---
const CATEGORY_ID_ASSISTANT = 'assistant'

// 映射 agents.json 的 group 名称 到 store_categories.json 中 "助手" 分类的二级分类 ID
// Key: agent.group 中的项 (请确保大小写和字符与 agents.json 中的 group 值一致)
// Value: 二级分类 ID (subcategoryId)
const groupToSubcategoryMap = {
  职业: 'assistant-job',
  商业: 'assistant-business',
  工具: 'assistant-tools',
  语言: 'assistant-language',
  办公: 'assistant-office',
  通用: 'assistant-general',
  写作: 'assistant-writing',
  编程: 'assistant-coding',
  情感: 'assistant-emotion',
  教育: 'assistant-education',
  创意: 'assistant-creative',
  学术: 'assistant-academic',
  设计: 'assistant-design',
  艺术: 'assistant-art',
  娱乐: 'assistant-entertainment',
  精选: 'assistant-featured',
  生活: 'assistant-life',
  医疗: 'assistant-medical',
  文案: 'assistant-copywriting',
  健康: 'assistant-health',
  点评: 'assistant-review',
  百科: 'assistant-encyclopedia',
  旅游: 'assistant-travel',
  翻译: 'assistant-translation',
  游戏: 'assistant-game',
  音乐: 'assistant-music',
  营销: 'assistant-marketing',
  科学: 'assistant-science',
  分析: 'assistant-analysis',
  法律: 'assistant-law',
  咨询: 'assistant-consulting',
  金融: 'assistant-finance',
  管理: 'assistant-management'
}

// 从 agent.group 数组中获取 subcategoryId
// 策略：取第一个在 groupToSubcategoryMap 中能找到匹配的 group 名称
function getSubcategoryIdFromGroup(groupArray = []) {
  if (!Array.isArray(groupArray)) return 'assistant-general'

  for (const groupName of groupArray) {
    const key = String(groupName)
    if (groupToSubcategoryMap[key]) {
      return groupToSubcategoryMap[key]
    }
  }
  // 如果 group 中没有一项能精确映射，打印警告并返回通用默认值
  // (避免为仅包含 "精选" 且 "精选" 本身无特定映射的情况重复打印警告, featured 字段会处理它)
  if (!groupArray.includes('精选') || groupArray.length > 1 || !groupToSubcategoryMap['精选']) {
    console.warn(
      `No specific subcategory mapping found for group: ${JSON.stringify(groupArray)} (excluding '精选' if it has no specific map other than setting featured flag). Defaulting to 'assistant-general'.`
    )
  }
  return 'assistant-general'
}

// --- 主转换逻辑 ---
try {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
    console.log(`Created output directory: ${outputDir}`)
  }

  const agentsDataRaw = fs.readFileSync(agentsJsonPath, 'utf-8')
  const agents = JSON.parse(agentsDataRaw)

  // 假设 agents.json 的根是一个直接的数组
  if (!Array.isArray(agents)) {
    throw new Error(
      `agents.json (path: ${agentsJsonPath}) is not an array. Please ensure it is a JSON array of agent objects.`
    )
  }
  console.log(`Read ${agents.length} raw agent objects from ${agentsJsonPath}`)

  const storeAssistants = agents
    .map((agent) => {
      if (!agent || typeof agent.id === 'undefined' || !agent.name) {
        console.warn(
          'Skipping invalid agent object (missing id or name):',
          agent && agent.id ? `ID: ${agent.id}` : agent
        )
        return null
      }

      // 从 agent.group 获取 subcategoryId，同时将 agent.group 用作 StoreItem.tags
      const agentGroups = Array.isArray(agent.group) ? agent.group : []
      const subcategoryId = getSubcategoryIdFromGroup(agentGroups)

      // 检查 group 是否包含 "精选" 来设置 featured 标志
      const isFeaturedByGroup = agentGroups.includes('精选')

      return {
        id: String(agent.id), // 使用 agent.id (顶层)
        title: agent.name, // 使用 agent.name (顶层)
        description: agent.description || 'No description available.', // 使用 agent.description (顶层)
        type: 'Assistant', // 固定类型
        categoryId: CATEGORY_ID_ASSISTANT, // 固定一级分类
        subcategoryId: subcategoryId, // 从 agent.group 动态获取
        author: 'Cherry Studio', // agent.author 可能不存在, 提供默认 'Cherry Studio'
        icon: agent.emoji || '🤖', // 使用 agent.emoji (顶层), 若无则用默认
        image: '',
        tags: agentGroups, // 使用 agent.group (顶层) 作为 StoreItem.tags
        // 如果 group 含 "精选"，则 isFeaturedByGroup 为 true。
        featured: isFeaturedByGroup,
        // assistant
        prompt: agent.prompt || ''
      }
    })
    .filter((item) => item !== null)

  fs.writeFileSync(outputJsonPath, JSON.stringify(storeAssistants, null, 2), 'utf-8')
  console.log(`Successfully converted ${storeAssistants.length} agents to ${outputJsonPath}`)
} catch (error) {
  console.error('Error during conversion:', error)
  process.exit(1)
}
