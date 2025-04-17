import TTSProgressBar from '@renderer/components/TTSProgressBar';
import { FONT_FAMILY } from '@renderer/config/constant';
import { useAssistant } from '@renderer/hooks/useAssistant';
import { useModel } from '@renderer/hooks/useModel';
import { useRuntime } from '@renderer/hooks/useRuntime';
import { useMessageStyle, useSettings } from '@renderer/hooks/useSettings';
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService';
import { getMessageModelId } from '@renderer/services/MessagesService';
import { getModelUniqId } from '@renderer/services/ModelService';
import TTSService from '@renderer/services/TTSService';
import { useAppDispatch, useAppSelector } from '@renderer/store';
import { setLastPlayedMessageId, setSkipNextAutoTTS } from '@renderer/store/settings';
import { Assistant, Message, Topic } from '@renderer/types';
import { classNames } from '@renderer/utils';
import { Divider, Dropdown } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import { Dispatch, FC, memo, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
// import { useSelector } from 'react-redux'; // Removed unused import
import styled from 'styled-components'; // Ensure styled-components is imported

import MessageContent from './MessageContent';
import MessageErrorBoundary from './MessageErrorBoundary';
import MessageHeader from './MessageHeader';
import MessageMenubar from './MessageMenubar';
import MessageTokens from './MessageTokens';

interface Props {
  message: Message;
  topic: Topic;
  assistant?: Assistant;
  index?: number;
  total?: number;
  hidePresetMessages?: boolean;
  style?: React.CSSProperties;
  isGrouped?: boolean;
  isStreaming?: boolean;
  onSetMessages?: Dispatch<SetStateAction<Message[]>>;
}

// Function definition moved before its first use, fixing potential TS issue & improving readability
// FIX 1: Added explicit else to satisfy TS7030
const getMessageBackground = (isBubbleStyle: boolean, isAssistantMessage: boolean): string | undefined => {
  if (!isBubbleStyle) {
    return undefined;
  } else { // Explicit else block
    return isAssistantMessage ? 'var(--chat-background-assistant)' : 'var(--chat-background-user)';
  }
};

// FIX 2: Define styled component for the context menu trigger div
const ContextMenuTriggerDiv = styled.div<{ x: number; y: number }>`
  position: fixed;
  left: ${({ x }) => x}px;
  top: ${({ y }) => y}px;
  width: 1px;
  height: 1px;
  /* Optional: Ensure it doesn't interfere with other elements */
  z-index: -1;
  pointer-events: none;
`;


const MessageItem: FC<Props> = ({
  message,
  topic,
  // assistant: propAssistant,
  index,
  hidePresetMessages,
  isGrouped,
  isStreaming = false,
  style
}) => {
  const { t } = useTranslation();
  const { assistant, setModel } = useAssistant(message.assistantId);
  const model = useModel(getMessageModelId(message), message.model?.provider) || message.model;
  const { isBubbleStyle } = useMessageStyle();
  const { showMessageDivider, messageFont, fontSize } = useSettings();
  const { generating } = useRuntime();
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedQuoteText, setSelectedQuoteText] = useState<string>('');
  const [selectedText, setSelectedText] = useState<string>('');
  const dispatch = useAppDispatch();

  // --- Consolidated State Selection ---
  const ttsEnabled = useAppSelector((state) => state.settings.ttsEnabled);
  const voiceCallEnabled = useAppSelector((state) => state.settings.voiceCallEnabled);
  const autoPlayTTSOutsideVoiceCall = useAppSelector((state) => state.settings.autoPlayTTSOutsideVoiceCall);
  const isVoiceCallActive = useAppSelector((state) => state.settings.isVoiceCallActive);
  const lastPlayedMessageId = useAppSelector((state) => state.settings.lastPlayedMessageId);
  const skipNextAutoTTS = useAppSelector((state) => state.settings.skipNextAutoTTS);
  // ---------------------------------

  const isLastMessage = index === 0;
  const isAssistantMessage = message.role === 'assistant';
  const showMenubar = !isStreaming && !message.status.includes('ing');

  const fontFamily = useMemo(() => {
    return messageFont === 'serif' ? FONT_FAMILY.replace('sans-serif', 'serif').replace('Ubuntu, ', '') : FONT_FAMILY;
  }, [messageFont]);

  const messageBorder = showMessageDivider ? '1px dotted var(--color-border)' : 'none'; // Applied directly in MessageFooter style
  const messageBackground = getMessageBackground(isBubbleStyle, isAssistantMessage); // Call the fixed function


  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const _selectedText = window.getSelection()?.toString() || '';
    setContextMenuPosition({ x: e.clientX, y: e.clientY });

    if (_selectedText) {
      const quotedText =
        _selectedText
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n') + '\n-------------';
      setSelectedQuoteText(quotedText);
      setSelectedText(_selectedText);
    } else {
      setSelectedQuoteText('');
      setSelectedText('');
    }
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => {
      setContextMenuPosition(null);
    };
    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // --- Reset skipNextAutoTTS on New Message Completion ---
  const prevGeneratingRef = useRef(generating);
  useEffect(() => {
    prevGeneratingRef.current = generating;
  }, [generating]);

  useEffect(() => {
    if (
      prevGeneratingRef.current &&
      !generating &&
      isLastMessage &&
      isAssistantMessage &&
      message.status === 'success'
    ) {
      // 简化日志输出
      console.log('消息生成完成，重置skipNextAutoTTS为false, 消息ID:', message.id);
      dispatch(setSkipNextAutoTTS(false));
    }
  }, [generating, isLastMessage, isAssistantMessage, message.status, message.id, dispatch]);


  // --- Auto-play TTS Logic ---
  useEffect(() => {
    // 基本条件检查
    if (!isLastMessage || !isAssistantMessage || message.status !== 'success' || generating) {
      return;
    }
    if (!ttsEnabled) {
      return;
    }

    // 语音通话相关条件检查
    if (voiceCallEnabled === false && autoPlayTTSOutsideVoiceCall === false) {
      // 简化日志输出
      console.log('不自动播放TTS: 语音通话功能未启用 + 不允许在语音通话模式外自动播放');
      return;
    }
    if (voiceCallEnabled === true && isVoiceCallActive === false && autoPlayTTSOutsideVoiceCall === false) {
      // 简化日志输出
      console.log('不自动播放TTS: 语音通话窗口未打开 + 不允许在语音通话模式外自动播放');
      return;
    }

    // 检查是否需要跳过自动TTS
    if (skipNextAutoTTS === true) {
      console.log('跳过自动TTS: skipNextAutoTTS = true, 消息ID:', message.id);
      return;
    }
    // 检查消息是否有内容，且消息是新的（不是上次播放过的消息）
    if (message.content && message.content.trim() && message.id !== lastPlayedMessageId) {
      // 简化日志输出
      console.log('准备自动播放TTS, 消息ID:', message.id);
      dispatch(setLastPlayedMessageId(message.id));
      const playTimeout = setTimeout(() => {
        console.log('自动播放TTS: 消息ID:', message.id);
        TTSService.speakFromMessage(message);
      }, 500);
      return () => clearTimeout(playTimeout);
    } else if (message.id === lastPlayedMessageId) {
      // 简化日志输出
      console.log('不自动播放TTS: 消息已播放过 (lastPlayedMessageId), ID:', message.id);
      return; // 添加返回语句，解决TypeScript错误
    }

    // 添加默认返回值，确保所有代码路径都有返回值
    return;
  }, [
    isLastMessage, isAssistantMessage, message, generating, ttsEnabled,
    voiceCallEnabled, autoPlayTTSOutsideVoiceCall, isVoiceCallActive,
    skipNextAutoTTS, lastPlayedMessageId, dispatch
  ]);

  // --- Highlight message on event ---
  const messageHighlightHandler = useCallback((highlight: boolean = true) => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      if (highlight) {
        const element = messageContainerRef.current;
        element.classList.add('message-highlight');
        setTimeout(() => {
          element?.classList.remove('message-highlight');
        }, 2500);
      }
    }
  }, []);

  useEffect(() => {
    const eventName = `${EVENT_NAMES.LOCATE_MESSAGE}:${message.id}`;
    const unsubscribe = EventEmitter.on(eventName, messageHighlightHandler);
    return () => unsubscribe();
  }, [message.id, messageHighlightHandler]);

  // --- Component Rendering ---

  if (hidePresetMessages && message.isPreset) {
    return null;
  }

  if (message.type === 'clear') {
    return (
      <NewContextMessage onClick={() => EventEmitter.emit(EVENT_NAMES.NEW_CONTEXT)}>
        <Divider dashed style={{ padding: '0 20px' }} plain>
          {t('chat.message.new.context')}
        </Divider>
      </NewContextMessage>
    );
  }

  return (
    <MessageContainer
      key={message.id}
      className={classNames({
        message: true,
        'message-assistant': isAssistantMessage,
        'message-user': !isAssistantMessage
      })}
      ref={messageContainerRef}
      onContextMenu={handleContextMenu}
      style={{ ...style, alignItems: isBubbleStyle ? (isAssistantMessage ? 'start' : 'end') : undefined }}>
      {contextMenuPosition && (
        <Dropdown
          overlayStyle={{ position: 'fixed', left: contextMenuPosition.x, top: contextMenuPosition.y, zIndex: 1000 }}
          menu={{ items: getContextMenuItems(t, selectedQuoteText, selectedText, message) }}
          open={true}
          trigger={['contextMenu']}
          >
          {/* FIX 2: Use the styled component instead of inline style */}
          <ContextMenuTriggerDiv x={contextMenuPosition.x} y={contextMenuPosition.y} />
        </Dropdown>
      )}
      <MessageHeader message={message} assistant={assistant} model={model} key={getModelUniqId(model)} />
      <MessageContentContainer
        className="message-content-container"
        style={{ fontFamily, fontSize, background: messageBackground }}>
        <MessageErrorBoundary>
          <MessageContent message={message} model={model} />
        </MessageErrorBoundary>
        {isAssistantMessage && (
          <ProgressBarWrapper>
            <TTSProgressBar messageId={message.id} />
          </ProgressBarWrapper>
        )}
        {showMenubar && (
          <MessageFooter
            style={{
              borderTop: messageBorder, // Apply border style here
              flexDirection: isBubbleStyle ? 'row-reverse' : undefined
            }}>
            <MessageTokens message={message} isLastMessage={isLastMessage} />
            <MessageMenubar
              message={message}
              assistant={assistant}
              model={model}
              index={index}
              topic={topic}
              isLastMessage={isLastMessage}
              isAssistantMessage={isAssistantMessage}
              isGrouped={isGrouped}
              messageContainerRef={messageContainerRef}
              setModel={setModel}
            />
          </MessageFooter>
        )}
      </MessageContentContainer>
    </MessageContainer>
  );
};


