import { fetchTranslate } from '@renderer/services/ApiService'
import { franc } from 'franc'
import React, { MutableRefObject } from 'react'

/**
 * 检测输入文本的语言
 * @param {string} inputText 需要检测语言的文本
 * @returns {Promise<string>} 检测到的语言代码
 */
export const detectLanguage = async (inputText: string): Promise<string> => {
  if (!inputText.trim()) return 'any'

  const text = inputText.trim()
  const detectedLangCode = franc(text)

  // 映射 ISO 639-3 代码到应用使用的语言代码
  const languageMap: Record<string, string> = {
    cmn: 'chinese', // 普通话
    zho: 'chinese', // 中文
    jpn: 'japanese', // 日语
    kor: 'korean', // 韩语
    rus: 'russian', // 俄语
    spa: 'spanish', // 西班牙语
    fra: 'french', // 法语
    deu: 'german', // 德语
    ita: 'italian', // 意大利语
    por: 'portuguese', // 葡萄牙语
    ara: 'arabic', // 阿拉伯语
    eng: 'english' // 英语
  }

  if (detectedLangCode !== 'und' && languageMap[detectedLangCode]) {
    return languageMap[detectedLangCode]
  }

  try {
    const sampleText = text.substring(0, 200)
    const prompt = `Identify the primary language in this text: "${sampleText}". Reply with only one word from this list: english, chinese, japanese, korean, russian, spanish, french, german, italian, portuguese, arabic.`

    let detectedCode = ''
    await fetchTranslate({
      content: sampleText,
      assistant: {
        id: 'lang-detector',
        name: 'Language Detector',
        prompt,
        topics: [],
        type: 'translator'
      },
      onResponse: (response) => {
        detectedCode = response.trim().toLowerCase()
      }
    })

    const validCodes = [
      'english',
      'chinese',
      'japanese',
      'korean',
      'russian',
      'spanish',
      'french',
      'german',
      'italian',
      'portuguese',
      'arabic'
    ]

    return validCodes.find((code) => detectedCode.includes(code)) || 'english'
  } catch (error) {
    console.error('语言检测错误:', error)
    return 'english'
  }
}

/**
 * 获取双向翻译的目标语言
 * @param sourceLanguage 检测到的源语言
 * @param languagePair 配置的语言对
 * @returns 目标语言
 */
export const getTargetLanguageForBidirectional = (sourceLanguage: string, languagePair: [string, string]): string => {
  if (sourceLanguage === languagePair[0]) {
    return languagePair[1]
  } else if (sourceLanguage === languagePair[1]) {
    return languagePair[0]
  }

  // 默认返回第一个不同于源语言的语言
  return languagePair[0] === sourceLanguage ? languagePair[1] : languagePair[0]
}

/**
 * 检查源语言是否在配置的语言对中
 * @param sourceLanguage 检测到的源语言
 * @param languagePair 配置的语言对
 * @returns 是否在语言对中
 */
export const isLanguageInPair = (sourceLanguage: string, languagePair: [string, string]): boolean => {
  return [languagePair[0], languagePair[1]].includes(sourceLanguage)
}

/**
 * 处理滚动同步
 * @param sourceElement 源元素
 * @param targetElement 目标元素
 * @param isProgrammaticScrollRef 是否程序控制滚动的引用
 */
export const handleScrollSync = (
  sourceElement: HTMLElement,
  targetElement: HTMLElement,
  isProgrammaticScrollRef: MutableRefObject<boolean>
): void => {
  if (isProgrammaticScrollRef.current) return

  isProgrammaticScrollRef.current = true

  // 计算滚动位置比例
  const scrollRatio = sourceElement.scrollTop / (sourceElement.scrollHeight - sourceElement.clientHeight || 1)
  targetElement.scrollTop = scrollRatio * (targetElement.scrollHeight - targetElement.clientHeight || 1)

  requestAnimationFrame(() => {
    isProgrammaticScrollRef.current = false
  })
}

/**
 * 创建输入区域滚动处理函数
 */
export const createInputScrollHandler = (
  targetRef: MutableRefObject<HTMLDivElement | null>,
  isProgrammaticScrollRef: MutableRefObject<boolean>,
  isScrollSyncEnabled: boolean
) => {
  return (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (!isScrollSyncEnabled || !targetRef.current || isProgrammaticScrollRef.current) return
    handleScrollSync(e.currentTarget, targetRef.current, isProgrammaticScrollRef)
  }
}

/**
 * 创建输出区域滚动处理函数
 */
export const createOutputScrollHandler = (
  textAreaRef: MutableRefObject<any>,
  isProgrammaticScrollRef: MutableRefObject<boolean>,
  isScrollSyncEnabled: boolean
) => {
  return (e: React.UIEvent<HTMLDivElement>) => {
    const inputEl = textAreaRef.current?.resizableTextArea?.textArea
    if (!isScrollSyncEnabled || !inputEl || isProgrammaticScrollRef.current) return
    handleScrollSync(e.currentTarget, inputEl, isProgrammaticScrollRef)
  }
}
