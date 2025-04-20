import { getOpenAIWebSearchParams, isOpenAIWebSearch } from '@renderer/config/models'
import { SEARCH_SUMMARY_PROMPT } from '@renderer/config/prompts'
import i18n from '@renderer/i18n'
import store from '@renderer/store'
import {
  Assistant,
  KnowledgeReference,
  MCPTool,
  Model,
  Provider,
  Suggestion,
  WebSearchResponse,
  WebSearchSource
} from '@renderer/types'
import type { Chunk } from '@renderer/types/chunk'
import { MainTextMessageBlock, Message, MessageBlockType } from '@renderer/types/newMessage'
import { formatMessageError } from '@renderer/utils/error'
import { extractInfoFromXML, ExtractResults } from '@renderer/utils/extract'
import { getMainTextContent } from '@renderer/utils/messageUtils/find'
import { findLast, isEmpty } from 'lodash'

import AiProvider from '../providers/AiProvider'
import {
  getAssistantProvider,
  getDefaultModel,
  getProviderByModel,
  getTopNamingModel,
  getTranslateModel
} from './AssistantService'
import { getDefaultAssistant } from './AssistantService'
import { processKnowledgeSearch } from './KnowledgeService'
import { filterContextMessages, filterMessages, filterUsefulMessages } from './MessagesService'
import WebSearchService from './WebSearchService'

// Define a type for the chunk data passed to onChunkReceived
// type ChunkCallbackData = {
//   type?: 'text' | 'reasoning' | 'status' | 'metadata' | 'final'
//   text?: string
//   reasoning_content?: string
//   status?: 'searching' | 'processing' | 'success' | 'error'
//   webSearch?: WebSearchResponse | any[]
//   knowledge?: KnowledgeReference[]
//   error?: any
// }

type ExternalToolResult = {
  mcpTools?: MCPTool[]
}

async function fetchExternalTool(
  lastUserMessage: Message,
  lastAnswer: Message,
  assistant: Assistant,
  onChunkReceived: (chunk: Chunk) => void
): Promise<ExternalToolResult | null> {
  const hasKnowledgeBase = !isEmpty(lastUserMessage?.blocks)
  const webSearchProvider = WebSearchService.getWebSearchProvider()

  let extractResults: ExtractResults | undefined

  // --- Keyword/Question Extraction Function ---
  const extract = async (): Promise<ExtractResults | undefined> => {
    if (!lastUserMessage) return undefined
    if (!assistant.enableWebSearch && !hasKnowledgeBase) return undefined

    // Notify UI that extraction/searching is starting
    onChunkReceived({ type: 'web_search_in_progress' })

    const summaryAssistant = getDefaultAssistant()
    summaryAssistant.model = assistant.model || getDefaultModel()
    summaryAssistant.prompt = SEARCH_SUMMARY_PROMPT

    try {
      const keywords = await fetchSearchSummary({
        messages: lastAnswer ? [lastAnswer, lastUserMessage] : [lastUserMessage],
        assistant: summaryAssistant
      })
      return extractInfoFromXML(keywords || '')
    } catch (e: any) {
      console.error('extract error', e)
      // Fallback to using original content if extraction fails
      const fallbackContent = getMainTextContent(lastUserMessage)
      return {
        websearch: {
          question: [fallbackContent || 'search']
        },
        knowledge: {
          question: [fallbackContent || 'search']
        }
      } as ExtractResults
    }
  }

  // --- Web Search Function ---
  const searchTheWeb = async (): Promise<WebSearchResponse | undefined> => {
    if (!lastUserMessage || !extractResults?.websearch || !assistant.model) return

    const shouldSearch =
      WebSearchService.isWebSearchEnabled() &&
      assistant.enableWebSearch &&
      extractResults.websearch.question[0] !== 'not_needed'

    if (!shouldSearch) return

    // Pass the guaranteed model to the check function
    const webSearchParams = getOpenAIWebSearchParams(assistant, assistant.model)
    if (!isEmpty(webSearchParams) || isOpenAIWebSearch(assistant.model)) {
      console.log('Using built-in OpenAI web search, skipping external search.')
      return
    }

    console.log('Performing external web search...')
    try {
      // Use the consolidated processWebsearch function
      return {
        results: await WebSearchService.processWebsearch(webSearchProvider, extractResults),
        source: WebSearchSource.WEBSEARCH
      }
    } catch (error) {
      console.error('Web search failed:', error)
      return
    }
  }

  // --- Knowledge Base Search Function ---
  const searchKnowledgeBase = async (): Promise<KnowledgeReference[] | undefined> => {
    if (!lastUserMessage || !extractResults?.knowledge) return

    const shouldSearch = hasKnowledgeBase && extractResults.knowledge.question[0] !== 'not_needed'

    if (!shouldSearch) return

    console.log('Performing knowledge base search...')
    try {
      // Attempt to get knowledgeBaseIds from the main text block
      // NOTE: This assumes knowledgeBaseIds are ONLY on the main text block
      // NOTE: processKnowledgeSearch needs to handle undefined ids gracefully
      const mainTextBlock = lastUserMessage.blocks
        ?.map((blockId) => store.getState().messageBlocks.entities[blockId])
        .find((block) => block?.type === MessageBlockType.MAIN_TEXT) as MainTextMessageBlock | undefined
      const knowledgeIds = mainTextBlock?.knowledgeBaseIds

      return await processKnowledgeSearch(
        extractResults,
        knowledgeIds // Pass potentially undefined ids
      )
    } catch (error) {
      console.error('Knowledge base search failed:', error)
      return
    }
  }

  // --- Execute Extraction and Searches ---
  if (assistant.enableWebSearch || hasKnowledgeBase) {
    extractResults = await extract()
    console.log('extractResults', extractResults)
  }
  // Run searches potentially in parallel
  const [webSearchResponseFromSearch, knowledgeReferencesFromSearch] = await Promise.all([
    searchTheWeb(),
    searchKnowledgeBase()
  ])

  // --- Prepare for AI Completion ---

  // Update status to processing *after* search phase
  onChunkReceived({ type: 'block_in_progress' })

  // Store results temporarily (e.g., using window.keyv like before)
  if (lastUserMessage) {
    if (webSearchResponseFromSearch) {
      window.keyv.set(`web-search-${lastUserMessage.id}`, webSearchResponseFromSearch)
    }
    if (knowledgeReferencesFromSearch) {
      window.keyv.set(`knowledge-search-${lastUserMessage.id}`, knowledgeReferencesFromSearch)
    }
  }

  // Get MCP tools (Fix duplicate declaration)
  let mcpTools: MCPTool[] = [] // Initialize as empty array
  const enabledMCPs = lastUserMessage?.enabledMCPs
  if (enabledMCPs && enabledMCPs.length > 0) {
    try {
      const toolPromises = enabledMCPs.map(async (mcpServer) => {
        const tools = await window.api.mcp.listTools(mcpServer)
        return tools.filter((tool: any) => !mcpServer.disabledTools?.includes(tool.name))
      })
      const results = await Promise.all(toolPromises)
      mcpTools = results.flat() // Flatten the array of arrays
    } catch (toolError) {
      console.error('Error fetching MCP tools:', toolError)
      // Decide how to handle tool fetching errors, maybe proceed without tools?
    }
  }
  return { mcpTools }
}

