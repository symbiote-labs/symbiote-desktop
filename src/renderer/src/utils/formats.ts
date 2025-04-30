import { isReasoningModel } from '@renderer/config/models'
import { getAssistantById } from '@renderer/services/AssistantService'
import { Message } from '@renderer/types'

export function escapeDollarNumber(text: string) {
  let escapedText = ''

  for (let i = 0; i < text.length; i += 1) {
    let char = text[i]
    const nextChar = text[i + 1] || ' '

    if (char === '$' && nextChar >= '0' && nextChar <= '9') {
      char = '\\$'
    }

    escapedText += char
  }

  return escapedText
}

export function escapeBrackets(text: string) {
  if (!text) return ''

  const pattern = /(```[\s\S]*?```|`.*?`)|\\\[([\s\S]*?[^\\])\\\]|\\\((.*?)\\\)/g
  return text.replace(pattern, (match, codeBlock, squareBracket, roundBracket) => {
    if (codeBlock) {
      return codeBlock
    } else if (squareBracket) {
      return `
$$
${squareBracket}
$$
`
    } else if (roundBracket) {
      return `$${roundBracket}$`
    }
    return match
  })
}

export function extractTitle(html: string): string | null {
  const titleRegex = /<title>(.*?)<\/title>/i
  const match = html.match(titleRegex)

  if (match && match[1]) {
    return match[1].trim()
  }

  return null
}

export function removeSvgEmptyLines(text: string): string {
  // 用正则表达式匹配 <svg> 标签内的内容
  const svgPattern = /(<svg[\s\S]*?<\/svg>)/g

  return text.replace(svgPattern, (svgMatch) => {
    // 将 SVG 内容按行分割,过滤掉空行,然后重新组合
    return svgMatch
      .split('\n')
      .filter((line) => line.trim() !== '')
      .join('\n')
  })
}

export function withGeminiGrounding(message: Message) {
  // 检查消息内容是否为空或未定义
  if (message.content === undefined) {
    return ''
  }

  const { groundingSupports } = message?.metadata?.groundingMetadata || {}

  if (!groundingSupports) {
    return message.content
  }

  let content = message.content

  groundingSupports.forEach((support) => {
    const text = support?.segment
    const indices = support?.groundingChunckIndices

    if (!text || !indices) return

    const nodes = indices.reduce<string[]>((acc, index) => {
      acc.push(`<sup>${index + 1}</sup>`)
      return acc
    }, [])

    content = content.replace(text, `${text} ${nodes.join(' ')}`)
  })

  return content
}

interface ThoughtProcessor {
  canProcess: (content: string, message?: Message) => boolean
  process: (content: string) => { reasoning: string; content: string }
}

const glmZeroPreviewProcessor: ThoughtProcessor = {
  canProcess: (content: string, message?: Message) => {
    if (!message) return false

    const modelId = message.modelId || ''
    const modelName = message.model?.name || ''
    const isGLMZeroPreview =
      modelId.toLowerCase().includes('glm-zero-preview') || modelName.toLowerCase().includes('glm-zero-preview')

    // 增强检测能力，支持更多格式
    return (
      isGLMZeroPreview &&
      (content.includes('###Thinking') ||
        content.includes('### Thinking') ||
        content.includes('###思考') ||
        content.includes('### 思考'))
    )
  },
  process: (content: string) => {
    // 支持多种分隔符格式
    const separators = ['###', '### ']
    let parts: string[] = []

    // 尝试使用不同的分隔符分割内容
    for (const separator of separators) {
      if (content.includes(separator)) {
        parts = content.split(separator)
        break
      }
    }

    if (parts.length === 0) {
      parts = content.split('###') // 默认分隔符
    }

    // 支持英文和中文的思考和回应标记
    const thinkingKeywords = ['Thinking', '思考', '推理']
    const responseKeywords = ['Response', '回应', '回复', '回答']

    // 查找思考部分
    let thinkingMatch: string | undefined = undefined
    for (const keyword of thinkingKeywords) {
      const match = parts.find((part) => part && typeof part === 'string' && part.trim().startsWith(keyword))
      if (match) {
        thinkingMatch = match
        break
      }
    }

    // 查找回应部分
    let responseMatch: string | undefined = undefined
    for (const keyword of responseKeywords) {
      const match = parts.find((part) => part && typeof part === 'string' && part.trim().startsWith(keyword))
      if (match) {
        responseMatch = match
        break
      }
    }

    // 提取思考内容和回应内容
    let reasoning = ''
    if (thinkingMatch) {
      // 移除开头的关键词
      for (const keyword of thinkingKeywords) {
        if (thinkingMatch.trim().startsWith(keyword)) {
          reasoning = thinkingMatch.replace(keyword, '').trim()
          break
        }
      }
    }

    let finalContent = ''
    if (responseMatch) {
      // 移除开头的关键词
      for (const keyword of responseKeywords) {
        if (responseMatch.trim().startsWith(keyword)) {
          finalContent = responseMatch.replace(keyword, '').trim()
          break
        }
      }
    }

    return {
      reasoning: reasoning,
      content: finalContent || content // 如果没有找到回应部分，返回原始内容
    }
  }
}

