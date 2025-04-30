import {
  getOpenAIWebSearchParams,
  isHunyuanSearchModel,
  isOpenAIWebSearch,
  isZhipuModel
} from '@renderer/config/models'
import { SEARCH_SUMMARY_PROMPT } from '@renderer/config/prompts'
import i18n from '@renderer/i18n'
import agentService from '@renderer/services/AgentService'
import store from '@renderer/store'
import { setGenerating } from '@renderer/store/runtime'
import { Assistant, MCPTool, Message, Model, Provider, Suggestion, WebSearchResponse } from '@renderer/types'
import { formatMessageError, isAbortError } from '@renderer/utils/error'
import { fetchWebContents } from '@renderer/utils/fetch'
import { withGenerateImage } from '@renderer/utils/formats'
import {
  cleanLinkCommas,
  completeLinks,
  convertLinks,
  convertLinksToHunyuan,
  convertLinksToOpenRouter,
  convertLinksToZhipu,
  extractUrlsFromMarkdown
} from '@renderer/utils/linkConverter'
import { executeToolCalls, parseToolUse } from '@renderer/utils/mcp-tools'
import { cloneDeep, findLast, isEmpty } from 'lodash'

import AiProvider from '../providers/AiProvider'
import {
  getAssistantProvider,
  getDefaultAssistant,
  getDefaultModel,
  getProviderByModel,
  getTopNamingModel,
  getTranslateModel
} from './AssistantService'
import { EVENT_NAMES, EventEmitter } from './EventService'
import { filterContextMessages, filterMessages, filterUsefulMessages } from './MessagesService'
import { estimateMessagesUsage } from './TokenService'
import WebSearchService from './WebSearchService'

