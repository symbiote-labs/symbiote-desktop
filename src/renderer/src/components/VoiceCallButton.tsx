import React, { useState } from 'react';
import { Button, Tooltip } from 'antd';
import { PhoneOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { VoiceCallService } from '../services/VoiceCallService';
import DraggableVoiceCallWindow from './DraggableVoiceCallWindow';
import { setIsVoiceCallActive, setLastPlayedMessageId, setSkipNextAutoTTS } from '../store/settings';

interface Props {
  disabled?: boolean;
  style?: React.CSSProperties;
}

const VoiceCallButton: React.FC<Props> = ({ disabled = false, style }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [isWindowVisible, setIsWindowVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [windowPosition, setWindowPosition] = useState({ x: 20, y: 20 });

  const handleClick = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      // 初始化语音服务
      await VoiceCallService.initialize();
      setIsWindowVisible(true);
      dispatch(setIsVoiceCallActive(true));
      // 重置最后播放的消息ID，确保不会自动播放已有消息
      dispatch(setLastPlayedMessageId(null));
      // 设置跳过下一次自动TTS，确保打开窗口时不会自动播放最后一条消息
      dispatch(setSkipNextAutoTTS(true));
    } catch (error) {
      console.error('Failed to initialize voice call:', error);
      window.message.error(t('voice_call.initialization_failed'));
    } finally {
      setIsLoading(false);
    }
  };

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
      <DraggableVoiceCallWindow
        visible={isWindowVisible}
        onClose={() => {
          setIsWindowVisible(false);
          dispatch(setIsVoiceCallActive(false));
        }}
        position={windowPosition}
        onPositionChange={setWindowPosition}
      />
    </>
  );
};

export default VoiceCallButton;
