import { Model, Provider } from '@renderer/types'

export interface ThinkingLibrary {
  id: string
  name: string
  description: string
  prompt: string
  category: string
}

interface ModelCombination {
  id: string
  name: string
  reasonerModel: any
  targetModel: any
  isActive: boolean
  thinkingLibraryId?: string
}

// 检查localStorage中的模型组合数据
export function checkModelCombinationsInLocalStorage() {
  try {
    const savedCombinations = localStorage.getItem('modelCombinations')
    if (!savedCombinations) {
      console.log('[checkModelCombinationsInLocalStorage] localStorage中没有模型组合数据')
      return
    }

    const combinations = JSON.parse(savedCombinations)
    console.log(
      '[checkModelCombinationsInLocalStorage] localStorage中的模型组合数据:',
      JSON.stringify(combinations, null, 2)
    )
  } catch (e) {
    console.error('[checkModelCombinationsInLocalStorage] 解析localStorage中的模型组合数据失败:', e)
  }
}

/**
 * 创建DeepClaude提供商
 * @param combination 模型组合
 * @returns DeepClaude提供商
 */
// 创建模型对象，用于添加到DeepClaude提供商中
export function createDeepClaudeModel(combination: ModelCombination): Model {
  console.log(
    '[createDeepClaudeModel] 创建DeepClaude模型，组合ID:',
    combination.id,
    '组合名称:',
    combination.name,
    '推理模型:',
    combination.reasonerModel?.id,
    combination.reasonerModel?.name,
    '目标模型:',
    combination.targetModel?.id,
    combination.targetModel?.name
  )

  // 使用组合ID作为模型ID
  console.log('[createDeepClaudeModel] 使用组合ID作为模型ID:', combination.id)

  // 创建符合Model类型的对象
  const model: Model = {
    id: combination.id, // 使用组合ID作为模型ID，而不是生成新的UUID
    provider: 'deepclaude',
    name: combination.name,
    group: 'DeepClaude',
    type: ['text'], // 指定为文本模型，而非嵌入模型
    description: `${combination.reasonerModel?.name} + ${combination.targetModel?.name}`
  }

  return model
}

// 创建DeepClaude提供商
export function createDeepClaudeProvider(combinations: ModelCombination[]): Provider {
  console.log('[createDeepClaudeProvider] 创建DeepClaude提供商，组合数量:', combinations.length)

  // 为每个组合创建一个模型
  const models = combinations.map(createDeepClaudeModel)

  const provider: Provider = {
    id: 'deepclaude',
    name: 'DeepClaude',
    type: 'deepclaude',
    apiKey: '', // 不需要API密钥，使用组合模型的API密钥
    apiHost: '', // 不需要API地址，使用组合模型的API地址
    models: models,
    enabled: true,
    isSystem: false
  }

  console.log('[createDeepClaudeProvider] 创建的提供商详情:', {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    models: provider.models.map((m) => ({ id: m.id, name: m.name, provider: m.provider }))
  })

  return provider
}

/**
 * 从localStorage获取所有激活的模型组合
 * @returns 激活的模型组合列表
 */
export function getActiveModelCombinations(): ModelCombination[] {
  try {
    const savedCombinations = localStorage.getItem('modelCombinations')
    if (!savedCombinations) {
      console.log('[getActiveModelCombinations] 未找到模型组合配置')
      return []
    }

    const combinations = JSON.parse(savedCombinations) as ModelCombination[]
    const activeCombinations = combinations.filter((c) => c.isActive)
    console.log('[getActiveModelCombinations] 找到激活的模型组合数量:', activeCombinations.length)
    console.log(
      '[getActiveModelCombinations] 激活的模型组合详情:',
      activeCombinations.map((c) => ({
        id: c.id,
        name: c.name,
        reasonerModel: {
          id: c.reasonerModel?.id,
          name: c.reasonerModel?.name,
          provider: c.reasonerModel?.provider
        },
        targetModel: {
          id: c.targetModel?.id,
          name: c.targetModel?.name,
          provider: c.targetModel?.provider
        }
      }))
    )
    return activeCombinations
  } catch (e) {
    console.error('[getActiveModelCombinations] Failed to parse model combinations:', e)
    return []
  }
}

/**
 * 创建所有DeepClaude提供商
 * @returns DeepClaude提供商列表
 */
export function createAllDeepClaudeProviders(): Provider[] {
  const activeCombinations = getActiveModelCombinations()
  console.log('[createAllDeepClaudeProviders] 创建所有DeepClaude提供商，激活的模型组合数量:', activeCombinations.length)

  if (activeCombinations.length === 0) {
    return []
  }

  // 创建一个单一的DeepClaude提供商
  const provider = createDeepClaudeProvider(activeCombinations)
  console.log(
    '[createAllDeepClaudeProviders] 创建的DeepClaude提供商:',
    provider.id,
    provider.name,
    provider.models.length
  )
  return [provider]
}
