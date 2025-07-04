import { ContentBlockParam, MessageParam, ToolUnion, ToolUseBlock } from '@anthropic-ai/sdk/resources'
import { Content, FunctionCall, Part, Tool, Type as GeminiSchemaType } from '@google/genai'
import Logger from '@renderer/config/logger'
import { isFunctionCallingModel, isVisionModel } from '@renderer/config/models'
import store from '@renderer/store'
import { addMCPServer } from '@renderer/store/mcp'
import {
  Assistant,
  MCPCallToolResponse,
  MCPServer,
  MCPTool,
  MCPToolResponse,
  Model,
  ToolUseResponse
} from '@renderer/types'
import type { MCPToolCompleteChunk, MCPToolInProgressChunk, MCPToolProgressChunk } from '@renderer/types/chunk'
import { ChunkType } from '@renderer/types/chunk'
import { isArray, isObject, pull, transform } from 'lodash'
import { nanoid } from 'nanoid'
import OpenAI from 'openai'
import {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool
} from 'openai/resources'

import { CompletionsParams } from '../aiCore/middleware/schemas'

const MCP_AUTO_INSTALL_SERVER_NAME = '@cherry/mcp-auto-install'
const EXTRA_SCHEMA_KEYS = ['schema', 'headers']

// Global map to track progress handlers for tool calls
const toolProgressHandlers = new Map<string, (chunk: MCPToolProgressChunk) => void>()

// Set up global progress listener (only once)
let progressListenerSetup = false
const setupProgressListener = () => {
  if (progressListenerSetup) return
  console.log('[RENDERER] Setting up MCP progress listener')
  progressListenerSetup = true

  window.api.mcp.onToolProgress((progressData: any) => {
    console.log('[RENDERER] 📨 RECEIVED tool progress data:', progressData)
    const { toolCallId, ...progress } = progressData
    console.log('[RENDERER] 🔍 Tool call ID:', toolCallId, 'Progress:', progress)
    console.log('[RENDERER] 📋 Active progress handlers:', Array.from(toolProgressHandlers.keys()))

    if (toolProgressHandlers.has(toolCallId)) {
      console.log('[RENDERER] ✅ Found progress handler for tool call:', toolCallId)
      const handler = toolProgressHandlers.get(toolCallId)!
      const chunk: MCPToolProgressChunk = {
        type: ChunkType.MCP_TOOL_PROGRESS,
        toolCallId,
        progressToken: progress.progressToken || '',
        progress: progress.progress || 0,
        total: progress.total,
        message: progress.message
      }
      console.log('[RENDERER] 🚀 Calling progress handler with chunk:', chunk)
      handler(chunk)
      console.log('[RENDERER] ✅ Progress handler called successfully')
    } else {
      console.warn('[RENDERER] ❌ No progress handler found for tool call:', toolCallId)
      console.warn('[RENDERER] 📋 Available handlers:', Array.from(toolProgressHandlers.keys()))
    }
  })
}

export function filterProperties(
  properties: Record<string, any> | string | number | boolean | Array<Record<string, any> | string | number | boolean>,
  supportedKeys: string[]
) {
  // If it is an array, recursively process each element
  if (isArray(properties)) {
    return properties.map((item) => filterProperties(item, supportedKeys))
  }

  // If it is an object, recursively process each property
  if (isObject(properties)) {
    return transform(
      properties,
      (result, value, key) => {
        if (key === 'properties') {
          result[key] = transform(value, (acc, v, k) => {
            acc[k] = filterProperties(v, supportedKeys)
          })

          result['additionalProperties'] = false
          result['required'] = pull(Object.keys(value), ...EXTRA_SCHEMA_KEYS)
        } else if (key === 'oneOf') {
          // openai only supports anyOf
          result['anyOf'] = filterProperties(value, supportedKeys)
        } else if (supportedKeys.includes(key)) {
          result[key] = filterProperties(value, supportedKeys)
          if (key === 'type' && value === 'object') {
            result['additionalProperties'] = false
          }
        }
      },
      {}
    )
  }

  // Return other types directly (e.g., string, number, etc.)
  return properties
}

export function mcpToolsToOpenAIResponseTools(mcpTools: MCPTool[]): OpenAI.Responses.Tool[] {
  const schemaKeys = ['type', 'description', 'items', 'enum', 'additionalProperties', 'anyof']
  return mcpTools.map(
    (tool) =>
      ({
        type: 'function',
        name: tool.id,
        parameters: {
          type: 'object',
          properties: filterProperties(tool.inputSchema, schemaKeys).properties,
          required: pull(Object.keys(tool.inputSchema.properties), ...EXTRA_SCHEMA_KEYS),
          additionalProperties: false
        },
        strict: true
      }) satisfies OpenAI.Responses.Tool
  )
}

