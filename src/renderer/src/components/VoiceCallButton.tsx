import { LoadingOutlined, PhoneOutlined } from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { VoiceCallService } from '../services/VoiceCallService'
import VoiceCallModal from './VoiceCallModal'

interface Props {
  disabled?: boolean
  style?: React.CSSProperties
}

const VoiceCallButton: React.FC<Props> = ({ disabled = false, style }) => {
  const { t } = useTranslation()
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (disabled || isLoading) return

    setIsLoading(true)
    try {
      // 初始化语音服务
      await VoiceCallService.initialize()
      setIsModalVisible(true)
    } catch (error) {
      console.error('Failed to initialize voice call:', error)
      window.message.error(t('voice_call.initialization_failed'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Tooltip title={t('voice_call.start')}>
        <Button
          type="text"
          icon={isLoading ? <LoadingOutlined /> : <PhoneOutlined />}
          onClick={handleClick}
          disabled={disabled || isLoading}
          style={style}
        />
      </Tooltip>
      {isModalVisible && <VoiceCallModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} />}
    </>
  )
}

export default VoiceCallButton