const thinkTagProcessor: ThoughtProcessor = {
  canProcess: (_content: string, message?: Message) => {
    if (!message) return false

    // 大幅放宽检测能力，支持更多格式
    return true // 尝试处理所有消息，让process方法决定是否能提取思考过程
  },
  process: (content: string) => {
    // 1. 处理正常闭合的 think 标签 - 支持多行匹配
    const thinkPatterns = [
      /<think>([\s\S]*?)<\/think>/,
      /<thinking>([\s\S]*?)<\/thinking>/,
      /<thoughts>([\s\S]*?)<\/thoughts>/,
      /<thought>([\s\S]*?)<\/thought>/,
      /<reasoning>([\s\S]*?)<\/reasoning>/,
      /<reason>([\s\S]*?)<\/reason>/,
      /<analysis>([\s\S]*?)<\/analysis>/,
      /<reflection>([\s\S]*?)<\/reflection>/
    ]

    // 尝试匹配所有支持的标签格式
    for (const pattern of thinkPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        return {
          reasoning: matches[1].trim(),
          content: content.replace(pattern, '').trim()
        }
      }
    }

    // 2. 处理只有结束标签的情况
    const endTags = [
      '</think>',
      '</thinking>',
      '</thoughts>',
      '</thought>',
      '</reasoning>',
      '</reason>',
      '</analysis>',
      '</reflection>'
    ]
    for (const endTag of endTags) {
      if (content.includes(endTag)) {
        const parts = content.split(endTag)
        return {
          reasoning: parts[0].trim(),
          content: parts.slice(1).join(endTag).trim()
        }
      }
    }

    // 3. 处理只有开始标签的情况
    const startTags = [
      '<think>',
      '<thinking>',
      '<thoughts>',
      '<thought>',
      '<reasoning>',
      '<reason>',
      '<analysis>',
      '<reflection>'
    ]
    for (const startTag of startTags) {
      if (content.includes(startTag)) {
        const parts = content.split(startTag)
        if (parts.length > 1) {
          return {
            reasoning: parts[1].trim(), // 跳过标签前的内容
            content: parts[0].trim()
          }
        }
      }
    }

    // 4. 处理各种中文思考过程标记格式
    const thinkingLabelPatterns = [
      /(思考过程[:：])([\s\S]*?)(?=\n\n|$)/,
      /(推理过程[:：])([\s\S]*?)(?=\n\n|$)/,
      /(思考[:：])([\s\S]*?)(?=\n\n|$)/,
      /(分析[:：])([\s\S]*?)(?=\n\n|$)/,
      /(推理[:：])([\s\S]*?)(?=\n\n|$)/,
      /(分析思考[:：])([\s\S]*?)(?=\n\n|$)/,
      /(思路[:：])([\s\S]*?)(?=\n\n|$)/
    ]

    // 尝试匹配所有支持的中文标记格式
    for (const pattern of thinkingLabelPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        return {
          reasoning: matches[2].trim(),
          content: content.replace(pattern, '').trim()
        }
      }
    }

    // 5. 处理英文思考过程标记格式
    const englishLabelPatterns = [
      /(Thinking[:：])([\s\S]*?)(?=\n\n|$)/,
      /(Reasoning[:：])([\s\S]*?)(?=\n\n|$)/,
      /(Analysis[:：])([\s\S]*?)(?=\n\n|$)/,
      /(Thought Process[:：])([\s\S]*?)(?=\n\n|$)/,
      /(Thoughts[:：])([\s\S]*?)(?=\n\n|$)/,
      /(Let me think[:：])([\s\S]*?)(?=\n\n|$)/
    ]

    // 尝试匹配所有支持的英文标记格式
    for (const pattern of englishLabelPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        return {
          reasoning: matches[2].trim(),
          content: content.replace(pattern, '').trim()
        }
      }
    }

    // 6. 处理Markdown格式的思考过程
    const markdownPatterns = [
      /```思考\n([\s\S]*?)```/,
      /```thinking\n([\s\S]*?)```/,
      /```thoughts\n([\s\S]*?)```/,
      /```reasoning\n([\s\S]*?)```/,
      /```analysis\n([\s\S]*?)```/
    ]

    // 尝试匹配所有支持的Markdown格式
    for (const pattern of markdownPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        return {
          reasoning: matches[1].trim(),
          content: content.replace(pattern, '').trim()
        }
      }
    }

    // 7. 处理特殊分隔符格式
    const separatorPatterns = [
      /###\s*思考\s*###([\s\S]*?)(?=###|$)/,
      /###\s*Thinking\s*###([\s\S]*?)(?=###|$)/,
      /===\s*思考\s*===([\s\S]*?)(?====|$)/,
      /===\s*Thinking\s*===([\s\S]*?)(?====|$)/,
      /\*\*\*\s*思考\s*\*\*\*([\s\S]*?)(?=\*\*\*|$)/,
      /\*\*\*\s*Thinking\s*\*\*\*([\s\S]*?)(?=\*\*\*|$)/
    ]

    // 尝试匹配所有支持的分隔符格式
    for (const pattern of separatorPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        return {
          reasoning: matches[1].trim(),
          content: content.replace(pattern, '').trim()
        }
      }
    }

    // 如果没有找到任何匹配，返回原始内容
    return {
      reasoning: '',
      content
    }
  }
}