export function mcpToolsToOpenAIChatTools(mcpTools: MCPTool[]): Array<ChatCompletionTool> {
  return mcpTools.map(
    (tool) =>
      ({
        type: 'function',
        function: {
          name: tool.id,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: tool.inputSchema.properties,
            required: tool.inputSchema.required
          }
        }
      }) as ChatCompletionTool
  )
}

export function openAIToolsToMcpTool(
  mcpTools: MCPTool[],
  toolCall: OpenAI.Responses.ResponseFunctionToolCall | ChatCompletionMessageToolCall
): MCPTool | undefined {
  const tool = mcpTools.find((mcpTool) => {
    if ('name' in toolCall) {
      return mcpTool.id === toolCall.name || mcpTool.name === toolCall.name
    } else {
      return mcpTool.id === toolCall.function.name || mcpTool.name === toolCall.function.name
    }
  })

  if (!tool) {
    console.warn('No MCP Tool found for tool call:', toolCall)
    return undefined
  }

  return tool
}

export async function callMCPTool(
  toolResponse: MCPToolResponse,
  onChunk?: (chunk: MCPToolProgressChunk) => void
): Promise<MCPCallToolResponse> {
  Logger.log(`[MCP] Calling Tool: ${toolResponse.tool.serverName} ${toolResponse.tool.name}`, toolResponse.tool)

  // Use the LLM tool call ID that matches the toolCallIdToBlockIdMap key
  const toolCallId = toolResponse.id
  console.log(`[RENDERER] Using tool response ID for progress tracking: ${toolCallId}`)

  try {
    const server = getMcpServerByTool(toolResponse.tool)

    if (!server) {
      throw new Error(`Server not found: ${toolResponse.tool.serverName}`)
    }

    // Set up progress listener for this tool call if onChunk is provided
    if (onChunk) {
      console.log('[RENDERER] 🔧 Setting up progress handler for tool call:', toolCallId)
      setupProgressListener()
      toolProgressHandlers.set(toolCallId, onChunk)
      console.log('[RENDERER] ✅ Progress handler registered successfully')
      console.log('[RENDERER] 📋 Progress handlers after adding:', Array.from(toolProgressHandlers.keys()))
    } else {
      console.log('[RENDERER] ⚠️ No onChunk callback provided for tool call:', toolCallId)
    }

    let resp: MCPCallToolResponse

    try {
      // Always use the unified callTool API with optional progress tracking
      resp = await window.api.mcp.callTool({
        server,
        name: toolResponse.tool.name,
        args: toolResponse.arguments,
        toolCallId
      })
    } finally {
      // Clean up progress handler
      if (onChunk) {
        toolProgressHandlers.delete(toolCallId)
        console.log(`[RENDERER] Cleaned up progress handler for: ${toolCallId}`)
      }
    }

    if (toolResponse.tool.serverName === MCP_AUTO_INSTALL_SERVER_NAME) {
      // Check if response contains structured data for MCP server installation
      const textContent = resp.content.find((item) => item.type === 'text')?.text
      if (textContent) {
        try {
          const serverData = JSON.parse(textContent)
          if (serverData && serverData.name) {
            const mcpServer: MCPServer = {
              id: `f${nanoid()}`,
              name: serverData.name,
              description: serverData.description,
              baseUrl: serverData.baseUrl,
              command: serverData.command,
              args: serverData.args,
              env: serverData.env,
              registryUrl: '',
              isActive: false,
              provider: 'CherryAI'
            }
            store.dispatch(addMCPServer(mcpServer))
          }
        } catch (error) {
          Logger.warn('[MCP] Failed to parse auto-install server data:', error)
        }
      }
    }

    Logger.log(`[MCP] Tool called: ${toolResponse.tool.serverName} ${toolResponse.tool.name}`, resp)
    return resp
  } catch (e) {
    console.error(`[MCP] Error calling Tool: ${toolResponse.tool.serverName} ${toolResponse.tool.name}`, e)
    return Promise.resolve({
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error calling tool ${toolResponse.tool.name}: ${e instanceof Error ? e.stack || e.message || 'No error details available' : JSON.stringify(e)}`
        }
      ]
    })
  }
}

export function mcpToolsToAnthropicTools(mcpTools: MCPTool[]): Array<ToolUnion> {
  return mcpTools.map((tool) => {
    const t: ToolUnion = {
      name: tool.id,
      description: tool.description,
      // @ts-ignore ignore type as it it unknow
      input_schema: tool.inputSchema
    }
    return t
  })
}

export function anthropicToolUseToMcpTool(mcpTools: MCPTool[] | undefined, toolUse: ToolUseBlock): MCPTool | undefined {
  if (!mcpTools) return undefined
  const tool = mcpTools.find((tool) => tool.id === toolUse.name)
  if (!tool) {
    return undefined
  }
  return tool
}

/**
 * @param mcpTools
 * @returns
 */
export function mcpToolsToGeminiTools(mcpTools: MCPTool[]): Tool[] {
  /**
   * @typedef {import('@google/genai').Schema} Schema
   */
  const schemaKeys = [
    'example',
    'pattern',
    'default',
    'maxLength',
    'minLength',
    'minProperties',
    'maxProperties',
    'anyOf',
    'description',
    'enum',
    'format',
    'items',
    'maxItems',
    'maximum',
    'minItems',
    'minimum',
    'nullable',
    'properties',
    'propertyOrdering',
    'required',
    'title',
    'type'
  ]
  return [
    {
      functionDeclarations: mcpTools?.map((tool) => {
        return {
          name: tool.id,
          description: tool.description,
          parameters: {
            type: GeminiSchemaType.OBJECT,
            properties: filterProperties(tool.inputSchema, schemaKeys).properties,
            required: tool.inputSchema.required
          }
        }
      })
    }
  ]
}

export function geminiFunctionCallToMcpTool(
  mcpTools: MCPTool[] | undefined,
  toolCall: FunctionCall | undefined
): MCPTool | undefined {
  if (!toolCall) return undefined
  if (!mcpTools) return undefined
  const tool = mcpTools.find((tool) => tool.id === toolCall.name)
  if (!tool) {
    return undefined
  }
  return tool
}

export function upsertMCPToolResponse(
  results: MCPToolResponse[],
  resp: MCPToolResponse,
  onChunk: (chunk: MCPToolInProgressChunk | MCPToolCompleteChunk | MCPToolProgressChunk) => void
) {
  const index = results.findIndex((ret) => ret.id === resp.id)
  let result = resp
  if (index !== -1) {
    const cur = {
      ...results[index],
      response: resp.response,
      arguments: resp.arguments,
      status: resp.status
    }
    results[index] = cur
    result = cur
  } else {
    results.push(resp)
  }
  onChunk({
    type: resp.status === 'invoking' ? ChunkType.MCP_TOOL_IN_PROGRESS : ChunkType.MCP_TOOL_COMPLETE,
    responses: [result]
  })
}

export function filterMCPTools(
  mcpTools: MCPTool[] | undefined,
  enabledServers: MCPServer[] | undefined
): MCPTool[] | undefined {
  if (mcpTools) {
    if (enabledServers) {
      mcpTools = mcpTools.filter((t) => enabledServers.some((m) => m.name === t.serverName))
    } else {
      mcpTools = []
    }
  }
  return mcpTools
}

export function getMcpServerByTool(tool: MCPTool) {
  const servers = store.getState().mcp.servers
  return servers.find((s) => s.id === tool.serverId)
}

export function parseToolUse(content: string, mcpTools: MCPTool[]): ToolUseResponse[] {
  if (!content || !mcpTools || mcpTools.length === 0) {
    return []
  }

  // 支持两种格式：
  // 1. 完整的 <tool_use></tool_use> 标签包围的内容
  // 2. 只有内部内容（从 TagExtractor 提取出来的）

  let contentToProcess = content

  // 如果内容不包含 <tool_use> 标签，说明是从 TagExtractor 提取的内部内容，需要包装
  if (!content.includes('<tool_use>')) {
    contentToProcess = `<tool_use>\n${content}\n</tool_use>`
  }

  const toolUsePattern =
    /<tool_use>([\s\S]*?)<name>([\s\S]*?)<\/name>([\s\S]*?)<arguments>([\s\S]*?)<\/arguments>([\s\S]*?)<\/tool_use>/g
  const tools: ToolUseResponse[] = []
  let match
  let idx = 0
  // Find all tool use blocks
  while ((match = toolUsePattern.exec(contentToProcess)) !== null) {
    // const fullMatch = match[0]
    const toolName = match[2].trim()
    const toolArgs = match[4].trim()

    // Try to parse the arguments as JSON
    let parsedArgs
    try {
      parsedArgs = JSON.parse(toolArgs)
    } catch (error) {
      // If parsing fails, use the string as is
      parsedArgs = toolArgs
    }
    // Logger.log(`Parsed arguments for tool "${toolName}":`, parsedArgs)
    const mcpTool = mcpTools.find((tool) => tool.id === toolName)
    if (!mcpTool) {
      Logger.error(`Tool "${toolName}" not found in MCP tools`)
      continue
    }

    // Add to tools array
    tools.push({
      id: `${toolName}-${idx++}`, // Unique ID for each tool use
      toolUseId: mcpTool.id,
      tool: mcpTool,
      arguments: parsedArgs,
      status: 'pending'
    })

    // Remove the tool use block from the content
    // content = content.replace(fullMatch, '')
  }
  return tools
}

export async function parseAndCallTools<R>(
  content: string | MCPToolResponse[],
  allToolResponses: MCPToolResponse[],
  onChunk: CompletionsParams['onChunk'],
  convertToMessage: (mcpToolResponse: MCPToolResponse, resp: MCPCallToolResponse, model: Model) => R | undefined,
  model: Model,
  mcpTools?: MCPTool[]
): Promise<R[]> {
  const toolResults: R[] = []
  let curToolResponses: MCPToolResponse[] = []
  if (Array.isArray(content)) {
    curToolResponses = content
  } else {
    // process tool use
    curToolResponses = parseToolUse(content, mcpTools || [])
  }
  if (!curToolResponses || curToolResponses.length === 0) {
    return toolResults
  }
  for (let i = 0; i < curToolResponses.length; i++) {
    const toolResponse = curToolResponses[i]
    upsertMCPToolResponse(
      allToolResponses,
      {
        ...toolResponse,
        status: 'invoking'
      },
      onChunk!
    )
  }

  // Execute all tools in parallel for better Anthropic compatibility
  // Anthropic expects all tool_result blocks to be available in the next message
  const toolPromises = curToolResponses.map(async (toolResponse) => {
    const images: string[] = []

    // Create progress handler for this tool call
    const progressHandler = (progressChunk: MCPToolProgressChunk) => {
      onChunk?.(progressChunk)
    }

    // Execute tool call with progress tracking
    const toolCallResponse = await callMCPTool(toolResponse, progressHandler)

    upsertMCPToolResponse(
      allToolResponses,
      {
        ...toolResponse,
        status: 'done',
        response: toolCallResponse
      },
      onChunk!
    )

    for (const content of toolCallResponse.content) {
      if (content.type === 'image' && content.data) {
        images.push(`data:${content.mimeType};base64,${content.data}`)
      }
    }

    if (images.length) {
      onChunk?.({
        type: ChunkType.IMAGE_CREATED
      })
      onChunk?.({
        type: ChunkType.IMAGE_COMPLETE,
        image: {
          type: 'base64',
          images: images
        }
      })
    }

    const message = convertToMessage(toolResponse, toolCallResponse, model)
    return { toolResponse, toolCallResponse, message }
  })

  // Wait for all tools to complete and collect results
  const toolExecutionResults = await Promise.all(toolPromises)

  // Add all messages to results in the original order
  for (const result of toolExecutionResults) {
    if (result.message) {
      toolResults.push(result.message)
    }
  }

  return toolResults
}

export function mcpToolCallResponseToOpenAICompatibleMessage(
  mcpToolResponse: MCPToolResponse,
  resp: MCPCallToolResponse,
  isVisionModel: boolean = false
): ChatCompletionMessageParam {
  const message = {
    role: 'user'
  } as ChatCompletionMessageParam

  if (resp.isError) {
    message.content = JSON.stringify(resp.content)
  } else {
    const content: ChatCompletionContentPart[] = [
      {
        type: 'text',
        text: `Here is the result of mcp tool use \`${mcpToolResponse.tool.name}\`:`
      }
    ]

    if (isVisionModel) {
      for (const item of resp.content) {
        switch (item.type) {
          case 'text':
            content.push({
              type: 'text',
              text: item.text || 'no content'
            })
            break
          case 'image':
            content.push({
              type: 'image_url',
              image_url: {
                url: `data:${item.mimeType};base64,${item.data}`,
                detail: 'auto'
              }
            })
            break
          case 'audio':
            content.push({
              type: 'input_audio',
              input_audio: {
                data: `data:${item.mimeType};base64,${item.data}`,
                format: 'mp3'
              }
            })
            break
          default:
            content.push({
              type: 'text',
              text: `Unsupported type: ${item.type}`
            })
            break
        }
      }
    } else {
      content.push({
        type: 'text',
        text: JSON.stringify(resp.content)
      })
    }

    message.content = content
  }

  return message
}

