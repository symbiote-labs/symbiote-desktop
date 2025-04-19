import store from '@renderer/store'
import { Model, Provider } from '@renderer/types'

import AnthropicProvider from './AnthropicProvider'
import BaseProvider from './BaseProvider'
import DeepClaudeProvider from './DeepClaudeProvider'
import GeminiProvider from './GeminiProvider'
import OpenAIProvider from './OpenAIProvider'

// 模型组合接口
interface ModelCombination {
  id: string
  name: string
  reasonerModel: Model
  targetModel: Model
  isActive: boolean
}

export default class ProviderFactory {
  static create(provider: Provider): BaseProvider {
    // 检查是否是模型组合
    if (provider.type === 'deepclaude') {
      // 从localStorage获取模型组合配置
      const savedCombinations = localStorage.getItem('modelCombinations')
      if (savedCombinations) {
        try {
          const combinations = JSON.parse(savedCombinations) as ModelCombination[]
          // 查找与当前选择的模型ID匹配的组合
          // 注意：在新的实现中，所有模型组合共享同一个provider，但每个模型有自己的ID
          // 我们需要找到当前选择的模型对应的组合
          const selectedModelId = provider.models.length > 0 ? provider.models[0].id : null

          // 如果没有选择模型，使用第一个激活的组合
          let combination: ModelCombination | undefined = undefined
          if (selectedModelId) {
            // 在provider的models中查找匹配的模型
            const selectedModel = provider.models.find((m) => m.id === selectedModelId)
            if (selectedModel) {
              // 直接使用模型ID查找对应的组合
              // 在DeepClaude中，模型ID就是组合ID
              combination = combinations.find((c) => c.id === selectedModelId && c.isActive)
            }
          }

          // 如果没有找到匹配的组合，使用第一个激活的组合
          if (!combination) {
            combination = combinations.find((c) => c.isActive) || undefined
          }

          if (combination) {
            console.log(
              '[ProviderFactory] 创建DeepClaudeProvider，使用模型组合:',
              combination.name,
              '推理模型:',
              combination.reasonerModel?.name,
              '目标模型:',
              combination.targetModel?.name
            )

            // 确保reasonerModel和targetModel是完整的模型对象
            const allProviders = store.getState().llm.providers

            // 查找完整的推理模型
            const reasonerModel = combination.reasonerModel
            const reasonerProvider = allProviders.find((p: Provider) =>
              p.models.some((m: Model) => m.id === reasonerModel.id)
            )
            if (!reasonerProvider) {
              console.error('[ProviderFactory] 无法找到推理模型的提供商:', reasonerModel.id)
              return new OpenAIProvider(provider)
            }
            const fullReasonerModel = reasonerProvider.models.find((m: Model) => m.id === reasonerModel.id)
            if (!fullReasonerModel) {
              console.error('[ProviderFactory] 无法找到推理模型:', reasonerModel.id)
              return new OpenAIProvider(provider)
            }

            // 查找完整的目标模型
            const targetModel = combination.targetModel
            const targetProvider = allProviders.find((p: Provider) =>
              p.models.some((m: Model) => m.id === targetModel.id)
            )
            if (!targetProvider) {
              console.error('[ProviderFactory] 无法找到目标模型的提供商:', targetModel.id)
              return new OpenAIProvider(provider)
            }
            const fullTargetModel = targetProvider.models.find((m: Model) => m.id === targetModel.id)
            if (!fullTargetModel) {
              console.error('[ProviderFactory] 无法找到目标模型:', targetModel.id)
              return new OpenAIProvider(provider)
            }

            // 创建完整的模型组合
            const fullCombination: ModelCombination = {
              id: combination.id,
              name: combination.name,
              isActive: combination.isActive,
              reasonerModel: fullReasonerModel,
              targetModel: fullTargetModel
            }

            console.log(
              '[ProviderFactory] 创建完整的模型组合:',
              fullCombination.id,
              fullCombination.name,
              '推理模型:',
              fullCombination.reasonerModel.id,
              fullCombination.reasonerModel.name,
              '目标模型:',
              fullCombination.targetModel.id,
              fullCombination.targetModel.name
            )

            return new DeepClaudeProvider(provider, fullCombination)
          }
        } catch (e) {
          console.error('[ProviderFactory] Failed to parse model combinations:', e)
        }
      }
      // 如果找不到匹配的组合，使用默认的OpenAI提供商
      console.error('[ProviderFactory] 无法找到匹配的模型组合，使用默认的OpenAI提供商')
      return new OpenAIProvider(provider)
    }

    // 处理常规提供商
    switch (provider.type) {
      case 'anthropic':
        return new AnthropicProvider(provider)
      case 'gemini':
        return new GeminiProvider(provider)
      default:
        return new OpenAIProvider(provider)
    }
  }
}

export function isOpenAIProvider(provider: Provider) {
  return !['anthropic', 'gemini'].includes(provider.type)
}
