// 从OpenAI库导出的类型定义
// 直接从资源中导入需要的类型，而不是导入整个OpenAI模块

// 定义ChatCompletionRequestMessage类型
export type ChatCompletionRequestMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
  name?: string
}

// 导出其他可能需要的OpenAI类型
export type { ChatCompletionContentPart } from 'openai/resources'