export async function fetchChatCompletion({
  message,
  messages,
  assistant,
  onResponse
}: {
  message: Message
  messages: Message[]
  assistant: Assistant
  onResponse: (message: Message) => void
}) {
  const provider = getAssistantProvider(assistant)
  console.log('[fetchChatCompletion] 使用提供商:', provider.id, provider.name, provider.type)
  if (assistant.model) {
    console.log('[fetchChatCompletion] 使用模型:', assistant.model.id, assistant.model.name, assistant.model.provider)
  }
  const webSearchProvider = WebSearchService.getWebSearchProvider()
  const AI = new AiProvider(provider)

  const searchTheWeb = async () => {
    if (WebSearchService.isWebSearchEnabled() && assistant.enableWebSearch && assistant.model) {
      let query = ''
      let webSearchResponse: WebSearchResponse = {
        results: []
      }
      const webSearchParams = getOpenAIWebSearchParams(assistant, assistant.model)
      if (isEmpty(webSearchParams) && !isOpenAIWebSearch(assistant.model)) {
        const lastMessage = findLast(messages, (m) => m.role === 'user')
        const lastAnswer = findLast(messages, (m) => m.role === 'assistant')
        const hasKnowledgeBase = !isEmpty(lastMessage?.knowledgeBaseIds)

        if (lastMessage) {
          if (hasKnowledgeBase) {
            window.message.info({
              content: i18n.t('message.ignore.knowledge.base'),
              key: 'knowledge-base-no-match-info'
            })
          }

          // 更新消息状态为搜索中
          onResponse({ ...message, status: 'searching' })

          try {
            // 等待关键词生成完成
            const tools: string[] = []

            if (assistant.enableWebSearch) tools.push('websearch')
            if (hasKnowledgeBase) tools.push('knowledge')

            const searchSummaryAssistant = getDefaultAssistant()
            searchSummaryAssistant.model = assistant.model || getDefaultModel()
            searchSummaryAssistant.prompt = SEARCH_SUMMARY_PROMPT.replace('{tools}', tools.join(', '))

            // 如果启用搜索增强模式，则使用搜索增强模式
            if (WebSearchService.isEnhanceModeEnabled()) {
              const keywords = await fetchSearchSummary({
                messages: lastAnswer ? [lastAnswer, lastMessage] : [lastMessage],
                assistant: searchSummaryAssistant
              })

              try {
                const result = WebSearchService.extractInfoFromXML(keywords || '')
                if (result.question === 'not_needed') {
                  // 如果不需要搜索，则直接返回
                  console.log('No need to search')
                  return
                } else if (result.question === 'summarize' && result.links && result.links.length > 0) {
                  const contents = await fetchWebContents(result.links)
                  webSearchResponse = {
                    query: 'summaries',
                    results: contents
                  }
                } else {
                  query = result.question
                  webSearchResponse = await WebSearchService.search(webSearchProvider, query)
                }
              } catch (error) {
                console.error('Failed to extract info from XML:', error)
              }
            } else {
              query = lastMessage.content
            } // Corrected brace placement

            // 处理搜索结果
            message.metadata = {
              ...message.metadata,
              webSearch: webSearchResponse
            }

            window.keyv.set(`web-search-${lastMessage?.id}`, webSearchResponse)
          } catch (error) {
            // Restoring the catch block for the outer try
            console.error('Web search failed:', error)
          }
        } // Closes 'if (lastMessage)'
      } // Closes 'if (isEmpty(webSearchParams) ...)'
    } // Closes 'if (WebSearchService.isWebSearchEnabled() ...)'
  } // Closes searchTheWeb function

  try {
    let _messages: Message[] = []
    let isFirstChunk = true

    // chunk buffer相关变量，用于合并 chunk 减轻主线程压力。
    let _bufferedText = ''
    let _bufferTimer: NodeJS.Timeout | null = null
    const CHUNK_BUFFER_INTERVAL = 33 // 毫秒
    const CHUNK_BUFFER_SIZE = 100 // 字符数
    const CHUNK_SEMBOUNDARY_REGEX = /[.!?。！？\n]$/

    // Search web
    await searchTheWeb()

    const lastUserMessage = findLast(messages, (m) => m.role === 'user')
    // Get MCP tools
    const mcpTools: MCPTool[] = []
    const enabledMCPs = lastUserMessage?.enabledMCPs

    // Store enabledMCPs on the assistant message object so MessageTools can access it for rerun
    if (enabledMCPs && enabledMCPs.length > 0) {
      message.enabledMCPs = enabledMCPs // Add this line
    }

    if (enabledMCPs && enabledMCPs.length > 0) {
      for (const mcpServer of enabledMCPs) {
        const tools = await window.api.mcp.listTools(mcpServer)
        const availableTools = tools.filter((tool: any) => !mcpServer.disabledTools?.includes(tool.name))
        mcpTools.push(...availableTools)
      }
    }

    await AI.completions({
      messages: filterUsefulMessages(filterContextMessages(messages)),
      assistant,
      onFilterMessages: (messages) => (_messages = messages),
      onChunk: ({
        text,
        reasoning_content,
        usage,
        metrics,
        webSearch,
        search,
        annotations,
        citations,
        mcpToolResponse,
        generateImage
      }) => {
        if (assistant.model) {
          if (isOpenAIWebSearch(assistant.model)) {
            text = convertLinks(text || '', isFirstChunk)
          } else if (assistant.model.provider === 'openrouter' && assistant.enableWebSearch) {
            text = convertLinksToOpenRouter(text || '', isFirstChunk)
          } else if (assistant.enableWebSearch) {
            if (isZhipuModel(assistant.model)) {
              text = convertLinksToZhipu(text || '', isFirstChunk)
            } else if (isHunyuanSearchModel(assistant.model)) {
              text = convertLinksToHunyuan(text || '', webSearch || [], isFirstChunk)
            }
          }
        }
        if (isFirstChunk) {
          isFirstChunk = false
        }

        // 累积文本到缓冲区
        _bufferedText += text || ''
        if (reasoning_content) {
          _bufferedText += reasoning_content || ''
        }

        message.content = message.content + text || ''
        message.usage = usage
        message.metrics = metrics

        if (reasoning_content) {
          message.reasoning_content = (message.reasoning_content || '') + reasoning_content
        }

        if (mcpToolResponse) {
          message.metadata = { ...message.metadata, mcpTools: cloneDeep(mcpToolResponse) }
        }

        if (generateImage && generateImage.images.length > 0) {
          const existingImages = message.metadata?.generateImage?.images || []
          generateImage.images = [...existingImages, ...generateImage.images]
          console.log('generateImage', generateImage)
          message.metadata = {
            ...message.metadata,
            generateImage: generateImage
          }
        }

        // Handle citations from Perplexity API
        if (citations) {
          message.metadata = {
            ...message.metadata,
            citations
          }
        }

        // Handle web search from Gemini
        if (search) {
          message.metadata = { ...message.metadata, groundingMetadata: search }
        }

        // Handle annotations from OpenAI
        if (annotations) {
          message.metadata = {
            ...message.metadata,
            annotations: annotations
          }
        }

        // Handle web search from Zhipu or Hunyuan
        if (webSearch) {
          message.metadata = {
            ...message.metadata,
            webSearchInfo: webSearch
          }
        }

        // Handle citations from Openrouter
        if (assistant.model?.provider === 'openrouter' && assistant.enableWebSearch) {
          const extractedUrls = extractUrlsFromMarkdown(message.content)
          if (extractedUrls.length > 0) {
            message.metadata = {
              ...message.metadata,
              citations: extractedUrls
            }
          }
        }
        if (assistant.enableWebSearch) {
          message.content = cleanLinkCommas(message.content)
          if (webSearch && isZhipuModel(assistant.model)) {
            message.content = completeLinks(message.content, webSearch)
          }
        }

        // 设置更新条件
        const shouldUpdate =
          _bufferedText.length >= CHUNK_BUFFER_SIZE || // 大小阈值
          (text && CHUNK_SEMBOUNDARY_REGEX.test(text)) || // 正文语义边界
          (reasoning_content && CHUNK_SEMBOUNDARY_REGEX.test(reasoning_content)) || // 推理内容语义边界
          !text || // 可能是结束信号
          citations ||
          annotations || // 重要元数据
          mcpToolResponse ||
          generateImage // 工具响应或图像生成

        if (shouldUpdate) {
          if (_bufferTimer) {
            clearTimeout(_bufferTimer)
            _bufferTimer = null
          }

          onResponse({ ...message, status: 'pending' })

          _bufferedText = ''
        } else if (!_bufferTimer) {
          // 确保即使没达到条件也会更新
          _bufferTimer = setTimeout(() => {
            if (_bufferedText) {
              onResponse({ ...message, status: 'pending' })
              _bufferedText = ''
            }
            _bufferTimer = null
          }, CHUNK_BUFFER_INTERVAL)
        }
      },
      mcpTools: mcpTools
    })

    // 确保定时器被清理
    if (_bufferTimer) {
      clearTimeout(_bufferTimer)
      _bufferTimer = null

      // 如果还有未发送的缓冲文本，发送一次
      if (_bufferedText) {
        onResponse({ ...message, status: 'pending' })
      }
    }

    message.status = 'success'
    message = withGenerateImage(message)

    // 检查消息内容中是否包含工具调用
    const mcpToolResponses = message.metadata?.mcpTools || []
    const availableMcpTools = mcpToolResponses.map((tr) => tr.tool)
    const toolCalls = parseToolUse(message.content, availableMcpTools)

    // 如果有工具调用，创建新的对话响应
    if (toolCalls && toolCalls.length > 0) {
      console.log('[MCP] 检测到工具调用，将创建全新的对话响应')

      // 完成当前消息（工具调用消息）
      message.status = 'success'

      // 确保当前消息有正确的使用量统计
      if (!message.usage || !message?.usage?.completion_tokens) {
        message.usage = await estimateMessagesUsage({
          assistant,
          messages: [..._messages, message]
        })
        // 设置metrics.completion_tokens
        if (message.metrics && message?.usage?.completion_tokens) {
          message.metrics = {
            ...message.metrics,
            completion_tokens: message.usage.completion_tokens
          }
        }
      }

      // 标记为包含工具调用的消息
      // 不需要额外标记，已经有 mcpTools 字段

      // 发送第一条完整消息到UI
      EventEmitter.emit(EVENT_NAMES.RECEIVE_MESSAGE, message)
      onResponse(message)

      // 执行工具调用
      const toolResponses = []

      // 检查是否启用了Agent模式
      const isAgentMode = store.getState().settings.enableAgentMode

      if (isAgentMode && toolCalls && toolCalls.length > 0) {
        console.log('[MCP] Agent模式已启用，通过AgentService执行工具调用')

        // 在Agent模式下，为每个工具调用创建任务
        for (const toolCall of toolCalls) {
          const taskTitle = `执行工具: ${toolCall.tool.name}`

          // 检查工具参数是否存在
          const toolArgs = toolCall.tool.inputSchema || {}

          // 创建更简洁的描述，不包含完整参数（参数会单独显示）
          const taskDescription = `执行工具 ${toolCall.tool.name}`

          // 使用最后一条用户消息的ID
          const userLastMessageId = lastUserMessage?.id || ''

          // 创建任务
          const taskId = agentService.addTask(taskTitle, taskDescription, userLastMessageId)

          // 更新任务，添加工具名称和参数
          agentService.updateTask(taskId, {
            toolName: toolCall.tool.name,
            toolArgs: toolArgs
          })

          // 通过Agent服务执行工具
          try {
            await agentService.executeTask(taskId, toolCall.tool)
          } catch (error) {
            console.error('[ApiService] Agent执行工具出错:', error)
          }
        }
      } else {
        // 非Agent模式下直接执行工具调用
        await executeToolCalls(toolCalls, toolResponses, () => {}, 0)
      }

      // 工具调用已执行，不创建新的消息

      // 重置生成状态
      store.dispatch(setGenerating(false))

      // 不生成第二条消息，只执行工具调用
      console.log('[MCP] 工具调用已执行，不生成第二条消息')

      return message
    }

    // 如果没有工具调用，正常处理消息
    if (!message.usage || !message?.usage?.completion_tokens) {
      message.usage = await estimateMessagesUsage({
        assistant,
        messages: [..._messages, message]
      })
      // Set metrics.completion_tokens
      if (message.metrics && message?.usage?.completion_tokens) {
        if (!message.metrics?.completion_tokens) {
          message = {
            ...message,
            metrics: {
              ...message.metrics,
              completion_tokens: message.usage.completion_tokens
            }
          }
        }
      }
    }
    // console.log('message', message) // 注释掉以避免日志过多
  } catch (error: any) {
    if (isAbortError(error)) {
      message.status = 'paused'
    } else {
      message.status = 'error'
      message.error = formatMessageError(error)
    }
  }

  // 如果不是工具调用相关消息，发送消息
  if (!message.metadata?.isToolResultResponse && !message.metadata?.isToolResultQuery) {
    // Emit chat completion event
    EventEmitter.emit(EVENT_NAMES.RECEIVE_MESSAGE, message)
    onResponse(message)
  } else {
    // 如果是工具调用相关消息，只调用回调函数，不发送事件
    // 因为我们已经在工具调用处理中发送了事件
    onResponse(message)
  }

  // Always emit the final message state, including metadata, regardless of tool calls.
  // The previous condition was likely for the old XML tool flow.
  // For native function calls, the tool info is in the metadata of this single message.
  EventEmitter.emit(EVENT_NAMES.RECEIVE_MESSAGE, message)
  onResponse(message)

  // Reset generating state
  store.dispatch(setGenerating(false))
  return message
}

