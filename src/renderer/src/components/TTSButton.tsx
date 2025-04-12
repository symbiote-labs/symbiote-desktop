import { SoundOutlined } from '@ant-design/icons'
import TTSService from '@renderer/services/TTSService'
import { Message } from '@renderer/types'
import { Button, Tooltip } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface TTSButtonProps {
  message: Message
  className?: string
}

const TTSButton: React.FC<TTSButtonProps> = ({ message, className }) => {
  const { t } = useTranslation()
  const [isSpeaking, setIsSpeaking] = useState(false)

  // 添加TTS状态变化事件监听器
  useEffect(() => {
    const handleTTSStateChange = (event: CustomEvent) => {
      const { isPlaying } = event.detail
      console.log('TTS按钮检测到TTS状态变化:', isPlaying)
      setIsSpeaking(isPlaying)
    }

    // 添加事件监听器
    window.addEventListener('tts-state-change', handleTTSStateChange as EventListener)

    // 组件卸载时移除事件监听器
    return () => {
      window.removeEventListener('tts-state-change', handleTTSStateChange as EventListener)
    }
  }, [])

  // 初始化时检查TTS状态
  useEffect(() => {
    // 检查当前是否正在播放
    const isCurrentlyPlaying = TTSService.isCurrentlyPlaying()
    if (isCurrentlyPlaying !== isSpeaking) {
      setIsSpeaking(isCurrentlyPlaying)
    }
  }, [])

  const handleTTS = useCallback(async () => {
    if (isSpeaking) {
      TTSService.stop()
      return // 不需要手动设置状态，事件监听器会处理
    }

    try {
      console.log('点击TTS按钮，开始播放消息')
      await TTSService.speakFromMessage(message)
      // 不需要手动设置状态，事件监听器会处理
    } catch (error) {
      console.error('TTS error:', error)
      // 出错时才需要手动重置状态
      setIsSpeaking(false)
    }
  }, [isSpeaking, message])

  return (
    <Tooltip title={isSpeaking ? t('chat.tts.stop') : t('chat.tts.play')}>
      <Button
        className={className}
        icon={<SoundOutlined />}
        onClick={handleTTS}
        type={isSpeaking ? 'primary' : 'default'}
      />
    </Tooltip>
  )
}

export default TTSButton
