import { SoundOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import TTSService from '@renderer/services/TTSService'
import { Message } from '@renderer/types'

interface TTSButtonProps {
  message: Message
  className?: string
}

const TTSButton: React.FC<TTSButtonProps> = ({ message, className }) => {
  const { t } = useTranslation()
  const [isSpeaking, setIsSpeaking] = useState(false)

  const handleTTS = useCallback(async () => {
    if (isSpeaking) {
      TTSService.stop()
      setIsSpeaking(false)
      return
    }

    setIsSpeaking(true)
    try {
      await TTSService.speakFromMessage(message)
      
      // 监听播放结束
      const checkPlayingStatus = () => {
        if (!TTSService.isCurrentlyPlaying()) {
          setIsSpeaking(false)
          clearInterval(checkInterval)
        }
      }
      
      const checkInterval = setInterval(checkPlayingStatus, 500)
      
      // 安全机制，确保即使出错也会重置状态
      setTimeout(() => {
        if (isSpeaking) {
          TTSService.stop()
          setIsSpeaking(false)
          clearInterval(checkInterval)
        }
      }, 30000) // 30秒后检查
    } catch (error) {
      console.error('TTS error:', error)
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