interface FetchTranslateProps {
  message: Message
  assistant: Assistant
  onResponse?: (text: string) => void
}

export async function fetchTranslate({ message, assistant, onResponse }: FetchTranslateProps) {
  const model = getTranslateModel()

  if (!model) {
    throw new Error(i18n.t('error.provider_disabled'))
  }

  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    throw new Error(i18n.t('error.no_api_key'))
  }

  const AI = new AiProvider(provider)

  try {
    return await AI.translate(message, assistant, onResponse)
  } catch (error: any) {
    return ''
  }
}

export async function fetchMessagesSummary({ messages, assistant }: { messages: Message[]; assistant: Assistant }) {
  const model = getTopNamingModel() || assistant.model || getDefaultModel()
  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return null
  }

  const AI = new AiProvider(provider)

  try {
    const text = await AI.summaries(filterMessages(messages), assistant)
    // Remove all quotes from the text
    return text?.replace(/["']/g, '') || null
  } catch (error: any) {
    return null
  }
}

export async function fetchSearchSummary({ messages, assistant }: { messages: Message[]; assistant: Assistant }) {
  const model = assistant.model || getDefaultModel()
  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return null
  }

  const AI = new AiProvider(provider)

  try {
    return await AI.summaryForSearch(messages, assistant)
  } catch (error: any) {
    return null
  }
}