export function mcpToolCallResponseToOpenAIMessage(
  mcpToolResponse: MCPToolResponse,
  resp: MCPCallToolResponse,
  isVisionModel: boolean = false
): OpenAI.Responses.EasyInputMessage {
  const message = {
    role: 'user'
  } as OpenAI.Responses.EasyInputMessage

  if (resp.isError) {
    message.content = JSON.stringify(resp.content)
  } else {
    const content: OpenAI.Responses.ResponseInputContent[] = [
      {
        type: 'input_text',
        text: `Here is the result of mcp tool use \`${mcpToolResponse.tool.name}\`:`
      }
    ]

    if (isVisionModel) {
      for (const item of resp.content) {
        switch (item.type) {
          case 'text':
            content.push({
              type: 'input_text',
              text: item.text || 'no content'
            })
            break
          case 'image':
            content.push({
              type: 'input_image',
              image_url: `data:${item.mimeType};base64,${item.data}`,
              detail: 'auto'
            })
            break
          default:
            content.push({
              type: 'input_text',
              text: `Unsupported type: ${item.type}`
            })
            break
        }
      }
    } else {
      content.push({
        type: 'input_text',
        text: JSON.stringify(resp.content)
      })
    }

    message.content = content
  }

  return message
}

export function mcpToolCallResponseToAnthropicMessage(
  mcpToolResponse: MCPToolResponse,
  resp: MCPCallToolResponse,
  model: Model
): MessageParam {
  const message = {
    role: 'user'
  } as MessageParam
  if (resp.isError) {
    message.content = JSON.stringify(resp.content)
  } else {
    const content: ContentBlockParam[] = [
      {
        type: 'text',
        text: `Here is the result of mcp tool use \`${mcpToolResponse.tool.name}\`:`
      }
    ]
    if (isVisionModel(model)) {
      for (const item of resp.content) {
        switch (item.type) {
          case 'text':
            content.push({
              type: 'text',
              text: item.text || 'no content'
            })
            break
          case 'image':
            if (
              item.mimeType === 'image/png' ||
              item.mimeType === 'image/jpeg' ||
              item.mimeType === 'image/webp' ||
              item.mimeType === 'image/gif'
            ) {
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  data: `data:${item.mimeType};base64,${item.data}`,
                  media_type: item.mimeType
                }
              })
            } else {
              content.push({
                type: 'text',
                text: `Unsupported image type: ${item.mimeType}`
              })
            }
            break
          default:
            content.push({
              type: 'text',
              text: `Unsupported type: ${item.type}`
            })
            break
        }
      }
    } else {
      content.push({
        type: 'text',
        text: JSON.stringify(resp.content)
      })
    }
    message.content = content
  }

  return message
}

