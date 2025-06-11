// Logo mapping utility for converting string references to imported assets
import ThreeMinTopAppLogo from '@renderer/assets/images/apps/3mintop.png?url'
import AbacusLogo from '@renderer/assets/images/apps/abacus.webp?url'
import AIStudioLogo from '@renderer/assets/images/apps/aistudio.svg?url'
import ApplicationLogo from '@renderer/assets/images/apps/application.png?url'
import BaiduAiAppLogo from '@renderer/assets/images/apps/baidu-ai.png?url'
import BaiduAiSearchLogo from '@renderer/assets/images/apps/baidu-ai-search.webp?url'
import BaicuanAppLogo from '@renderer/assets/images/apps/baixiaoying.webp?url'
import BoltAppLogo from '@renderer/assets/images/apps/bolt.svg?url'
import CiciAppLogo from '@renderer/assets/images/apps/cici.webp?url'
import CozeAppLogo from '@renderer/assets/images/apps/coze.webp?url'
import DangbeiLogo from '@renderer/assets/images/apps/dangbei.jpg?url'
import DevvAppLogo from '@renderer/assets/images/apps/devv.png?url'
import DifyAppLogo from '@renderer/assets/images/apps/dify.svg?url'
import DoubaoAppLogo from '@renderer/assets/images/apps/doubao.png?url'
import DuckDuckGoAppLogo from '@renderer/assets/images/apps/duckduckgo.webp?url'
import FeloAppLogo from '@renderer/assets/images/apps/felo.png?url'
import FlowithAppLogo from '@renderer/assets/images/apps/flowith.svg?url'
import GeminiAppLogo from '@renderer/assets/images/apps/gemini.png?url'
import GensparkLogo from '@renderer/assets/images/apps/genspark.jpg?url'
import GithubCopilotLogo from '@renderer/assets/images/apps/github-copilot.webp?url'
import GoogleAppLogo from '@renderer/assets/images/apps/google.svg?url'
import GrokAppLogo from '@renderer/assets/images/apps/grok.png?url'
import GrokXAppLogo from '@renderer/assets/images/apps/grok-x.png?url'
import HikaLogo from '@renderer/assets/images/apps/hika.webp?url'
import HuggingChatLogo from '@renderer/assets/images/apps/huggingchat.svg?url'
import KimiAppLogo from '@renderer/assets/images/apps/kimi.webp?url'
import LambdaChatLogo from '@renderer/assets/images/apps/lambdachat.webp?url'
import LeChatLogo from '@renderer/assets/images/apps/lechat.png?url'
import MetasoAppLogo from '@renderer/assets/images/apps/metaso.webp?url'
import MonicaLogo from '@renderer/assets/images/apps/monica.webp?url'
import n8nLogo from '@renderer/assets/images/apps/n8n.svg?url'
import NamiAiLogo from '@renderer/assets/images/apps/nm.png?url'
import NamiAiSearchLogo from '@renderer/assets/images/apps/nm-search.webp?url'
import NotebookLMAppLogo from '@renderer/assets/images/apps/notebooklm.svg?url'
import PerplexityAppLogo from '@renderer/assets/images/apps/perplexity.webp?url'
import PoeAppLogo from '@renderer/assets/images/apps/poe.webp?url'
import ZhipuProviderLogo from '@renderer/assets/images/apps/qingyan.png?url'
import QwenlmAppLogo from '@renderer/assets/images/apps/qwenlm.webp?url'
import SensetimeAppLogo from '@renderer/assets/images/apps/sensetime.png?url'
import SparkDeskAppLogo from '@renderer/assets/images/apps/sparkdesk.webp?url'
import ThinkAnyLogo from '@renderer/assets/images/apps/thinkany.webp?url'
import TiangongAiLogo from '@renderer/assets/images/apps/tiangong.png?url'
import WanZhiAppLogo from '@renderer/assets/images/apps/wanzhi.jpg?url'
import WPSLingXiLogo from '@renderer/assets/images/apps/wpslingxi.webp?url'
import XiaoYiAppLogo from '@renderer/assets/images/apps/xiaoyi.webp?url'
import YouLogo from '@renderer/assets/images/apps/you.jpg?url'
import TencentYuanbaoAppLogo from '@renderer/assets/images/apps/yuanbao.webp?url'
import YuewenAppLogo from '@renderer/assets/images/apps/yuewen.png?url'
import ZaiAppLogo from '@renderer/assets/images/apps/zai.png?url'
import ZhihuAppLogo from '@renderer/assets/images/apps/zhihu.png?url'
import ClaudeAppLogo from '@renderer/assets/images/models/claude.png?url'
import HailuoModelLogo from '@renderer/assets/images/models/hailuo.png?url'
import QwenModelLogo from '@renderer/assets/images/models/qwen.png?url'
import DeepSeekProviderLogo from '@renderer/assets/images/providers/deepseek.png?url'
import GroqProviderLogo from '@renderer/assets/images/providers/groq.png?url'
import OpenAiProviderLogo from '@renderer/assets/images/providers/openai.png?url'
import SiliconFlowProviderLogo from '@renderer/assets/images/providers/silicon.png?url'