// Updated context menu items function
const getContextMenuItems = (
  t: (key: string) => string,
  selectedQuoteText: string,
  selectedText: string,
  message: Message,
): ItemType[] => {
  const items: ItemType[] = [];

  if (selectedText) {
    items.push({
      key: 'copy',
      label: t('common.copy'),
      onClick: () => {
        navigator.clipboard.writeText(selectedText)
          .then(() => window.message.success({ content: t('message.copied'), key: 'copy-message' }))
          .catch(err => console.error('Failed to copy text: ', err));
      }
    });
    items.push({
      key: 'quote',
      label: t('chat.message.quote'),
      onClick: () => {
        EventEmitter.emit(EVENT_NAMES.QUOTE_TEXT, selectedQuoteText);
      }
    });
    items.push({
      key: 'speak_selected',
      label: t('chat.message.speak_selection') || '朗读选中部分',
      onClick: () => {
        // 首先手动关闭菜单
        document.dispatchEvent(new MouseEvent('click'));

        // 使用setTimeout确保菜单关闭后再执行TTS功能
        setTimeout(() => {
          import('@renderer/services/TTSService').then(({ default: TTSServiceInstance }) => {
              let textToSpeak = selectedText;
              if (message.content) {
                  const startIndex = message.content.indexOf(selectedText);
                  if (startIndex !== -1) {
                      textToSpeak = selectedText; // Just speak selection
                  }
              }
              // 传递消息ID，确保进度条和停止按钮正常工作
              TTSServiceInstance.speak(textToSpeak, false, message.id); // 使用普通播放模式而非分段播放
          }).catch(err => console.error('Failed to load or use TTSService:', err));
        }, 100);
      }
    });
     items.push({ type: 'divider' });
  }

  items.push({
    key: 'copy_id',
    label: t('message.copy_id') || '复制消息ID',
    onClick: () => {
      navigator.clipboard.writeText(message.id)
        .then(() => window.message.success({ content: t('message.id_copied') || '消息ID已复制', key: 'copy-message-id' }))
        .catch(err => console.error('Failed to copy message ID: ', err));
    }
  });

  return items;
};


// Styled components definitions
const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  transition: background-color 0.3s ease;
  padding: 0 20px;
  transform: translateZ(0);
  will-change: transform, background-color;

  &.message-highlight {
    background-color: var(--color-primary-mute);
  }

  .menubar {
    opacity: 0;
    transition: opacity 0.2s ease;
    transform: translateZ(0);
    will-change: opacity;
    pointer-events: none;
  }

  &:hover .menubar {
    opacity: 1;
    pointer-events: auto;
  }
`;

const MessageContentContainer = styled.div`
  max-width: 100%;
  display: flex;
  flex: 1;
  flex-direction: column;
  margin-left: 46px;
  margin-top: 5px;
`;

const MessageFooter = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
  margin-top: 8px;
  /* borderTop applied via style prop based on showMessageDivider */
  gap: 16px;
`;

const NewContextMessage = styled.div`
  cursor: pointer;
`;

const ProgressBarWrapper = styled.div`
  width: calc(100% - 20px);
  padding: 5px 10px;
  margin-left: -10px;
`;

export default memo(MessageItem);