// 添加一个新的处理器，专门处理OpenAI格式的JSON流式输出
const openaiJsonProcessor: ThoughtProcessor = {
  canProcess: (content: string, message?: Message) => {
    if (!message) return false

    // 检查是否包含OpenAI格式的JSON流式输出特征
    return (
      content.includes('data: {"id":"chatcmpl-') || content.includes('data: {"id":') || content.includes('data: [DONE]')
    )
  },
  process: (content: string) => {
    try {
      // 分割行并提取JSON内容
      const lines = content.split('\n')
      let combinedText = ''

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const jsonStr = line.substring(6)
            const jsonData = JSON.parse(jsonStr)

            if (
              jsonData.choices &&
              jsonData.choices[0] &&
              jsonData.choices[0].delta &&
              jsonData.choices[0].delta.content
            ) {
              combinedText += jsonData.choices[0].delta.content
            }
          } catch (e) {
            // 忽略JSON解析错误
            console.log('[openaiJsonProcessor] JSON解析错误，跳过此行:', e)
          }
        }
      }

      // 如果成功提取了文本，处理思考过程
      if (combinedText) {
        // 使用与 thinkTagProcessor 相同的处理逻辑来提取思考过程
        // 处理正常闭合的 think 标签 - 支持多行匹配
        const thinkPatterns = [
          /<think>([\s\S]*?)<\/think>/,
          /<thinking>([\s\S]*?)<\/thinking>/,
          /<thoughts>([\s\S]*?)<\/thoughts>/,
          /<thought>([\s\S]*?)<\/thought>/,
          /<reasoning>([\s\S]*?)<\/reasoning>/,
          /<reason>([\s\S]*?)<\/reason>/,
          /<analysis>([\s\S]*?)<\/analysis>/,
          /<reflection>([\s\S]*?)<\/reflection>/
        ]

        // 尝试匹配所有支持的标签格式
        for (const pattern of thinkPatterns) {
          const matches = combinedText.match(pattern)
          if (matches) {
            // 完全移除思考标签及其内容，确保不会在内容中重复显示
            const tagRegex = new RegExp(pattern.source, 'g')
            return {
              reasoning: matches[1].trim(),
              content: combinedText.replace(tagRegex, '').trim()
            }
          }
        }

        // 处理只有结束标签的情况
        const endTags = [
          '</think>',
          '</thinking>',
          '</thoughts>',
          '</thought>',
          '</reasoning>',
          '</reason>',
          '</analysis>',
          '</reflection>'
        ]
        for (const endTag of endTags) {
          if (combinedText.includes(endTag)) {
            const parts = combinedText.split(endTag)
            return {
              reasoning: parts[0].trim(),
              content: parts.slice(1).join('').trim() // 完全移除结束标签
            }
          }
        }

        // 处理只有开始标签的情况
        const startTags = [
          '<think>',
          '<thinking>',
          '<thoughts>',
          '<thought>',
          '<reasoning>',
          '<reason>',
          '<analysis>',
          '<reflection>'
        ]
        for (const startTag of startTags) {
          if (combinedText.includes(startTag)) {
            const parts = combinedText.split(startTag)
            if (parts.length > 1) {
              return {
                reasoning: parts[1].trim(), // 跳过标签前的内容
                content: parts[0].trim() // 只保留标签前的内容
              }
            }
          }
        }

        // 处理各种中文思考过程标记格式
        const thinkingLabelPatterns = [
          /(思考过程[:：])([\s\S]*?)(?=\n\n|$)/,
          /(推理过程[:：])([\s\S]*?)(?=\n\n|$)/,
          /(思考[:：])([\s\S]*?)(?=\n\n|$)/,
          /(分析[:：])([\s\S]*?)(?=\n\n|$)/,
          /(推理[:：])([\s\S]*?)(?=\n\n|$)/,
          /(分析思考[:：])([\s\S]*?)(?=\n\n|$)/,
          /(思路[:：])([\s\S]*?)(?=\n\n|$)/
        ]

        // 尝试匹配所有支持的中文标记格式
        for (const pattern of thinkingLabelPatterns) {
          const matches = combinedText.match(pattern)
          if (matches) {
            // 完全移除思考标记及其内容
            const fullMatch = matches[0]
            return {
              reasoning: matches[2].trim(),
              content: combinedText.replace(fullMatch, '').trim()
            }
          }
        }

        // 处理英文思考过程标记格式
        const englishLabelPatterns = [
          /(Thinking[:：])([\s\S]*?)(?=\n\n|$)/,
          /(Reasoning[:：])([\s\S]*?)(?=\n\n|$)/,
          /(Analysis[:：])([\s\S]*?)(?=\n\n|$)/,
          /(Thought Process[:：])([\s\S]*?)(?=\n\n|$)/,
          /(Thoughts[:：])([\s\S]*?)(?=\n\n|$)/,
          /(Let me think[:：])([\s\S]*?)(?=\n\n|$)/
        ]

        // 尝试匹配所有支持的英文标记格式
        for (const pattern of englishLabelPatterns) {
          const matches = combinedText.match(pattern)
          if (matches) {
            // 完全移除思考标记及其内容
            const fullMatch = matches[0]
            return {
              reasoning: matches[2].trim(),
              content: combinedText.replace(fullMatch, '').trim()
            }
          }
        }

        // 如果没有找到思考标记，返回原始内容
        return {
          reasoning: '',
          content: combinedText
        }
      }
    } catch (error) {
      console.error('[openaiJsonProcessor] 处理OpenAI JSON输出时出错:', error)
    }

    // 如果处理失败，返回原始内容
    return {
      reasoning: '',
      content
    }
  }
}