// Mapping object from string identifiers to imported assets
const LOGO_MAP: Record<string, string> = {
  // Apps
  '3mintop': ThreeMinTopAppLogo,
  'abacus': AbacusLogo,
  'aistudio': AIStudioLogo,
  'application': ApplicationLogo,
  'baidu-ai': BaiduAiAppLogo,
  'baidu-ai-search': BaiduAiSearchLogo,
  'baixiaoying': BaicuanAppLogo,
  'bolt': BoltAppLogo,
  'cici': CiciAppLogo,
  'coze': CozeAppLogo,
  'dangbei': DangbeiLogo,
  'devv': DevvAppLogo,
  'dify': DifyAppLogo,
  'doubao': DoubaoAppLogo,
  'duckduckgo': DuckDuckGoAppLogo,
  'felo': FeloAppLogo,
  'flowith': FlowithAppLogo,
  'gemini': GeminiAppLogo,
  'genspark': GensparkLogo,
  'github-copilot': GithubCopilotLogo,
  'google': GoogleAppLogo,
  'grok': GrokAppLogo,
  'grok-x': GrokXAppLogo,
  'hika': HikaLogo,
  'huggingchat': HuggingChatLogo,
  'kimi': KimiAppLogo,
  'lambdachat': LambdaChatLogo,
  'lechat': LeChatLogo,
  'metaso': MetasoAppLogo,
  'monica': MonicaLogo,
  'n8n': n8nLogo,
  'nm': NamiAiLogo,
  'nm-search': NamiAiSearchLogo,
  'notebooklm': NotebookLMAppLogo,
  'perplexity': PerplexityAppLogo,
  'poe': PoeAppLogo,
  'qingyan': ZhipuProviderLogo,
  'qwenlm': QwenlmAppLogo,
  'sensetime': SensetimeAppLogo,
  'sparkdesk': SparkDeskAppLogo,
  'thinkany': ThinkAnyLogo,
  'tiangong': TiangongAiLogo,
  'wanzhi': WanZhiAppLogo,
  'wpslingxi': WPSLingXiLogo,
  'xiaoyi': XiaoYiAppLogo,
  'you': YouLogo,
  'yuanbao': TencentYuanbaoAppLogo,
  'yuewen': YuewenAppLogo,
  'zai': ZaiAppLogo,
  'zhihu': ZhihuAppLogo,

  // Models
  'claude': ClaudeAppLogo,
  'hailuo': HailuoModelLogo,
  'qwen': QwenModelLogo,

  // Providers
  'deepseek': DeepSeekProviderLogo,
  'groq': GroqProviderLogo,
  'openai': OpenAiProviderLogo,
  'silicon': SiliconFlowProviderLogo,

  // Additional aliases for common references
  'chatgpt': OpenAiProviderLogo,
  'anthropic': ClaudeAppLogo,
  'moonshot': KimiAppLogo,
  'baichuan': BaicuanAppLogo,
  'dashscope': QwenModelLogo,
  'stepfun': YuewenAppLogo,
  'minimax': HailuoModelLogo,
  'baidu-ai-chat': BaiduAiAppLogo,
  'tencent-yuanbao': TencentYuanbaoAppLogo,
  'sensetime-chat': SensetimeAppLogo,
  'spark-desk': SparkDeskAppLogo,
  'hugging-chat': HuggingChatLogo,
  'tiangong-ai': TiangongAiLogo,
  'github-copilot': GithubCopilotLogo
}

/**
 * Get logo asset for a given string identifier
 * @param logoName String identifier for the logo
 * @returns Imported logo asset URL or default ApplicationLogo if not found
 */
export const getLogo = (logoName: string | undefined): string => {
  if (!logoName || typeof logoName !== 'string') {
    return ApplicationLogo
  }

  // Try exact match first
  const logo = LOGO_MAP[logoName.toLowerCase()]
  if (logo) {
    return logo
  }

  // Try without special characters
  const sanitized = logoName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')
  const sanitizedLogo = LOGO_MAP[sanitized]
  if (sanitizedLogo) {
    return sanitizedLogo
  }

  // Try partial matches
  const logoKeys = Object.keys(LOGO_MAP)
  const partialMatch = logoKeys.find(key =>
    key.includes(sanitized) || sanitized.includes(key)
  )

  if (partialMatch) {
    return LOGO_MAP[partialMatch]
  }

  // Fallback to default
  console.warn(`Logo not found for identifier: ${logoName}, using default ApplicationLogo`)
  return ApplicationLogo
}

/**
 * Get all available logo identifiers
 * @returns Array of available logo string identifiers
 */
export const getAvailableLogos = (): string[] => {
  return Object.keys(LOGO_MAP)
}