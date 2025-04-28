import store from '@renderer/store'
import { Assistant, Message, Model, Provider, Suggestion } from '@renderer/types'
import { addAbortController, removeAbortController } from '@renderer/utils/abortController'
import { buildSystemPrompt } from '@renderer/utils/prompt'
import { getThinkingLibraryById } from '@renderer/utils/thinkingLibrary'
import { isEmpty, takeRight } from 'lodash'

import { CompletionsParams } from '.'
import BaseProvider from './BaseProvider'
import ProviderFactory from './ProviderFactory'

interface ModelCombination {
  id: string
  name: string
  reasonerModel: Model
  targetModel: Model
  isActive: boolean
  thinkingLibraryId?: string
}

export default class DeepClaudeProvider extends BaseProvider {
  private reasonerProvider: BaseProvider
  private targetProvider: BaseProvider
  private modelCombination: ModelCombination

  constructor(provider: Provider, modelCombination: ModelCombination) {
    super(provider)

    console.log(
      '[DeepClaudeProvider] 构造函数被调用，接收到的模型组合:',
      modelCombination.id,
      modelCombination.name,
      '推理模型:',
      modelCombination.reasonerModel?.id,
      modelCombination.reasonerModel?.name,
      '目标模型:',
      modelCombination.targetModel?.id,
      modelCombination.targetModel?.name
    )

    // 查找推理模型和目标模型的提供商
    const providers = store.getState().llm.providers
    console.log('[DeepClaudeProvider] 当前提供商数量:', providers.length)

    const reasonerModelProvider = providers.find((p: Provider) =>
      p.models.some((m: Model) => m.id === modelCombination.reasonerModel.id)
    )
    console.log('[DeepClaudeProvider] 推理模型提供商:', reasonerModelProvider?.id, reasonerModelProvider?.name)

    const targetModelProvider = providers.find((p: Provider) =>
      p.models.some((m: Model) => m.id === modelCombination.targetModel.id)
    )
    console.log('[DeepClaudeProvider] 目标模型提供商:', targetModelProvider?.id, targetModelProvider?.name)

    if (!reasonerModelProvider || !targetModelProvider) {
      console.error('[DeepClaudeProvider] 无法找到模型对应的提供商')
      throw new Error('无法找到模型对应的提供商')
    }

    // 创建推理模型和目标模型的Provider实例
    console.log('[DeepClaudeProvider] 开始创建推理模型提供商实例')
    this.reasonerProvider = ProviderFactory.create(reasonerModelProvider)
    console.log('[DeepClaudeProvider] 开始创建目标模型提供商实例')
    this.targetProvider = ProviderFactory.create(targetModelProvider)
    console.log('[DeepClaudeProvider] 提供商实例创建完成')
    this.modelCombination = modelCombination

    console.log(
      '[DeepClaudeProvider] 初始化完成，推理模型:',
      this.modelCombination.reasonerModel.name,
      '推理模型提供商:',
      reasonerModelProvider.name,
      '目标模型:',
      this.modelCombination.targetModel.name,
      '目标模型提供商:',
      targetModelProvider.name
    )
  }

