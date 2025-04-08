import i18n from '@renderer/i18n'
import store from '@renderer/store'
import { Message } from '@renderer/types'

/**
 * TTS服务，用于将文本转换为语音
 */
class TTSService {
  private audio: HTMLAudioElement | null = null
  private isPlaying = false

  /**
   * 将文本转换为语音并播放
   * @param text 要转换的文本
   */
  speak = async (text: string): Promise<void> => {
    try {
      const { ttsEnabled, ttsServiceType, ttsApiKey, ttsApiUrl, ttsVoice, ttsModel, ttsEdgeVoice } = store.getState().settings

      if (!ttsEnabled) {
        window.message.error({ content: i18n.t('settings.tts.error.not_enabled'), key: 'tts-error' })
        return
      }

      // 停止当前正在播放的音频
      this.stop()

      // 显示加载提示
      window.message.loading({ content: i18n.t('settings.tts.processing', { defaultValue: '正在生成语音...' }), key: 'tts-loading' })

      // 初始化为空的Blob，防止类型错误
      let audioBlob: Blob = new Blob([], { type: 'audio/wav' })

      // 根据服务类型选择不同的TTS实现
      console.log('当前TTS服务类型:', ttsServiceType)

      // 确保ttsServiceType是有效的值
      // 从存储中重新获取服务类型，确保使用最新的设置
      // 强制使用最新的状态，而不是传入的参数
      const latestSettings = store.getState().settings
      const serviceType = latestSettings.ttsServiceType || 'openai'
      console.log('最终使用的TTS服务类型:', serviceType)
      console.log('当前完整TTS设置:', {
        ttsEnabled: latestSettings.ttsEnabled,
        ttsServiceType: latestSettings.ttsServiceType,
        ttsApiKey: latestSettings.ttsApiKey ? '已设置' : '未设置',
        ttsVoice: latestSettings.ttsVoice,
        ttsModel: latestSettings.ttsModel,
        ttsEdgeVoice: latestSettings.ttsEdgeVoice
      })

      if (serviceType === 'openai') {
        // 检查OpenAI TTS所需的参数
        if (!ttsApiKey) {
          window.message.error({ content: i18n.t('settings.tts.error.no_api_key'), key: 'tts-error' })
          return
        }

        if (!ttsApiUrl) {
          window.message.error({ content: i18n.t('settings.tts.error.no_api_url'), key: 'tts-error' })
          return
        }

        if (!ttsVoice) {
          window.message.error({ content: i18n.t('settings.tts.error.no_voice'), key: 'tts-error' })
          return
        }

        if (!ttsModel) {
          window.message.error({ content: i18n.t('settings.tts.error.no_model'), key: 'tts-error' })
          return
        }

        // 准备OpenAI TTS请求体
        const requestBody: any = {
          input: text
        }

        // 只有当模型和音色不为空时才添加到请求体中
        if (ttsModel) {
          requestBody.model = ttsModel
        }

        if (ttsVoice) {
          requestBody.voice = ttsVoice
        }

        // 调用OpenAI TTS API
        const response = await fetch(ttsApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ttsApiKey}`
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'OpenAI语音合成失败')
        }

        // 获取音频数据
        console.log('获取到OpenAI TTS响应，开始处理音频数据')
        audioBlob = await response.blob()
      } else if (serviceType === 'edge') {
        // 使用浏览器的Web Speech API
        if (!ttsEdgeVoice) {
          window.message.error({ content: i18n.t('settings.tts.error.no_edge_voice'), key: 'tts-error' })
          return
        }

        try {
          console.log('使用浏览器TTS生成语音，音色:', ttsEdgeVoice)

          // 使用Web Speech API
          if (!('speechSynthesis' in window)) {
            throw new Error(i18n.t('settings.tts.error.browser_not_support'))
          }

          // 停止当前正在播放的语音
          window.speechSynthesis.cancel()

          // 创建语音合成器实例
          const utterance = new SpeechSynthesisUtterance(text)

          // 获取可用的语音合成声音
          let voices = window.speechSynthesis.getVoices()
          console.log('初始可用的语音合成声音:', voices)

          // 如果没有可用的声音，等待声音加载
          if (voices.length === 0) {
            try {
              await new Promise<void>((resolve) => {
                const voicesChangedHandler = () => {
                  window.speechSynthesis.onvoiceschanged = null
                  resolve()
                }

                window.speechSynthesis.onvoiceschanged = voicesChangedHandler

                // 设置超时，防止无限等待
                setTimeout(() => {
                  window.speechSynthesis.onvoiceschanged = null
                  resolve() // 超时后仍然继续，而不是报错
                }, 2000)
              })
            } catch (e) {
              console.warn('等待语音加载时出错:', e)
            }
          }

          // 重新获取声音列表
          const updatedVoices = window.speechSynthesis.getVoices()
          console.log('更新后的声音列表:', updatedVoices)

          // 尝试找到指定的声音
          let selectedVoice: SpeechSynthesisVoice | undefined = undefined

          // 输出所有可用的语音信息，便于调试
          console.log('所有可用的语音信息:')
          updatedVoices.forEach((voice, index) => {
            console.log(`语音 ${index + 1}:`, {
              name: voice.name,
              lang: voice.lang,
              default: voice.default,
              localService: voice.localService,
              voiceURI: voice.voiceURI
            })
          })

          // 记录当前选择的音色，便于调试
          console.log('当前选择的Edge TTS音色:', ttsEdgeVoice)

          // 创建一个音色映射表，将Neural音色映射到浏览器原生音色
          const voiceMapping: Record<string, string[]> = {
            // 中文音色映射
            'zh-CN-XiaoxiaoNeural': ['Microsoft Yaoyao', 'Microsoft Huihui', 'Google 普通话'],
            'zh-CN-YunyangNeural': ['Microsoft Kangkang', 'Google 普通话'],
            'zh-CN-XiaohanNeural': ['Microsoft Yaoyao', 'Microsoft Huihui', 'Google 普通话'],
            'zh-CN-XiaoshuangNeural': ['Microsoft Yaoyao', 'Microsoft Huihui', 'Google 普通话'],
            'zh-CN-XiaoruiNeural': ['Microsoft Yaoyao', 'Microsoft Huihui', 'Google 普通话'],
            'zh-CN-XiaomoNeural': ['Microsoft Yaoyao', 'Microsoft Huihui', 'Google 普通话'],
            'zh-CN-XiaoranNeural': ['Microsoft Kangkang', 'Google 普通话'],
            'zh-CN-XiaokunNeural': ['Microsoft Kangkang', 'Google 普通话'],

            // 英文音色映射
            'en-US-AriaNeural': ['Microsoft Zira', 'Google US English', 'Google UK English Female'],
            'en-US-GuyNeural': ['Microsoft David', 'Google UK English Male'],
            'en-US-JennyNeural': ['Microsoft Zira', 'Google US English', 'Google UK English Female'],

            // 西班牙语音色映射
            'es-ES-ElviraNeural': ['Google español'],

            // 日语音色映射
            'ja-JP-KeitaNeural': ['Google 日本語'],
            'ja-JP-NanamiNeural': ['Google 日本語']
          }

          // 先尝试使用映射表进行匹配
          if (ttsEdgeVoice && voiceMapping[ttsEdgeVoice]) {
            console.log('使用映射表匹配音色:', ttsEdgeVoice)

            // 遍历映射表中的候选音色
            for (const candidateVoice of voiceMapping[ttsEdgeVoice]) {
              // 尝试找到匹配的音色
              const matchedVoice = updatedVoices.find(voice =>
                voice.name.includes(candidateVoice) ||
                voice.voiceURI.includes(candidateVoice)
              )

              if (matchedVoice) {
                selectedVoice = matchedVoice
                console.log('使用映射表找到匹配的音色:', matchedVoice.name)
                break
              }
            }
          }

          // 如果映射表没有找到匹配，尝试精确匹配名称
          if (!selectedVoice) {
            selectedVoice = updatedVoices.find(voice => voice.name === ttsEdgeVoice)
            if (selectedVoice) {
              console.log('找到精确匹配的语音:', selectedVoice.name)
            }
          }

          // 如果没有精确匹配，尝试匹配 Neural 类型的语音
          if (!selectedVoice && ttsEdgeVoice && ttsEdgeVoice.includes('Neural')) {
            // 提取语言代码，如zh-CN
            const langParts = ttsEdgeVoice.split('-')
            if (langParts.length >= 2) {
              const langCode = langParts.slice(0, 2).join('-')
              console.log('检测到Neural音色值，提取语言代码:', langCode)

              // 先尝试匹配包含语言代码的语音
              selectedVoice = updatedVoices.find(voice =>
                voice.lang.startsWith(langCode) &&
                (voice.name.includes(langParts[2]) || // 匹配人名部分，如Xiaoxiao
                 voice.name.toLowerCase().includes(langParts[2].toLowerCase()))
              )

              // 如果没有找到，就匹配该语言的任何语音
              if (!selectedVoice) {
                selectedVoice = updatedVoices.find(voice => voice.lang.startsWith(langCode))
                if (selectedVoice) {
                  console.log('找到匹配语言的语音:', selectedVoice.name)
                }
              }
            }
          }

          // 如果还没有找到，尝试模糊匹配
          if (!selectedVoice && ttsEdgeVoice) {
            console.log('尝试模糊匹配语音:', ttsEdgeVoice)

            // 尝试匹配名称中包含的部分
            selectedVoice = updatedVoices.find(voice =>
              voice.name.toLowerCase().includes(ttsEdgeVoice.toLowerCase()) ||
              ttsEdgeVoice.toLowerCase().includes(voice.name.toLowerCase())
            )

            if (selectedVoice) {
              console.log('找到模糊匹配的语音:', selectedVoice.name)
            }
          }

          // 如果还是没有找到，尝试根据语言代码匹配
          if (!selectedVoice && ttsEdgeVoice) {
            // 尝试从音色值中提取语言代码
            let langCode = ''

            if (ttsEdgeVoice.includes('zh')) {
              langCode = 'zh'
            } else if (ttsEdgeVoice.includes('en')) {
              langCode = 'en'
            } else if (ttsEdgeVoice.includes('ja')) {
              langCode = 'ja'
            } else if (ttsEdgeVoice.includes('es')) {
              langCode = 'es'
            }

            if (langCode) {
              console.log('尝试根据语言代码匹配语音:', langCode)
              selectedVoice = updatedVoices.find(voice => voice.lang.startsWith(langCode))

              if (selectedVoice) {
                console.log('找到匹配语言代码的语音:', selectedVoice.name)
              }
            }
          }

          // 如果还是没有找到，使用默认语音或第一个可用的语音
          if (!selectedVoice) {
            // 先尝试使用默认语音
            selectedVoice = updatedVoices.find(voice => voice.default)

            // 如果没有默认语音，使用第一个可用的语音
            if (!selectedVoice && updatedVoices.length > 0) {
              console.log('没有找到匹配的语音，使用第一个可用的语音')
              selectedVoice = updatedVoices[0]
            }
          }

          if (selectedVoice) {
            utterance.voice = selectedVoice
            console.log('选择的声音:', selectedVoice)
          } else {
            console.warn('未找到指定的声音，使用默认声音')
          }

          // 设置语音合成参数
          utterance.rate = 1.0  // 语速（0.1-10）
          utterance.pitch = 1.0 // 音调（0-2）
          utterance.volume = 1.0 // 音量（0-1）

          // 设置事件处理程序
          utterance.onstart = () => {
            console.log('Edge TTS 开始播放')
          }

          utterance.onend = () => {
            console.log('Edge TTS 播放结束')
          }

          utterance.onerror = (event) => {
            console.error('Edge TTS 播放错误:', event)
          }

          // 将文本分段处理，避免过长文本导致的问题
          if (text.length > 200) {
            console.log('文本过长，分段处理以确保完整播放')

            // 将文本按句子分段
            const sentences = text.split(/[.!?\u3002\uff01\uff1f]/).filter(s => s.trim().length > 0)
            console.log(`将文本分为 ${sentences.length} 个句子进行播放`)

            // 创建多个语音合成器实例
            for (let i = 0; i < sentences.length; i++) {
              const sentenceText = sentences[i].trim() + '.'
              if (sentenceText.length > 0) {
                const sentenceUtterance = new SpeechSynthesisUtterance(sentenceText)

                // 复制语音设置
                if (selectedVoice) sentenceUtterance.voice = selectedVoice
                sentenceUtterance.rate = utterance.rate
                sentenceUtterance.pitch = utterance.pitch
                sentenceUtterance.volume = utterance.volume

                // 添加到队列
                window.speechSynthesis.speak(sentenceUtterance)
              }
            }
          } else {
            // 直接使用Web Speech API播放语音
            window.speechSynthesis.speak(utterance)
          }

          // 创建一个有效的音频文件作为占位符
          // 这是一个最小的有效WAV文件头
          const wavHeader = new Uint8Array([
            0x52, 0x49, 0x46, 0x46, // "RIFF"
            0x24, 0x00, 0x00, 0x00, // 文件大小
            0x57, 0x41, 0x56, 0x45, // "WAVE"
            0x66, 0x6d, 0x74, 0x20, // "fmt "
            0x10, 0x00, 0x00, 0x00, // fmt块大小
            0x01, 0x00,             // 格式类型
            0x01, 0x00,             // 通道数
            0x44, 0xac, 0x00, 0x00, // 采样率
            0x88, 0x58, 0x01, 0x00, // 字节率
            0x02, 0x00,             // 块对齐
            0x10, 0x00,             // 位深度
            0x64, 0x61, 0x74, 0x61, // "data"
            0x10, 0x00, 0x00, 0x00  // 数据大小 (16 bytes)
          ]);

          // 添加一些样本数据
          const dummyAudio = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
          const combinedArray = new Uint8Array(wavHeader.length + dummyAudio.length);
          combinedArray.set(wavHeader);
          combinedArray.set(dummyAudio, wavHeader.length);

          // 创建一个有效的WAV文件
          let localAudioBlob = new Blob([combinedArray], { type: 'audio/wav' })
          console.log('创建了有效WAV文件，大小:', localAudioBlob.size, 'bytes')

          // 显示成功消息
          window.message.success({ content: i18n.t('settings.tts.playing', { defaultValue: '语音播放中...' }), key: 'tts-loading' })

          // 在Edge TTS模式下，我们不需要播放音频元素，因为浏览器已经在播放语音
          // 我们只需要创建一个有效的音频Blob作为占位符

          // 等待语音播放完成
          await new Promise<void>((resolve, reject) => {
            // 创建一个检查播放状态的函数
            let isPlaying = true
            let checkInterval: number | null = null

            // 定期检查播放状态
            const checkPlayingStatus = () => {
              if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
                console.log('Edge TTS 播放完成（通过检测检测到）')
                isPlaying = false
                if (checkInterval) {
                  clearInterval(checkInterval)
                  checkInterval = null
                }
                resolve()
              }
            }

            // 设置事件处理程序
            const originalOnEnd = utterance.onend
            utterance.onend = (event) => {
              console.log('Edge TTS 播放结束（通过事件检测到）')
              isPlaying = false
              if (checkInterval) {
                clearInterval(checkInterval)
                checkInterval = null
              }
              if (originalOnEnd) originalOnEnd.call(utterance, event)
              resolve()
            }

            const originalOnError = utterance.onerror
            utterance.onerror = (event) => {
              console.error('Edge TTS 播放错误:', event)
              isPlaying = false
              if (checkInterval) {
                clearInterval(checkInterval)
                checkInterval = null
              }
              if (originalOnError) originalOnError.call(utterance, event)
              reject(new Error(`语音合成错误: ${event.error}`))
            }

            // 开始定期检查
            checkInterval = window.setInterval(checkPlayingStatus, 500) as unknown as number

            // 设置超时，防止语音合成卡住
            setTimeout(() => {
              if (isPlaying) {
                console.log('Edge TTS 播放超时，强制结束')
                if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
                  window.speechSynthesis.cancel()
                }
                isPlaying = false
                if (checkInterval) {
                  clearInterval(checkInterval)
                  checkInterval = null
                }
                resolve()
              }
            }, 30000) // 30秒超时
          })

          // 如果没有音频数据，使用默认的音频
          if (!localAudioBlob) {
            // 创建一个有效的音频数据
            // 这是一个最小的有效WAV文件头
            const wavHeader = new Uint8Array([
              0x52, 0x49, 0x46, 0x46, // "RIFF"
              0x24, 0x00, 0x00, 0x00, // 文件大小
              0x57, 0x41, 0x56, 0x45, // "WAVE"
              0x66, 0x6d, 0x74, 0x20, // "fmt "
              0x10, 0x00, 0x00, 0x00, // fmt块大小
              0x01, 0x00,             // 格式类型
              0x01, 0x00,             // 通道数
              0x44, 0xac, 0x00, 0x00, // 采样率
              0x88, 0x58, 0x01, 0x00, // 字节率
              0x02, 0x00,             // 块对齐
              0x10, 0x00,             // 位深度
              0x64, 0x61, 0x74, 0x61, // "data"
              0x00, 0x00, 0x00, 0x00  // 数据大小
            ]);

            // 添加一些样本数据
            const dummyAudio = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
            const combinedArray = new Uint8Array(wavHeader.length + dummyAudio.length);
            combinedArray.set(wavHeader);
            combinedArray.set(dummyAudio, wavHeader.length);

            localAudioBlob = new Blob([combinedArray], { type: 'audio/wav' })
            console.log('创建了有效WAV文件，大小:', localAudioBlob.size, 'bytes')
          }

          // 设置全局音频Blob
          audioBlob = localAudioBlob
        } catch (error: any) {
          console.error('浏览器TTS错误:', error)

          // 如果浏览器TTS失败，尝试使用默认的音频
          try {
            // 创建一个简单的音频数据
            const audioContext = new AudioContext()
            const oscillator = audioContext.createOscillator()
            const gainNode = audioContext.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(audioContext.destination)

            oscillator.type = 'sine'
            oscillator.frequency.value = 440 // A4音频
            gainNode.gain.value = 0.5

            oscillator.start()

            // 录制音频
            const mediaStreamDest = audioContext.createMediaStreamDestination()
            gainNode.connect(mediaStreamDest)

            const mediaRecorder = new MediaRecorder(mediaStreamDest.stream)
            const fallbackAudioChunks: BlobPart[] = []
            let fallbackAudioBlob: Blob | null = null

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                fallbackAudioChunks.push(event.data)
              }
            }

            mediaRecorder.onstop = () => {
              fallbackAudioBlob = new Blob(fallbackAudioChunks, { type: 'audio/wav' })
              oscillator.stop()
            }

            mediaRecorder.start()

            // 录制500毫秒
            await new Promise<void>(resolve => setTimeout(resolve, 500))

            mediaRecorder.stop()

            // 等待录制完成
            await new Promise<void>(resolve => {
              mediaRecorder.onstop = () => {
                fallbackAudioBlob = new Blob(fallbackAudioChunks, { type: 'audio/wav' })
                oscillator.stop()
                resolve()
              }
            })

            // 设置全局音频Blob
            if (fallbackAudioBlob) {
              audioBlob = fallbackAudioBlob
            }
          } catch (fallbackError) {
            console.error('默认音频生成失败:', fallbackError)
            throw new Error(`浏览器TTS语音合成失败: ${error.message}`)
          }
        }
      } else {
        console.error('不支持的TTS服务类型:', serviceType)
        // 默认使用OpenAI TTS
        if (!ttsApiKey) {
          window.message.error({ content: i18n.t('settings.tts.error.no_api_key'), key: 'tts-error' })
          return
        }

        if (!ttsApiUrl) {
          window.message.error({ content: i18n.t('settings.tts.error.no_api_url'), key: 'tts-error' })
          return
        }

        if (!ttsVoice) {
          window.message.error({ content: i18n.t('settings.tts.error.no_voice'), key: 'tts-error' })
          return
        }

        if (!ttsModel) {
          window.message.error({ content: i18n.t('settings.tts.error.no_model'), key: 'tts-error' })
          return
        }

        // 准备OpenAI TTS请求体
        const requestBody: any = {
          input: text
        }

        // 只有当模型和音色不为空时才添加到请求体中
        if (ttsModel) {
          requestBody.model = ttsModel
        }

        if (ttsVoice) {
          requestBody.voice = ttsVoice
        }

        // 调用OpenAI TTS API
        const response = await fetch(ttsApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ttsApiKey}`
          },
          body: JSON.stringify(requestBody)
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error?.message || 'OpenAI语音合成失败')
        }