export async function fetchGenerate({
  prompt,
  content,
  modelId
}: {
  prompt: string
  content: string
  modelId?: string
}): Promise<string> {
  // 处理JSON格式的模型ID
  let parsedModelId = modelId
  let providerId = undefined

  if (typeof modelId === 'string' && modelId.startsWith('{')) {
    try {
      const parsedModel = JSON.parse(modelId)
      parsedModelId = parsedModel.id
      providerId = parsedModel.provider
      console.log(`[fetchGenerate] Parsed model ID: ${parsedModelId}, provider: ${providerId}`)
    } catch (error) {
      console.error(`[fetchGenerate] Failed to parse model ID: ${modelId}`, error)
    }
  }

  // 使用指定的模型或默认模型
  let model: Model | undefined = undefined

  // 如果有提供商ID，先尝试从该提供商中查找模型
  if (parsedModelId && providerId) {
    const provider = store.getState().llm.providers.find((p) => p.id === providerId)
    if (provider) {
      model = provider.models.find((m) => m.id === parsedModelId)
    }
  }

  // 如果没找到，尝试在所有模型中查找
  if (!model && parsedModelId) {
    model = store
      .getState()
      .llm.providers.flatMap((provider) => provider.models)
      .find((m) => m.id === parsedModelId)
  }

  // 如果仍然没找到，使用默认模型
  if (!model) {
    console.error(`Model ${modelId} not found, using default model`)
    model = getDefaultModel()
  }

  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return ''
  }

  const AI = new AiProvider(provider)

  try {
    // 使用模型的ID而不是原始的modelId
    if (model) {
      return await AI.generateText({ prompt, content, modelId: model.id })
    } else {
      console.error('No valid model found')
      return ''
    }
  } catch (error: any) {
    console.error('Error generating text:', error)
    return ''
  }
}