  /**
   * 生成完成
   */
  public async completions({
    messages,
    assistant,
    mcpTools,
    onChunk,
    onFilterMessages
  }: CompletionsParams): Promise<void> {
    // 获取设置
    const contextCount = assistant.settings?.contextCount || 10

    // 过滤消息
    const filteredMessages = takeRight(
      messages.filter((m) => !isEmpty(m.content)),
      contextCount + 2
    )

    if (onFilterMessages) {
      onFilterMessages(filteredMessages)
    }

    // 如果没有消息，直接返回
    if (isEmpty(filteredMessages)) {
      return
    }

    // 获取最后一条用户消息
    const lastUserMessage = filteredMessages[filteredMessages.length - 1]

    // 创建中止控制器
    const abortController = new AbortController()
    const requestId = Date.now().toString()
    const abortFn = () => abortController.abort()
    addAbortController(requestId, abortFn)

    try {
      // 创建状态对象来跟踪推理过程
      const state = {
        isReasoningStarted: false, // 是否已经开始显示思考过程
        isReasoningFinished: false, // 推理模型是否已完成
        isTargetStarted: false, // 目标模型是否已开始
        accumulatedThinking: '', // 累积的思考过程
        extractedThinking: '', // 提取的思考过程
        isFirstTargetChunk: true // 是否是目标模型的第一个chunk
      }

      // 同时启动两个模型的调用
      await Promise.all([
        // 推理模型任务
        (async () => {
          try {
            console.log(
              '[DeepClaudeProvider] 启动推理模型任务，使用模型:',
              this.modelCombination.reasonerModel.name,
              '模型ID:',
              this.modelCombination.reasonerModel.id,
              '提供商:',
              this.modelCombination.reasonerModel.provider
            )

            // 检查推理模型是否是专门的推理模型
            const isSpecialReasonerModel =
              this.modelCombination.reasonerModel.group === 'DeepSeek' ||
              this.modelCombination.reasonerModel.name.toLowerCase().includes('reason')

            // 根据模型类型和思考库选择不同的提示词
            let reasoningPrompt = ''
            if (isSpecialReasonerModel) {
              // 专门的推理模型使用简单提示词
              reasoningPrompt = `你是一个思考助手。请对以下问题进行深入思考，分析问题的各个方面，并提供详细的推理过程。
请以<thinking>开始，以</thinking>结束你的思考过程。
不要在思考过程中包含“思考过程”或类似的标题，直接开始思考即可。

问题: ${lastUserMessage.content}`
            } else {
              // 普通模型使用思考库提示词或默认提示词
              const thinkingLibrary = getThinkingLibraryById(this.modelCombination.thinkingLibraryId)

              if (thinkingLibrary) {
                // 使用选定的思考库提示词
                console.log('[DeepClaudeProvider] 使用思考库:', thinkingLibrary.name)
                reasoningPrompt = thinkingLibrary.prompt.replace('{question}', lastUserMessage.content)
              } else {
                // 使用默认提示词
                console.log('[DeepClaudeProvider] 使用默认思考提示词')
                reasoningPrompt = `你是一个思考助手。请对以下问题进行深入思考，分析问题的各个方面，并提供详细的推理过程。
请非常详细地思考这个问题的各个方面，考虑不同的角度和可能性。
你的回答将作为另一个AI助手的思考基础，所以请尽可能详细和全面。
请以<think>开始，以</think>结束你的思考过程。
不要在思考过程中包含“思考过程”或类似的标题，直接开始思考即可。

问题: ${lastUserMessage.content}`
              }
            }

            // 创建推理模型的消息列表
            // 保留历史消息，但修改最后一条用户消息
            console.log('[DeepClaudeProvider] 推理模型使用原始对话历史消息数量:', filteredMessages.length)

            // 复制历史消息，但修改最后一条用户消息
            const reasoningMessages = filteredMessages.map((msg, index) => {
              // 只修改最后一条用户消息
              if (index === filteredMessages.length - 1 && msg.role === 'user') {
                return {
                  ...msg,
                  content: reasoningPrompt
                }
              }
              return msg
            })

            // 使用completions方法调用推理模型
            await this.reasonerProvider.completions({
              messages: reasoningMessages,
              assistant: {
                ...assistant,
                model: this.modelCombination.reasonerModel,
                prompt: '' // 不使用assistant的prompt，而是使用我们自定义的reasoningPrompt
              },
              mcpTools: [], // 不使用工具，避免干扰推理过程
              onChunk: (chunk) => {
                // 累积推理过程
                if (chunk.text) {
                  state.accumulatedThinking += chunk.text

                  // 实时将思考过程传递给前端
                  if (!state.isTargetStarted) {
                    // 只有在目标模型尚未开始时才发送思考过程
                    if (!state.isReasoningStarted) {
                      state.isReasoningStarted = true
                      // 第一次发送思考过程，使用reasoning_content字段
                      onChunk({
                        reasoning_content: chunk.text,
                        text: '' // 不显示文本，只显示思考过程
                      })
                    } else {
                      // 后续发送思考过程，继续使用reasoning_content字段
                      onChunk({
                        reasoning_content: chunk.text,
                        text: '' // 不显示文本，只显示思考过程
                      })
                    }
                  }

                  // 输出日志，让用户看到推理过程
                  console.log('[DeepClaudeProvider] 推理模型输出:', chunk.text.length, '字符')
                }
              },
              onFilterMessages: () => {}
            })

            // 如果不是专门的推理模型，将其输出包装在<think></think>标签中
            if (
              !isSpecialReasonerModel &&
              !state.accumulatedThinking.includes('<think>') &&
              !state.accumulatedThinking.includes('<thinking>')
            ) {
              state.accumulatedThinking = `<think>${state.accumulatedThinking}</think>`
            }

            // 提取思考过程
            let extractedThinking = ''

            // 检查是否是Gemini模型的JSON格式输出
            if (
              state.accumulatedThinking.includes('data: {"candidates"') ||
              state.accumulatedThinking.includes('data: {"candidates"')
            ) {
              console.log('[DeepClaudeProvider] 检测到Gemini模型的JSON格式输出')

              try {
                // 尝试提取JSON中的文本内容
                const lines = state.accumulatedThinking.split('\n')
                let combinedText = ''

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const jsonStr = line.substring(6)
                      const jsonData = JSON.parse(jsonStr)

                      if (
                        jsonData.candidates &&
                        jsonData.candidates[0] &&
                        jsonData.candidates[0].content &&
                        jsonData.candidates[0].content.parts &&
                        jsonData.candidates[0].content.parts[0] &&
                        jsonData.candidates[0].content.parts[0].text
                      ) {
                        combinedText += jsonData.candidates[0].content.parts[0].text
                      }
                    } catch (e) {
                      // 忽略JSON解析错误
                    }
                  }
                }

                if (combinedText) {
                  // 尝试从组合的文本中提取<think>标签
                  const thinkRegex = new RegExp('<think>([\\s\\S]*?)</think>')
                  const thinkMatch = combinedText.match(thinkRegex)

                  if (thinkMatch && thinkMatch[1]) {
                    extractedThinking = thinkMatch[1].trim()
                    console.log('[DeepClaudeProvider] 成功从 Gemini JSON 输出中提取<think>标签的思考过程')
                  } else {
                    // 如果没有标签，使用整个文本作为思考过程
                    extractedThinking = combinedText.trim()
                    console.log('[DeepClaudeProvider] 从 Gemini JSON 输出中提取了思考过程，但没有<think>标签')
                  }
                }
              } catch (error) {
                console.error('[DeepClaudeProvider] 解析 Gemini JSON 输出时出错:', error)
                extractedThinking = state.accumulatedThinking
              }
            } else {
              // 常规模型输出处理
              // 先尝试匹配<think>标签
              const thinkRegex = new RegExp('<think>([\\s\\S]*?)</think>')
              const thinkMatch = state.accumulatedThinking.match(thinkRegex)

              // 如果没有匹配到<think>标签，尝试匹配<thinking>标签
              if (thinkMatch && thinkMatch[1]) {
                extractedThinking = thinkMatch[1].trim()
                console.log('[DeepClaudeProvider] 成功提取<think>标签中的思考过程')
              } else {
                const thinkingRegex = new RegExp('<thinking>([\\s\\S]*?)</thinking>')
                const thinkingMatch = state.accumulatedThinking.match(thinkingRegex)

                if (thinkingMatch && thinkingMatch[1]) {
                  extractedThinking = thinkingMatch[1].trim()
                  console.log('[DeepClaudeProvider] 成功提取<thinking>标签中的思考过程')
                } else {
                  extractedThinking = state.accumulatedThinking
                  console.log('[DeepClaudeProvider] 未能提取思考过程，使用原始输出')
                }
              }
            }

            // 更新思考过程
            state.extractedThinking = extractedThinking

            console.log('[DeepClaudeProvider] 推理模型完成，思考过程长度:', state.extractedThinking.length)
            console.log('[DeepClaudeProvider] 推理模型输出示例:', state.extractedThinking.substring(0, 100) + '...')
            console.log(
              '[DeepClaudeProvider] 推理模型信息:',
              this.modelCombination.reasonerModel.name,
              this.modelCombination.reasonerModel.id
            )

            // 标记推理模型已完成
            state.isReasoningFinished = true
          } catch (error) {
            console.error('[DeepClaudeProvider] 推理模型错误:', error)
            // 即使出错，也要标记推理模型已完成，以便目标模型可以继续
            state.isReasoningFinished = true
            state.extractedThinking = '推理模型出错，无法获取思考过程。'
          }
        })(),

        // 目标模型任务
        (async () => {
          try {
            console.log('[DeepClaudeProvider] 等待推理模型开始生成思考过程...')

            // 等待推理模型开始生成思考过程
            while (!state.isReasoningStarted && !state.isReasoningFinished) {
              await new Promise((resolve) => setTimeout(resolve, 100))
            }

            // 等待推理模型完成
            while (!state.isReasoningFinished) {
              await new Promise((resolve) => setTimeout(resolve, 100))
            }

            console.log('[DeepClaudeProvider] 推理模型已完成，立即启动目标模型任务')

            // 标记目标模型已开始
            state.isTargetStarted = true

            console.log('[DeepClaudeProvider] 启动目标模型任务')
            console.log(
              '[DeepClaudeProvider] 目标模型信息:',
              this.modelCombination.targetModel.name,
              this.modelCombination.targetModel.id
            )

            // 构建目标模型的提示词
            const targetPrompt = `以下是对这个问题的思考过程，请基于这个思考过程回答我的问题，但不要重复思考过程，不要在回答中包含“思考过程”或类似的标题，直接给出清晰、准确的回答：

${state.extractedThinking}`

            // 构建系统提示词
            const systemPrompt = await buildSystemPrompt(assistant.prompt || '', mcpTools || [], [])

            // 保留原始对话历史，但修改最后一条用户消息
            // 将思考过程添加到最后一条用户消息中
            console.log('[DeepClaudeProvider] 原始对话历史消息数量:', filteredMessages.length)

            // 创建最终的消息列表，保留所有历史消息
            const finalMessages = filteredMessages.map((msg, index) => {
              // 只修改最后一条用户消息
              if (index === filteredMessages.length - 1 && msg.role === 'user') {
                return {
                  ...msg,
                  content: `${msg.content}\n\n${targetPrompt}`
                }
              }
              return msg
            })

            console.log('[DeepClaudeProvider] 最终消息列表数量:', finalMessages.length)

            // 使用目标模型生成最终回答
            await this.targetProvider.completions({
              messages: finalMessages,
              assistant: {
                ...assistant,
                model: this.modelCombination.targetModel,
                prompt: systemPrompt
              },
              mcpTools,
              onChunk: (chunk) => {
                // 直接传递chunk，不再添加思考过程
                // 因为思考过程已经在推理模型的onChunk回调中实时传递给前端了
                onChunk(chunk)
              },
              onFilterMessages
            })
          } catch (error) {
            console.error('[DeepClaudeProvider] 目标模型错误:', error)
            throw error
          }
        })()
      ])
    } catch (error) {
      console.error('DeepClaudeProvider completions error:', error)
      throw error
    } finally {
      removeAbortController(requestId, abortFn)
    }
  }

  /**
   * 翻译消息
   */
  public async translate(message: Message, assistant: Assistant, onResponse?: (text: string) => void): Promise<string> {
    // 使用目标模型进行翻译
    return this.targetProvider.translate(
      message,
      {
        ...assistant,
        model: this.modelCombination.targetModel
      },
      onResponse
    )
  }

  /**
   * 生成摘要
   */
  public async summaries(messages: Message[], assistant: Assistant): Promise<string> {
    // 使用目标模型生成摘要
    return this.targetProvider.summaries(messages, {
      ...assistant,
      model: this.modelCombination.targetModel
    })
  }

  /**
   * 为搜索生成摘要
   */
  public async summaryForSearch(messages: Message[], assistant: Assistant): Promise<string | null> {
    // 使用目标模型为搜索生成摘要
    return this.targetProvider.summaryForSearch(messages, {
      ...assistant,
      model: this.modelCombination.targetModel
    })
  }

  /**
   * 生成建议
   */
  public async suggestions(messages: Message[], assistant: Assistant): Promise<Suggestion[]> {
    // 使用目标模型生成建议
    return this.targetProvider.suggestions(messages, {
      ...assistant,
      model: this.modelCombination.targetModel
    })
  }

  /**
   * 生成文本
   */
  public async generateText({
    prompt,
    content,
    modelId
  }: {
    prompt: string
    content: string
    modelId?: string
  }): Promise<string> {
    // 如果指定了模型ID，则使用指定的模型
    if (modelId) {
      const providers = store.getState().llm.providers
      const modelProvider = providers.find((p: Provider) => p.models.some((m: Model) => m.id === modelId))

      if (modelProvider) {
        const provider = ProviderFactory.create(modelProvider)
        return provider.generateText({ prompt, content, modelId })
      }
    }

    // 默认使用目标模型生成文本
    return this.targetProvider.generateText({
      prompt,
      content,
      modelId: this.modelCombination.targetModel.id
    })
  }

  /**
   * 检查模型
   */
  public async check(): Promise<{ valid: boolean; error: Error | null }> {
    // 检查推理模型和目标模型
    const reasonerCheck = await this.reasonerProvider.check(this.modelCombination.reasonerModel)
    if (!reasonerCheck.valid) {
      return reasonerCheck
    }

    return this.targetProvider.check(this.modelCombination.targetModel)
  }

  /**
   * 获取模型列表
   */
  public async models(): Promise<any> {
    // 返回目标提供商的模型列表
    return this.targetProvider.models()
  }

  /**
   * 生成图像
   */
  public async generateImage(params: any): Promise<string[]> {
    // 使用目标模型生成图像
    return this.targetProvider.generateImage(params)
  }

  /**
   * 通过聊天生成图像
   */
  public async generateImageByChat(params: CompletionsParams): Promise<void> {
    // 使用目标模型通过聊天生成图像
    return this.targetProvider.generateImageByChat(params)
  }

  /**
   * 获取嵌入维度
   */
  public async getEmbeddingDimensions(model: Model): Promise<number> {
    // 使用目标模型获取嵌入维度
    return this.targetProvider.getEmbeddingDimensions(model)
  }
}
