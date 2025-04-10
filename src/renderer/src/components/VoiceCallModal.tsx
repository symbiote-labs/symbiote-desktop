import {
  AudioMutedOutlined,
  AudioOutlined,
  CloseOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SoundOutlined
} from '@ant-design/icons'
import { Button, Modal, Space, Tooltip } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { VoiceCallService } from '../services/VoiceCallService'
import VoiceVisualizer from './VoiceVisualizer'

interface Props {
  visible: boolean
  onClose: () => void
}

const VoiceCallModal: React.FC<Props> = ({ visible, onClose }) => {
  const { t } = useTranslation()
  const [isMuted, setIsMuted] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClose = useCallback(() => {
    VoiceCallService.endCall()
    onClose()
  }, [onClose])

  useEffect(() => {
    const startVoiceCall = async () => {
      try {
        await VoiceCallService.startCall({
          onTranscript: (text: string) => setTranscript(text),
          onResponse: (text: string) => setResponse(text),
          onListeningStateChange: setIsListening,
          onSpeakingStateChange: setIsSpeaking
        })
      } catch (error) {
        console.error('Voice call error:', error)
        window.message.error(t('voice_call.error'))
        handleClose()
      }
    }

    if (visible) {
      startVoiceCall()
    }

    return () => {
      VoiceCallService.endCall()
    }
  }, [visible, t, handleClose])

  const toggleMute = () => {
    const newMuteState = !isMuted
    setIsMuted(newMuteState)
    VoiceCallService.setMuted(newMuteState)
  }

  const togglePause = () => {
    const newPauseState = !isPaused
    setIsPaused(newPauseState)
    VoiceCallService.setPaused(newPauseState)
  }

  // 长按说话相关处理
  const handleRecordStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault() // 防止触摸事件的默认行为

    if (isProcessing || isPaused) return

    setIsRecording(true)
    await VoiceCallService.startRecording()
  }

  const handleRecordEnd = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault() // 防止触摸事件的默认行为

    if (!isRecording) return

    // 立即更新UI状态
    setIsRecording(false)
    setIsProcessing(true)

    // 确保录音完全停止
    try {
      await VoiceCallService.stopRecording()
      console.log('录音已停止')
    } catch (error) {
      console.error('停止录音出错:', error)
    }

    // 处理结果会通过回调函数返回，不需要在这里处理
    setTimeout(() => {
      setIsProcessing(false)
    }, 500) // 添加短暂延迟，防止用户立即再次点击
  }

  // 处理鼠标/触摸离开按钮的情况
  const handleRecordCancel = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()

    if (isRecording) {
      // 立即更新UI状态
      setIsRecording(false)
      setIsProcessing(true)

      // 取消录音，不发送给AI
      try {
        await VoiceCallService.cancelRecording()
        console.log('录音已取消')
      } catch (error) {
        console.error('取消录音出错:', error)
      }

      setTimeout(() => {
        setIsProcessing(false)
      }, 500)
    }
  }

  return (
    <Modal
      title={t('voice_call.title')}
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={500}
      centered
      maskClosable={false}>
      <Container>
        <VisualizerContainer>
          <VoiceVisualizer isActive={isListening || isRecording} type="input" />
          <VoiceVisualizer isActive={isSpeaking} type="output" />
        </VisualizerContainer>

        <TranscriptContainer>
          {transcript && (
            <TranscriptText>
              <UserLabel>{t('voice_call.you')}:</UserLabel> {transcript}
            </TranscriptText>
          )}
          {response && (
            <ResponseText>
              <AILabel>{t('voice_call.ai')}:</AILabel> {response}
            </ResponseText>
          )}
        </TranscriptContainer>

        <ControlsContainer>
          <Space>
            <Button
              type="text"
              icon={isMuted ? <AudioMutedOutlined /> : <AudioOutlined />}
              onClick={toggleMute}
              size="large"
              title={isMuted ? t('voice_call.unmute') : t('voice_call.mute')}
            />
            <Button
              type="text"
              icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={togglePause}
              size="large"
              title={isPaused ? t('voice_call.resume') : t('voice_call.pause')}
            />
            <Tooltip title={t('voice_call.press_to_talk')}>
              <RecordButton
                type={isRecording ? 'primary' : 'default'}
                icon={<SoundOutlined />}
                onMouseDown={handleRecordStart}
                onMouseUp={handleRecordEnd}
                onMouseLeave={handleRecordCancel}
                onTouchStart={handleRecordStart}
                onTouchEnd={handleRecordEnd}
                onTouchCancel={handleRecordCancel}
                size="large"
                disabled={isProcessing || isPaused}>
                {isRecording ? t('voice_call.release_to_send') : t('voice_call.press_to_talk')}
              </RecordButton>
            </Tooltip>
            <Button
              type="primary"
              icon={<CloseOutlined />}
              onClick={handleClose}
              danger
              size="large"
              title={t('voice_call.end')}
            />
          </Space>
        </ControlsContainer>
      </Container>
    </Modal>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 400px;
`

const VisualizerContainer = styled.div`
  display: flex;
  justify-content: space-between;
  height: 100px;
`

const TranscriptContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  background-color: var(--color-background-2);
`

const TranscriptText = styled.p`
  margin-bottom: 8px;
  color: var(--color-text-1);
`

const ResponseText = styled.p`
  margin-bottom: 8px;
  color: var(--color-primary);
`

const UserLabel = styled.span`
  font-weight: bold;
  color: var(--color-text-1);
`

const AILabel = styled.span`
  font-weight: bold;
  color: var(--color-primary);
`

const ControlsContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 10px 0;
`

const RecordButton = styled(Button)`
  min-width: 150px;
  transition: all 0.2s;

  &:active {
    transform: scale(0.95);
  }
`

export default VoiceCallModal
