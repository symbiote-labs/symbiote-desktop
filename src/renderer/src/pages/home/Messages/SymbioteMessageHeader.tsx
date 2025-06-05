import SymbioteLogoGreyscale from '@renderer/assets/images/symbiote_logo_greyscale.png'
import SymbioteLogoGreyscaleBlackBg from '@renderer/assets/images/symbiote_logo_greyscale_blackbg.png'
import EmojiAvatar from '@renderer/components/Avatar/EmojiAvatar'
import UserPopup from '@renderer/components/Popups/UserPopup'
import { APP_NAME, AppLogo, isLocalAi } from '@renderer/config/env'
import { getModelLogo } from '@renderer/config/models'
import { useTheme } from '@renderer/context/ThemeProvider'
import useAvatar from '@renderer/hooks/useAvatar'
import { useMinappPopup } from '@renderer/hooks/useMinappPopup'
import { useMessageStyle, useSettings } from '@renderer/hooks/useSettings'
import { getMessageModelId } from '@renderer/services/MessagesService'
import type { Assistant, Model } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { isEmoji, removeLeadingEmoji } from '@renderer/utils'
import { Avatar } from 'antd'
import dayjs from 'dayjs'
import { CSSProperties, FC, memo, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  message: Message
  assistant: Assistant
  model?: Model
}

const getAvatarSource = (isLocalAi: boolean, modelId: string | undefined) => {
  if (isLocalAi) return AppLogo
  return modelId ? getModelLogo(modelId) : undefined
}

const SymbioteMessageHeader: FC<Props> = memo(({ model, message }) => {
  const avatar = useAvatar()
  const { theme } = useTheme()
  const { userName, sidebarIcons } = useSettings()
  const { t } = useTranslation()
  const { isBubbleStyle } = useMessageStyle()
  const { openMinappById } = useMinappPopup()

  useMemo(() => getAvatarSource(isLocalAi, getMessageModelId(message)), [message])

  const getUserName = useCallback(() => {
    if (isLocalAi && message.role !== 'user') {
      return APP_NAME
    }

    if (message.role === 'assistant') {
      return 'Symbiote'
    }

    return userName || t('common.you')
  }, [message, t, userName])

  const isAssistantMessage = message.role === 'assistant'
  const showMinappIcon = sidebarIcons.visible.includes('minapp')

  const username = useMemo(() => removeLeadingEmoji(getUserName()), [getUserName])

  const showMiniApp = useCallback(() => {
    showMinappIcon && model?.provider && openMinappById(model.provider)
    // because don't need openMinappById to be a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.provider, showMinappIcon])

  const avatarStyle: CSSProperties | undefined = isBubbleStyle
    ? {
        flexDirection: isAssistantMessage ? 'row' : 'row-reverse',
        textAlign: isAssistantMessage ? 'left' : 'right'
      }
    : undefined

  const containerStyle = isBubbleStyle
    ? {
        justifyContent: isAssistantMessage ? 'flex-start' : 'flex-end'
      }
    : undefined

  return (
    <Container className="message-header" style={containerStyle}>
      <AvatarWrapper style={avatarStyle}>
        {isAssistantMessage ? (
          <img
            src={theme === 'dark' ? SymbioteLogoGreyscaleBlackBg : SymbioteLogoGreyscale}
            style={{
              width: 35,
              height: 35,
              borderRadius: '25%',
              cursor: showMinappIcon ? 'pointer' : 'default',
              border: isLocalAi ? '1px solid var(--color-border-soft)' : 'none'
            }}
            onClick={showMiniApp}
          />
        ) : (
          <>
            {isEmoji(avatar) ? (
              <EmojiAvatar onClick={() => UserPopup.show()} size={35} fontSize={20}>
                {avatar}
              </EmojiAvatar>
            ) : (
              <Avatar
                src={avatar}
                size={35}
                style={{ borderRadius: '25%', cursor: 'pointer' }}
                onClick={() => UserPopup.show()}
              />
            )}
          </>
        )}
        <UserWrap>
          <UserName isBubbleStyle={isBubbleStyle} theme={theme}>
            {username}
          </UserName>
          <MessageTime>{dayjs(message?.updatedAt ?? message.createdAt).format('MM/DD HH:mm')}</MessageTime>
        </UserWrap>
      </AvatarWrapper>
    </Container>
  )
})

SymbioteMessageHeader.displayName = 'MessageHeader'

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-bottom: 4px;
`

const AvatarWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
`

const UserWrap = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`

const UserName = styled.div<{ isBubbleStyle?: boolean; theme?: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${(props) => (props.isBubbleStyle && props.theme === 'dark' ? 'white' : 'var(--color-text)')};
`

const MessageTime = styled.div`
  font-size: 10px;
  color: var(--color-text-3);
`

export default SymbioteMessageHeader