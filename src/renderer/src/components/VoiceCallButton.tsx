import React, { useState } from 'react';
import { Button, Tooltip } from 'antd';
import { PhoneOutlined, LoadingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { VoiceCallService } from '../services/VoiceCallService';
import DraggableVoiceCallWindow from './DraggableVoiceCallWindow';

interface Props {
  disabled?: boolean;
  style?: React.CSSProperties;
}

const VoiceCallButton: React.FC<Props> = ({ disabled = false, style }) => {
  const { t } = useTranslation();
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
        onClose={() => setIsWindowVisible(false)}
        position={windowPosition}
        onPositionChange={setWindowPosition}
      />
    </>
  );
};

export default VoiceCallButton;