export async function fetchSuggestions({
  messages,
  assistant
}: {
  messages: Message[]
  assistant: Assistant
}): Promise<Suggestion[]> {
  const model = assistant.model
  if (!model) {
    return []
  }

  if (model.id.endsWith('global')) {
    return []
  }

  const provider = getAssistantProvider(assistant)
  const AI = new AiProvider(provider)

  try {
    return await AI.suggestions(filterMessages(messages), assistant)
  } catch (error: any) {
    return []
  }
}

// Helper function to validate provider's basic settings such as API key, host, and model list
export function checkApiProvider(provider: Provider): {
  valid: boolean
  error: Error | null
} {
  const key = 'api-check'
  const style = { marginTop: '3vh' }

  if (provider.id !== 'ollama' && provider.id !== 'lmstudio') {
    if (!provider.apiKey) {
      window.message.error({ content: i18n.t('message.error.enter.api.key'), key, style })
      return {
        valid: false,
        error: new Error(i18n.t('message.error.enter.api.key'))
      }
    }
  }

  if (!provider.apiHost) {
    window.message.error({ content: i18n.t('message.error.enter.api.host'), key, style })
    return {
      valid: false,
      error: new Error(i18n.t('message.error.enter.api.host'))
    }
  }

  if (isEmpty(provider.models)) {
    window.message.error({ content: i18n.t('message.error.enter.model'), key, style })
    return {
      valid: false,
      error: new Error(i18n.t('message.error.enter.model'))
    }
  }

  return {
    valid: true,
    error: null
  }
}

export async function checkApi(provider: Provider, model: Model) {
  const validation = checkApiProvider(provider)
  if (!validation.valid) {
    return {
      valid: validation.valid,
      error: validation.error
    }
  }

  const AI = new AiProvider(provider)

  const { valid, error } = await AI.check(model)

  return {
    valid,
    error
  }
}

function hasApiKey(provider: Provider) {
  if (!provider) return false
  if (provider.id === 'ollama' || provider.id === 'lmstudio') return true
  return !isEmpty(provider.apiKey)
}

export async function fetchModels(provider: Provider) {
  const AI = new AiProvider(provider)

  try {
    return await AI.models()
  } catch (error) {
    return []
  }
}

/**
 * Format API keys
 * @param value Raw key string
 * @returns Formatted key string
 */
export const formatApiKeys = (value: string) => {
  return value.replaceAll('，', ',').replaceAll(' ', ',').replaceAll(' ', '').replaceAll('\n', ',')
}
