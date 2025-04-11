import {
  AudioMutedOutlined,
  AudioOutlined,
  CloseOutlined,
  DragOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SoundOutlined
} from '@ant-design/icons'
import { Button, Space, Tooltip } from 'antd'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { Action } from 'redux'
import styled from 'styled-components'

import { VoiceCallService } from '../services/VoiceCallService'
import { setIsVoiceCallActive, setLastPlayedMessageId, setSkipNextAutoTTS } from '../store/settings'
import VoiceVisualizer from './VoiceVisualizer'

// 节流函数，限制函数调用频率

function throttle<T extends (...args: any[]) => any>(func: T, delay: number): (...args: Parameters<T>) => void {
  let lastCall = 0
  return (...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= delay) {
      lastCall = now
      func(...args)
    }
  }
}

interface Props {
  visible: boolean
  onClose: () => void
  position?: { x: number; y: number }
  onPositionChange?: (position: { x: number; y: number }) => void
}

const DraggableVoiceCallWindow: React.FC<Props> = ({
  visible,
  onClose,
  position = { x: 20, y: 20 },
  onPositionChange
}) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const [isDragging, setIsDragging] = useState(false)
  const [currentPosition, setCurrentPosition] = useState(position)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // 语音通话状态
  const [transcript, setTranscript] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedOnClose = useCallback(() => {
    onClose();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedDispatch = useCallback((action: Action) => {
    dispatch(action);
  }, []);

  useEffect(() => {
    const startVoiceCall = async () => {
      try {
        // 显示加载中提示
        window.message.loading({ content: t('voice_call.initializing'), key: 'voice-call-init' })

        // 预先初始化语音识别服务
        try {
          await VoiceCallService.initialize()
        } catch (initError) {
          console.warn('语音识别服务初始化警告:', initError)
          // 不抛出异常，允许程序继续运行
        }

        // 启动语音通话
        await VoiceCallService.startCall({
          onTranscript: (text) => setTranscript(text),
          onResponse: () => {
            // 这里不设置response，因为响应会显示在聊天界面中
          },
          onListeningStateChange: setIsListening,
          onSpeakingStateChange: setIsSpeaking
        })

        // 关闭加载中提示
        window.message.success({ content: t('voice_call.ready'), key: 'voice-call-init' })
      } catch (error) {
        console.error('Voice call error:', error)
        window.message.error({ content: t('voice_call.error'), key: 'voice-call-init' })
        memoizedOnClose()
      }
    }

    // 添加TTS状态变化事件监听器
    const handleTTSStateChange = (event: CustomEvent) => {
      const { isPlaying } = event.detail
      console.log('TTS状态变化事件:', isPlaying)
      setIsSpeaking(isPlaying)
    }

    if (visible) {
      // 更新语音通话窗口状态
      memoizedDispatch(setIsVoiceCallActive(true))
      // 重置最后播放的消息ID，确保不会自动播放已有消息
      memoizedDispatch(setLastPlayedMessageId(null))
      // 设置跳过下一次自动TTS，确保打开窗口时不会自动播放最后一条消息
      memoizedDispatch(setSkipNextAutoTTS(true))
      startVoiceCall()
      // 添加事件监听器
      window.addEventListener('tts-state-change', handleTTSStateChange as EventListener)
    }

    return () => {
      // 更新语音通话窗口状态
      memoizedDispatch(setIsVoiceCallActive(false))
      VoiceCallService.endCall()
      // 移除事件监听器
      window.removeEventListener('tts-state-change', handleTTSStateChange as EventListener)
    }
  // 使用 memoizedOnClose 和 memoizedDispatch 代替原始的 onClose 和 dispatch
  }, [visible, t, memoizedDispatch, memoizedOnClose])

  // 拖拽相关处理
  const handleDragStart = (e: React.MouseEvent) => {
    if (containerRef.current) {
      e.preventDefault() // 防止默认行为
      e.stopPropagation() // 阻止事件冒泡

      // 直接使用鼠标相对于屏幕的位置和窗口相对于屏幕的位置计算偏移
      setIsDragging(true)

      // 记录鼠标相对于窗口左上角的偏移量
      setDragOffset({
        x: e.clientX - currentPosition.x,
        y: e.clientY - currentPosition.y
      })

      // 在开发环境下只输出一次关键日志
      if (process.env.NODE_ENV === 'development') {
        console.log('开始拖拽 - 偏移量:', { x: e.clientX - currentPosition.x, y: e.clientY - currentPosition.y })
      }
    }
  }

  // 使用useCallback包装并优化handleDrag函数
  const handleDragBase = useCallback(
    (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        // 限制拖拽范围，防止窗口被拖出屏幕
        const windowWidth = window.innerWidth
        const windowHeight = window.innerHeight
        const containerWidth = containerRef.current.offsetWidth
        const containerHeight = containerRef.current.offsetHeight

        // 计算新位置，确保窗口不会被拖出屏幕
        // 使用鼠标当前位置减去偏移量，得到窗口应该在的位置
        const newX = Math.min(Math.max(0, e.clientX - dragOffset.x), windowWidth - containerWidth)
        const newY = Math.min(Math.max(0, e.clientY - dragOffset.y), windowHeight - containerHeight)

        const newPosition = { x: newX, y: newY }

        // 完全关闭拖拽中的日志输出
        // 如果需要调试，可以在这里添加日志代码

        // 立即更新窗口位置，提高响应速度
        containerRef.current.style.left = `${newX}px`
        containerRef.current.style.top = `${newY}px`

        // 更新状态
        setCurrentPosition(newPosition)
        onPositionChange?.(newPosition)
      }
    },
    [isDragging, dragOffset, onPositionChange]
  )

  // 使用useMemo包装节流函数，避免重复创建
  const handleDrag = useMemo(() => throttle(handleDragBase, 16), [handleDragBase]) // 16ms 大约相当于 60fps

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    // 完全关闭拖拽结束的日志输出
  }, [])

  // 添加键盘快捷键支持
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // 防止箭头键滚动页面
        e.preventDefault()

        // 移动步长
        const step = e.shiftKey ? 10 : 5

        // 根据按键移动窗口
        let newX = currentPosition.x
        let newY = currentPosition.y

        if (e.key === 'ArrowUp') newY -= step
        if (e.key === 'ArrowDown') newY += step
        if (e.key === 'ArrowLeft') newX -= step
        if (e.key === 'ArrowRight') newX += step

        // 限制范围
        if (containerRef.current) {
          const windowWidth = window.innerWidth
          const windowHeight = window.innerHeight
          const containerWidth = containerRef.current.offsetWidth
          const containerHeight = containerRef.current.offsetHeight

          newX = Math.min(Math.max(0, newX), windowWidth - containerWidth)
          newY = Math.min(Math.max(0, newY), windowHeight - containerHeight)
        }

        const newPosition = { x: newX, y: newY }
        setCurrentPosition(newPosition)
        onPositionChange?.(newPosition)
      }
    },
    [currentPosition, onClose, onPositionChange]
  )

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag)
      document.addEventListener('mouseup', handleDragEnd)
    }
    return () => {
      document.removeEventListener('mousemove', handleDrag)
      document.removeEventListener('mouseup', handleDragEnd)
    }
  }, [isDragging, handleDrag, handleDragEnd])

  // 添加键盘事件监听
  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [visible, handleKeyDown])

  // 语音通话相关处理
  const toggleMute = () => {
    setIsMuted(!isMuted)
    VoiceCallService.setMuted(!isMuted)
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

    // 先清除之前的语音识别结果
    setTranscript('')

    // 无论是否正在播放，都强制停止TTS
    VoiceCallService.stopTTS()
    setIsSpeaking(false)

    // 更新UI状态
    setIsRecording(true)
    setIsProcessing(true) // 设置处理状态，防止重复点击

    // 开始录音
    try {
      await VoiceCallService.startRecording()
      console.log('开始录音')
      setIsProcessing(false) // 录音开始后取消处理状态
    } catch (error) {
      console.error('开始录音出错:', error)
      window.message.error({ content: '启动语音识别失败，请确保语音识别服务已启动', key: 'voice-call-error' })
      setIsRecording(false)
      setIsProcessing(false)
    }
  }

  const handleRecordEnd = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault() // 防止触摸事件的默认行为

    if (!isRecording) return

    // 立即更新UI状态
    setIsRecording(false)
    setIsProcessing(true)

    // 无论是否正在播放，都强制停止TTS
    VoiceCallService.stopTTS()
    setIsSpeaking(false)

    // 确保录音完全停止
    try {
      // 传递 true 参数，表示将结果发送到聊天界面
      const success = await VoiceCallService.stopRecordingAndSendToChat()
      console.log('录音已停止，结果已发送到聊天界面', success ? '成功' : '失败')

      if (success) {
        // 显示成功消息
        window.message.success({ content: '语音识别已完成，正在发送消息...', key: 'voice-call-send' })
      } else {
        // 显示失败消息
        window.message.error({ content: '发送语音识别结果失败', key: 'voice-call-error' })
      }
    } catch (error) {
      console.error('停止录音出错:', error)
      window.message.error({ content: '停止录音出错', key: 'voice-call-error' })
    } finally {
      // 无论成功与否，都确保在一定时间后重置处理状态
      setTimeout(() => {
        setIsProcessing(false)
      }, 1000) // 增加延迟时间，确保有足够时间处理结果
    }
  }

  // 处理鼠标/触摸离开按钮的情况
  const handleRecordCancel = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()

    if (isRecording) {
      // 立即更新UI状态
      setIsRecording(false)
      setIsProcessing(true)

      // 无论是否正在播放，都强制停止TTS
      VoiceCallService.stopTTS()
      setIsSpeaking(false)

      // 取消录音，不发送给AI
      try {
        await VoiceCallService.cancelRecording()
        console.log('录音已取消')

        // 清除输入文本
        setTranscript('')
      } catch (error) {
        console.error('取消录音出错:', error)
      } finally {
        // 无论成功与否，都确保在一定时间后重置处理状态
        setTimeout(() => {
          setIsProcessing(false)
        }, 1000)
      }
    }
  }

  if (!visible) return null

  return (
    <Container
      ref={containerRef}
      style={{
        left: `${currentPosition.x}px`,
        top: `${currentPosition.y}px`,
        position: 'fixed',
        zIndex: 1000,
        transform: 'translate3d(0,0,0)', // 启用GPU加速，提高拖拽流畅度
        willChange: 'left, top' // 提示浏览器这些属性将会变化，优化渲染
      }}>
      <Header onMouseDown={handleDragStart}>
        <DragOutlined style={{ cursor: 'move', marginRight: 8 }} />
        {t('voice_call.title')}
        <CloseButton onClick={onClose}>
          <CloseOutlined />
        </CloseButton>
      </Header>

      <Content>
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
          </Space>
        </ControlsContainer>
      </Content>
    </Container>
  )
}

// 样式组件
const Container = styled.div`
  width: 300px;
  background-color: var(--color-background);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
`

const Header = styled.div`
  padding: 8px 12px;
  background-color: var(--color-primary);
  color: white;
  font-weight: bold;
  display: flex;
  align-items: center;
  cursor: move;
`

const CloseButton = styled.div`
  margin-left: auto;
  cursor: pointer;
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
`

const VisualizerContainer = styled.div`
  display: flex;
  justify-content: space-between;
  height: 60px;
`

const TranscriptContainer = styled.div`
  flex: 1;
  min-height: 60px;
  max-height: 100px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px;
  background-color: var(--color-background-2);
`

const TranscriptText = styled.div`
  margin-bottom: 8px;
`

const UserLabel = styled.span`
  font-weight: bold;
  color: var(--color-primary);
`

const ControlsContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 8px 0;
`

const RecordButton = styled(Button)`
  min-width: 120px;
`

export default DraggableVoiceCallWindow