export function mcpToolCallResponseToGeminiMessage(
  mcpToolResponse: MCPToolResponse,
  resp: MCPCallToolResponse,
  isVisionModel: boolean = false
): Content {
  const message = {
    role: 'user'
  } as Content

  if (resp.isError) {
    message.parts = [
      {
        text: JSON.stringify(resp.content)
      }
    ]
  } else {
    const parts: Part[] = [
      {
        text: `Here is the result of mcp tool use \`${mcpToolResponse.tool.name}\`:`
      }
    ]
    if (isVisionModel) {
      for (const item of resp.content) {
        switch (item.type) {
          case 'text':
            parts.push({
              text: item.text || 'no content'
            })
            break
          case 'image':
            if (!item.data) {
              parts.push({
                text: 'No image data provided'
              })
            } else {
              parts.push({
                inlineData: {
                  data: item.data,
                  mimeType: item.mimeType || 'image/png'
                }
              })
            }
            break
          default:
            parts.push({
              text: `Unsupported type: ${item.type}`
            })
            break
        }
      }
    } else {
      parts.push({
        text: JSON.stringify(resp.content)
      })
    }
    message.parts = parts
  }

  return message
}

export function isEnabledToolUse(assistant: Assistant) {
  if (assistant.model) {
    if (isFunctionCallingModel(assistant.model)) {
      return assistant.settings?.toolUseMode === 'function'
    }
  }

  return false
}