export function withMessageThought(message: Message) {
  if (message.role !== 'assistant') {
    return message
  }

  // 检查消息内容是否为空或未定义
  if (message.content === undefined) {
    message.content = ''
    return message
  }

  const model = message.model
  if (!model || !isReasoningModel(model)) return message

  const isClaude37Sonnet = model.id.includes('claude-3-7-sonnet') || model.id.includes('claude-3.7-sonnet')
  if (isClaude37Sonnet) {
    const assistant = getAssistantById(message.assistantId)
    if (!assistant?.settings?.reasoning_effort) return message
  }

  const content = message.content.trim()
  // 添加新的处理器到处理器列表
  const processors: ThoughtProcessor[] = [openaiJsonProcessor, glmZeroPreviewProcessor, thinkTagProcessor]

  // 尝试使用所有处理器提取思考过程
  for (const processor of processors) {
    if (processor.canProcess(content, message)) {
      const { reasoning, content: processedContent } = processor.process(content)

      // 只有当成功提取到思考过程时才更新消息
      if (reasoning) {
        message.reasoning_content = reasoning
        message.content = processedContent
        break // 一旦找到匹配的处理器并成功提取，就停止处理
      }
    }
  }

  return message
}

export function withGenerateImage(message: Message) {
  // 检查消息内容是否为空或未定义
  if (message.content === undefined) {
    message.content = ''
    return message
  }
  const imagePattern = new RegExp(`!\\[[^\\]]*\\]\\((.*?)\\s*("(?:.*[^"])")?\\s*\\)`)
  const imageMatches = message.content.match(imagePattern)

  if (!imageMatches || imageMatches[1] === null) {
    return message
  }

  const cleanImgContent = message.content
    .replace(imagePattern, '')
    .replace(/\n\s*\n/g, '\n')
    .trim()

  const downloadPattern = new RegExp(`\\[[^\\]]*\\]\\((.*?)\\s*("(?:.*[^"])")?\\s*\\)`)
  const downloadMatches = cleanImgContent.match(downloadPattern)

  let cleanContent = cleanImgContent
  if (downloadMatches) {
    cleanContent = cleanImgContent
      .replace(downloadPattern, '')
      .replace(/\n\s*\n/g, '\n')
      .trim()
  }

  message = {
    ...message,
    content: cleanContent,
    metadata: {
      ...message.metadata,
      generateImage: {
        type: 'url',
        images: [imageMatches[1]]
      }
    }
  }
  return message
}

export function addImageFileToContents(messages: Message[]) {
  const lastAssistantMessage = messages.findLast((m) => m.role === 'assistant')
  if (!lastAssistantMessage || !lastAssistantMessage.metadata || !lastAssistantMessage.metadata.generateImage) {
    return messages
  }

  const imageFiles = lastAssistantMessage.metadata.generateImage.images
  const updatedAssistantMessage = {
    ...lastAssistantMessage,
    images: imageFiles
  }

  return messages.map((message) => (message.role === 'assistant' ? updatedAssistantMessage : message))
}