        // 获取音频数据
        console.log('获取到OpenAI TTS响应，开始处理音频数据')
        audioBlob = await response.blob()
      }

      // 确保audioBlob已经初始化
      if (!audioBlob) {
        // 创建一个有效的音频文件作为占位符
        // 这是一个最小的有效WAV文件头
        const wavHeader = new Uint8Array([
          0x52, 0x49, 0x46, 0x46, // "RIFF"
          0x24, 0x00, 0x00, 0x00, // 文件大小
          0x57, 0x41, 0x56, 0x45, // "WAVE"
          0x66, 0x6d, 0x74, 0x20, // "fmt "
          0x10, 0x00, 0x00, 0x00, // fmt块大小
          0x01, 0x00,             // 格式类型
          0x01, 0x00,             // 通道数
          0x44, 0xac, 0x00, 0x00, // 采样率
          0x88, 0x58, 0x01, 0x00, // 字节率
          0x02, 0x00,             // 块对齐
          0x10, 0x00,             // 位深度
          0x64, 0x61, 0x74, 0x61, // "data"
          0x10, 0x00, 0x00, 0x00  // 数据大小 (16 bytes)
        ]);

        // 添加一些样本数据
        const dummyAudio = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
        const combinedArray = new Uint8Array(wavHeader.length + dummyAudio.length);
        combinedArray.set(wavHeader);
        combinedArray.set(dummyAudio, wavHeader.length);

        audioBlob = new Blob([combinedArray], { type: 'audio/wav' })
        console.log('创建了有效WAV文件，大小:', audioBlob.size, 'bytes')
      }

      console.log('音频Blob大小:', audioBlob.size, 'bytes', '类型:', audioBlob.type)
      const audioUrl = URL.createObjectURL(audioBlob)
      console.log('创建的Blob URL:', audioUrl)

      // 创建音频元素并播放
      this.audio = new Audio()
      this.audio.oncanplay = () => {
        console.log('音频已准备好可以播放')
      }
      this.audio.onended = () => {
        console.log('音频播放结束')
        this.isPlaying = false
        URL.revokeObjectURL(audioUrl)
      }
      this.audio.onerror = (error) => {
        console.error('音频播放错误:', error)
        console.error('错误代码:', this.audio?.error?.code)
        console.error('错误消息:', this.audio?.error?.message)
        window.message.error({ content: `音频播放失败: ${this.audio?.error?.message || '未知错误'}`, key: 'tts-error' })
        this.isPlaying = false
        URL.revokeObjectURL(audioUrl)
      }

      // 设置音频源并播放
      this.audio.src = audioUrl
      console.log('开始播放音频')
      try {
        await this.audio.play()
        console.log('音频开始播放')
        this.isPlaying = true
      } catch (error: any) {
        console.error('播放音频时出错:', error)
        window.message.error({ content: `播放音频失败: ${error.message}`, key: 'tts-error' })
        this.isPlaying = false
        URL.revokeObjectURL(audioUrl)
        throw error
      }

      // 关闭加载提示
      window.message.success({ content: '语音播放中...', key: 'tts-loading' })
    } catch (error: any) {
      console.error('TTS错误:', error)
      window.message.error({ content: `语音合成失败: ${error.message}`, key: 'tts-error' })
    }
  }

  /**
   * 清理文本，移除不需要的标点符号和格式化标记
   * @param text 要清理的文本
   * @returns 清理后的文本
   */
  private cleanTextForSpeech(text: string): string {
    // 获取最新的TTS设置
    const { ttsFilterOptions = {
      filterThinkingProcess: true,
      filterMarkdown: true,
      filterCodeBlocks: true,
      filterHtmlTags: true,
      maxTextLength: 4000
    }, ttsServiceType } = store.getState().settings;

    // 输出当前的TTS服务类型，便于调试
    console.log('清理文本时使用的TTS服务类型:', ttsServiceType || 'openai')
    let cleanedText = text;

    // 根据过滤选项进行处理

    // 移除Markdown格式化的符号，如*号、`号等
    if (ttsFilterOptions.filterMarkdown) {
      cleanedText = cleanedText
        // 移除加粗和斜体标记
        .replace(/\*\*([^*]+)\*\*/g, '$1') // **bold** -> bold
        .replace(/\*([^*]+)\*/g, '$1')       // *italic* -> italic
        .replace(/__([^_]+)__/g, '$1')       // __bold__ -> bold
        .replace(/_([^_]+)_/g, '$1')         // _italic_ -> italic
        // 移除链接格式，只保留链接文本
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url) -> text
    }

    // 移除代码块
    if (ttsFilterOptions.filterCodeBlocks) {
      cleanedText = cleanedText
        .replace(/```[\s\S]*?```/g, '')      // 移除代码块
        .replace(/`([^`]+)`/g, '$1');       // `code` -> code
    }

    // 移除HTML标签
    if (ttsFilterOptions.filterHtmlTags) {
      cleanedText = cleanedText.replace(/<[^>]*>/g, '');
    }

    // 基本清理（始终执行）
    cleanedText = cleanedText
      // 将多个连续的空格替换为单个空格
      .replace(/\s+/g, ' ')
      // 将多个连续的换行替换为单个换行
      .replace(/\n+/g, '\n')
      // 移除行首和行尾的空白字符
      .trim();

    return cleanedText;
  }

  /**
   * 检测并移除思考过程
   * @param text 要处理的文本
   * @returns 处理后的文本
   */
  private removeThinkingProcess(text: string): string {
    // 获取最新的TTS设置
    const { ttsFilterOptions = {
      filterThinkingProcess: true,
      filterMarkdown: true,
      filterCodeBlocks: true,
      filterHtmlTags: true,
      maxTextLength: 4000
    }, ttsServiceType } = store.getState().settings;

    // 输出当前的TTS服务类型，便于调试
    console.log('移除思考过程时使用的TTS服务类型:', ttsServiceType || 'openai')

    // 如果不需要过滤思考过程，直接返回原文本
    if (!ttsFilterOptions.filterThinkingProcess) {
      return text;
    }
    // 如果整个文本都是{'text': '...'}格式，则不处理
    // 这种情况可能是伪思考过程，实际上是整个回答
    const isFullTextJson = text.trim().startsWith('{') &&
                          text.includes('"text":') &&
                          text.trim().endsWith('}') &&
                          !text.includes('\n\n');

    // 如果文本中包含多个段落或明显的思考过程标记，则处理
    const hasThinkingMarkers = text.includes('<think>') ||
                              text.includes('<thinking>') ||
                              text.includes('[THINKING]') ||
                              text.includes('```thinking');

    // 如果文本以JSON格式开头，且不是整个文本都是JSON，或者包含思考过程标记
    if ((text.trim().startsWith('{') && text.includes('"text":') && !isFullTextJson) || hasThinkingMarkers) {
      // 尝试提取JSON中的text字段
      try {
        const match = text.match(/"text":\s*"([^"]+)"/);
        if (match && match[1]) {
          // 只返回text字段的内容
          return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      } catch (e) {
        console.error('解析JSON失败:', e);
      }
    }

    // 直接检查是否以<think>开头
    const trimmedText = text.trim();
    console.log('检查是否以<think>开头:', trimmedText.startsWith('<think>'));

    if (trimmedText.startsWith('<think>')) {
      // 如果文本以<think>开头，则尝试找到对应的</think>结尾标签
      const endTagIndex = text.indexOf('</think>');
      console.log('结束标签位置:', endTagIndex);

      if (endTagIndex !== -1) {
        // 找到结束标签，去除<think>...</think>部分
        const thinkContent = text.substring(0, endTagIndex + 9); // 思考过程部分
        const afterThinkTag = text.substring(endTagIndex + 9).trim(); // 9是</think>的长度

        console.log('思考过程内容长度:', thinkContent.length);
        console.log('思考过程后的内容长度:', afterThinkTag.length);
        console.log('思考过程后的内容开头:', afterThinkTag.substring(0, 50));

        if (afterThinkTag) {
          console.log('找到<think>标签，已移除思考过程');
          return afterThinkTag;
        } else {
          // 如果思考过程后没有内容，则尝试提取思考过程中的有用信息
          console.log('思考过程后没有内容，尝试提取思考过程中的有用信息');

          // 提取<think>和</think>之间的内容
          const thinkContentText = text.substring(text.indexOf('<think>') + 7, endTagIndex).trim();

          // 如果思考过程中包含“这是”或“This is”等关键词，可能是有用的信息
          if (thinkContentText.includes('这是') ||
              thinkContentText.includes('This is') ||
              thinkContentText.includes('The error') ||
              thinkContentText.includes('错误')) {

            // 尝试找到最后一个段落，可能包含总结信息
            const paragraphs = thinkContentText.split(/\n\s*\n/);
            if (paragraphs.length > 0) {
              const lastParagraph = paragraphs[paragraphs.length - 1].trim();
              if (lastParagraph.length > 50) { // 确保段落足够长
                console.log('从思考过程中提取了最后一个段落');
                return lastParagraph;
              }
            }

            // 如果没有找到合适的段落，返回整个思考过程
            console.log('返回整个思考过程内容');
            return thinkContentText;
          }
        }
      }
    }

    // 先处理<think>标签
    if (text.includes('<think>')) {
      const startIndex = text.indexOf('<think>');
      const endIndex = text.indexOf('</think>');

      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        console.log('找到<think>标签，起始位置:', startIndex, '结束位置:', endIndex);

        // 提取<think>和</think>之间的内容
        const thinkContent = text.substring(startIndex + 7, endIndex);

        // 提取</think>后面的内容
        const afterThinkContent = text.substring(endIndex + 9).trim(); // 9是</think>的长度

        console.log('<think>内容长度:', thinkContent.length);
        console.log('</think>后内容长度:', afterThinkContent.length);

        if (afterThinkContent) {
          // 如果</think>后面有内容，则使用该内容
          console.log('使用</think>后面的内容');
          return afterThinkContent;
        } else {
          // 如果</think>后面没有内容，则使用思考过程中的内容
          console.log('使用<think>标签中的内容');
          return thinkContent;
        }
      }
    }

    // 如果没有<think>标签或处理失败，则移除其他思考过程标记
    let processedText = text
      // 移除HTML标记的思考过程
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      // 移除方括号标记的思考过程
      .replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '')
      .replace(/\[THINK\][\s\S]*?\[\/THINK\]/gi, '')
      // 移除代码块标记的思考过程
      .replace(/```thinking[\s\S]*?```/gi, '')
      .replace(/```think[\s\S]*?```/gi, '')
      // 移除开头的“我先思考一下”类似的句子
      .replace(/^(\s*)(\S+\s+)?(\S+\s+)?(\S+\s+)?(我|让我|让我们|我们|我先|我来)(思考|分析|理解|看一下|想一想)[^\n]*\n/i, '')
      // 移除开头的“Let me think”类似的句子
      .replace(/^(\s*)(\S+\s+)?(\S+\s+)?(\S+\s+)?(Let me|I'll|I will|I need to|Let's|I'm going to)\s+(think|analyze|understand|consider|break down)[^\n]*\n/i, '')
      // 移除开头的“To answer this question”类似的句子
      .replace(/^(\s*)(\S+\s+)?(\S+\s+)?(\S+\s+)?(To answer this|To solve this|To address this|To respond to this)[^\n]*\n/i, '')

    // 如果文本中包含“我的回答是”或“我的答案是”，只保留这之后的内容
    const answerMarkers = [
      /[\n\r]+(\s*)(我的|最终|最终的|正确的|完整的)?(回答|答案|结论|解决方案)(是|如下|就是|就是如下)[\s:：]*/i,
      /[\n\r]+(\s*)(My|The|Final|Complete|Correct)\s+(answer|response|solution|conclusion)\s+(is|would be|follows)[\s:]*/i
    ];

    for (const marker of answerMarkers) {
      const parts = processedText.split(marker);
      if (parts.length > 1) {
        // 取最后一个匹配后的内容
        return parts[parts.length - 1].trim();
      }
    }

    return processedText;
  }



  /**
   * 从消息中提取文本并转换为语音
   * @param message 消息对象
   */
  speakFromMessage = async (message: Message): Promise<void> => {
    // 只读取回答内容，不读取思考过程
    let text = message.content

    // 如果有翻译内容，则使用翻译内容
    if (message.translatedContent) {
      text = message.translatedContent
    }

    console.log('原始文本长度:', text.length)
    console.log('原始文本开头:', text.substring(0, 100))

    // 先移除思考过程
    const processedText = this.removeThinkingProcess(text);
    console.log('移除思考过程后文本长度:', processedText.length);
    console.log('处理后文本开头:', processedText.substring(0, 100));
    text = processedText;

    // 清理文本，移除不需要的标点符号
    text = this.cleanTextForSpeech(text)
    console.log('清理标点符号后文本长度:', text.length)

    // 获取最新的TTS设置
    const latestSettings = store.getState().settings;
    const ttsFilterOptions = latestSettings.ttsFilterOptions || {
      filterThinkingProcess: true,
      filterMarkdown: true,
      filterCodeBlocks: true,
      filterHtmlTags: true,
      maxTextLength: 4000
    };
    const ttsServiceType = latestSettings.ttsServiceType;

    // 输出当前的TTS服务类型，便于调试
    console.log('当前消息播放使用的TTS服务类型:', ttsServiceType || 'openai')
    console.log('消息播放时完整TTS设置:', {
      ttsEnabled: latestSettings.ttsEnabled,
      ttsServiceType: latestSettings.ttsServiceType,
      ttsApiKey: latestSettings.ttsApiKey ? '已设置' : '未设置',
      ttsVoice: latestSettings.ttsVoice,
      ttsModel: latestSettings.ttsModel,
      ttsEdgeVoice: latestSettings.ttsEdgeVoice
    })

    // 如果消息过长，可能会导致TTS API超时或失败
    // 根据设置的最大文本长度进行截断
    const maxLength = ttsFilterOptions.maxTextLength || 4000; // 默认为4000
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + '...'
      console.log(`文本过长，已截断为${maxLength}个字符`)
    }

    await this.speak(text)
  }

  /**
   * 暂停当前播放的音频
   */
  pause = (): void => {
    if (this.audio && this.isPlaying) {
      this.audio.pause()
      this.isPlaying = false
    }
  }

  /**
   * 恢复播放
   */
  resume = (): void => {
    if (this.audio && !this.isPlaying) {
      this.audio.play()
      this.isPlaying = true
    }
  }

  /**
   * 停止播放并释放资源
   */
  stop = (): void => {
    console.log('执行停止TTS播放操作')

    try {
      // 首先将音量设为0，避免停止时的特殊声音
      if (this.audio) {
        // 先将音量渐变为0，避免突然停止的噪音
        const originalVolume = this.audio.volume || 1
        const fadeOutSteps = 5
        const fadeOutInterval = 20 // 毫秒

        // 如果正在播放，则渐变音量
        if (this.isPlaying) {
          const fadeStep = originalVolume / fadeOutSteps
          let currentStep = 0

          const fadeOut = () => {
            if (currentStep < fadeOutSteps && this.audio) {
              this.audio.volume = Math.max(0, originalVolume - (fadeStep * currentStep))
              currentStep++
              setTimeout(fadeOut, fadeOutInterval)
            } else {
              // 渐变结束后正式停止
              this.finalizeStop()
            }
          }

          fadeOut()
        } else {
          // 如果不是正在播放状态，直接停止
          this.finalizeStop()
        }
      } else {
        // 如果没有音频元素，直接停止
        this.finalizeStop()
      }
    } catch (error) {
      console.error('停止TTS播放时出错:', error)
      // 出错时仍然尝试停止
      this.finalizeStop()
    }
  }

  /**
   * 完成停止播放的操作
   * 这是内部方法，由stop()调用
   */
  private finalizeStop(): void {
    console.log('执行最终停止TTS播放操作')

    // 停止浏览器的Web Speech API播放
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel()
        // 清除所有排队的语音
        window.speechSynthesis.cancel()
      } catch (e) {
        console.error('停止Web Speech API时出错:', e)
      }
    }

    // 停止音频元素的播放
    if (this.audio) {
      try {
        // 移除所有事件监听器
        this.audio.onended = null
        this.audio.oncanplay = null
        this.audio.onerror = null

        // 停止播放
        this.audio.pause()
        this.audio.currentTime = 0

        // 释放资源
        const oldSrc = this.audio.src
        this.audio.src = ''
        this.audio.load() // 强制释放资源

        // 尝试释放BlobURL
        if (oldSrc && oldSrc.startsWith('blob:')) {
          try {
            URL.revokeObjectURL(oldSrc)
          } catch (e) {
            console.error('释放BlobURL时出错:', e)
          }
        }

        this.audio = null
      } catch (e) {
        console.error('停止音频元素时出错:', e)
        // 确保即使出错也重置状态
        this.audio = null
      }
    }

    // 重置播放状态
    this.isPlaying = false

    // 清除加载提示
    window.message.destroy('tts-loading')
  }

  /**
   * 检查是否正在播放
   */
  isCurrentlyPlaying = (): boolean => {
    return this.isPlaying
  }
}

// 导出单例
export default new TTSService()
