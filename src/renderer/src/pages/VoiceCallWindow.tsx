import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { Button, Space, Tooltip } from 'antd';
import {
  AudioMutedOutlined,
  AudioOutlined,
  CloseOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SoundOutlined
} from '@ant-design/icons';
import { VoiceCallService } from '../services/VoiceCallService';
import VoiceVisualizer from '../components/VoiceVisualizer';
import { setIsVoiceCallActive, setLastPlayedMessageId, setSkipNextAutoTTS } from '../store/settings';

/**
 * 独立窗口的语音通话组件
 * 这个组件用于在独立窗口中显示语音通话界面
 */
const VoiceCallWindow: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  
  // 语音通话状态
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const startVoiceCall = async () => {
      try {
        // 显示加载中提示
        window.message.loading({ content: t('voice_call.initializing'), key: 'voice-call-init' });

        // 预先初始化语音识别服务
        try {
          await VoiceCallService.initialize();
        } catch (initError) {
          console.warn('语音识别服务初始化警告:', initError);
          // 不抛出异常，允许程序继续运行
        }

        // 启动语音通话
        await VoiceCallService.startCall({
          onTranscript: (text) => setTranscript(text),
          onResponse: (_) => {
            // 这里不设置response，因为响应会显示在聊天界面中
          },
          onListeningStateChange: setIsListening,
          onSpeakingStateChange: setIsSpeaking,
        });

        // 关闭加载中提示
        window.message.success({ content: t('voice_call.ready'), key: 'voice-call-init' });
      } catch (error) {
        console.error('Voice call error:', error);
        window.message.error({ content: t('voice_call.error'), key: 'voice-call-init' });
        handleClose();
      }
    };

    // 添加TTS状态变化事件监听器
    const handleTTSStateChange = (event: CustomEvent) => {
      const { isPlaying } = event.detail;
      console.log('TTS状态变化事件:', isPlaying);
      setIsSpeaking(isPlaying);
    };

    // 更新语音通话窗口状态
    dispatch(setIsVoiceCallActive(true));
    // 重置最后播放的消息ID，确保不会自动播放已有消息
    dispatch(setLastPlayedMessageId(null));
    // 设置跳过下一次自动TTS，确保打开窗口时不会自动播放最后一条消息
    dispatch(setSkipNextAutoTTS(true));
    
    startVoiceCall();
    // 添加事件监听器
    window.addEventListener('tts-state-change', handleTTSStateChange as EventListener);

    return () => {
      // 更新语音通话窗口状态
      dispatch(setIsVoiceCallActive(false));
      VoiceCallService.endCall();
      // 移除事件监听器
      window.removeEventListener('tts-state-change', handleTTSStateChange as EventListener);
    };
  }, [t, dispatch]);

  // 语音通话相关处理
  const toggleMute = () => {
    setIsMuted(!isMuted);
    VoiceCallService.setMuted(!isMuted);
  };

  const togglePause = () => {
    const newPauseState = !isPaused;
    setIsPaused(newPauseState);
    VoiceCallService.setPaused(newPauseState);
  };

  // 关闭窗口
  const handleClose = () => {
    window.close();
  };

  // 长按说话相关处理
  const handleRecordStart = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // 防止触摸事件的默认行为

    if (isProcessing || isPaused) return;

    // 先清除之前的语音识别结果
    setTranscript('');

    // 无论是否正在播放，都强制停止TTS
    VoiceCallService.stopTTS();
    setIsSpeaking(false);

    // 更新UI状态
    setIsRecording(true);
    setIsProcessing(true); // 设置处理状态，防止重复点击

    // 开始录音
    try {
      await VoiceCallService.startRecording();
      console.log('开始录音');
      setIsProcessing(false); // 录音开始后取消处理状态
    } catch (error) {
      console.error('开始录音出错:', error);
      window.message.error({ content: '启动语音识别失败，请确保语音识别服务已启动', key: 'voice-call-error' });
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const handleRecordEnd = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // 防止触摸事件的默认行为

    if (!isRecording) return;

    // 立即更新UI状态
    setIsRecording(false);
    setIsProcessing(true);

    // 无论是否正在播放，都强制停止TTS
    VoiceCallService.stopTTS();
    setIsSpeaking(false);

    // 确保录音完全停止
    try {
      // 传递 true 参数，表示将结果发送到聊天界面
      const success = await VoiceCallService.stopRecordingAndSendToChat();
      console.log('录音已停止，结果已发送到聊天界面', success ? '成功' : '失败');

      if (success) {
        // 显示成功消息
        window.message.success({ content: '语音识别已完成，正在发送消息...', key: 'voice-call-send' });
      } else {
        // 显示失败消息
        window.message.error({ content: '发送语音识别结果失败', key: 'voice-call-error' });
      }
    } catch (error) {
      console.error('停止录音出错:', error);
      window.message.error({ content: '停止录音出错', key: 'voice-call-error' });
    } finally {
      // 无论成功与否，都确保在一定时间后重置处理状态
      setTimeout(() => {
        setIsProcessing(false);
      }, 1000); // 增加延迟时间，确保有足够时间处理结果
    }
  };

  // 处理鼠标/触摸离开按钮的情况
  const handleRecordCancel = async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    if (isRecording) {
      // 立即更新UI状态
      setIsRecording(false);
      setIsProcessing(true);

      // 无论是否正在播放，都强制停止TTS
      VoiceCallService.stopTTS();
      setIsSpeaking(false);

      // 取消录音，不发送给AI
      try {
        await VoiceCallService.cancelRecording();
        console.log('录音已取消');

        // 清除输入文本
        setTranscript('');
      } catch (error) {
        console.error('取消录音出错:', error);
      } finally {
        // 无论成功与否，都确保在一定时间后重置处理状态
        setTimeout(() => {
          setIsProcessing(false);
        }, 1000);
      }
    }
  };

  return (
    <Container>
      <Header>
        <Title>{t('voice_call.title')}</Title>
        <CloseButton onClick={handleClose}>
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
                type={isRecording ? "primary" : "default"}
                icon={<SoundOutlined />}
                onMouseDown={handleRecordStart}
                onMouseUp={handleRecordEnd}
                onMouseLeave={handleRecordCancel}
                onTouchStart={handleRecordStart}
                onTouchEnd={handleRecordEnd}
                onTouchCancel={handleRecordCancel}
                size="large"
                disabled={isProcessing || isPaused}
              >
                {isRecording ? t('voice_call.release_to_send') : t('voice_call.press_to_talk')}
              </RecordButton>
            </Tooltip>
          </Space>
        </ControlsContainer>
      </Content>
    </Container>
  );
};

// 样式组件
const Container = styled.div`
  width: 100%;
  height: 100vh;
  background-color: var(--color-background);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 12px 16px;
  background-color: var(--color-primary);
  color: white;
  font-weight: bold;
  display: flex;
  align-items: center;
`;

const Title = styled.div`
  flex: 1;
  font-size: 16px;
`;

const CloseButton = styled.div`
  cursor: pointer;
`;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  flex: 1;
  overflow: hidden;
`;

const VisualizerContainer = styled.div`
  display: flex;
  justify-content: space-between;
  height: 100px;
`;

const TranscriptContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 16px;
  background-color: var(--color-background-2);
`;

const TranscriptText = styled.div`
  margin-bottom: 8px;
`;

const UserLabel = styled.span`
  font-weight: bold;
  color: var(--color-primary);
`;

const ControlsContainer = styled.div`
  display: flex;
  justify-content: center;
  padding: 16px 0;
`;

const RecordButton = styled(Button)`
  min-width: 120px;
`;

export default VoiceCallWindow;