export async function fetchChatCompletion({
  messages,
  assistant,
  onChunkReceived
}: {
  messages: Message[]
  assistant: Assistant
  onChunkReceived: (chunk: Chunk) => void
  // TODO
  // onChunkStatus: (status: 'searching' | 'processing' | 'success' | 'error') => void
}) {
  const provider = getAssistantProvider(assistant)
  const AI = new AiProvider(provider)

  const lastUserMessage = findLast(messages, (m) => m.role === 'user')
  const lastAnswer = findLast(messages, (m) => m.role === 'assistant')
  if (!lastUserMessage || !lastAnswer) return
  try {
    // NOTE: The search results are NOT added to the messages sent to the AI here.
    // They will be retrieved and used by the messageThunk later to create CitationBlocks.
    const externalToolResult = await fetchExternalTool(lastUserMessage, lastAnswer, assistant, onChunkReceived)

    // Filter messages for context
    const filteredMessages = filterUsefulMessages(filterContextMessages(messages))

    // --- Call AI Completions ---
    await AI.completions({
      messages: filteredMessages,
      assistant,
      onFilterMessages: () => {},
      onChunk: onChunkReceived,
      mcpTools: externalToolResult?.mcpTools
    })

    // --- Signal Final Success ---
    onChunkReceived({ type: 'block_complete' })
  } catch (error: any) {
    console.error('Error during fetchChatCompletion:', error)
    // Signal Final Error
    onChunkReceived({ type: 'error', error: formatMessageError(error) })
    // Re-throwing might still be desired depending on upstream error handling
    // throw error;
  }
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

export async function fetchGenerate({ prompt, content }: { prompt: string; content: string }): Promise<string> {
  const model = getDefaultModel()
  const provider = getProviderByModel(model)

  if (!hasApiKey(provider)) {
    return ''
  }

  const AI = new AiProvider(provider)

  try {
    return await AI.generateText({ prompt, content })
  } catch (error: any) {
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
  if (!model || model.id.endsWith('global')) {
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

export const formatApiKeys = (value: string) => {
  return value.replaceAll('，', ',').replaceAll(' ', ',').replaceAll(' ', '').replaceAll('\n', ',')
}

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
