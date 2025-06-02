import { Navbar, NavbarRight } from '@renderer/components/app/Navbar'
import { HStack } from '@renderer/components/Layout'
import MinAppsPopover from '@renderer/components/Popups/MinAppsPopover'
import SearchPopup from '@renderer/components/Popups/SearchPopup'
import { useSettings } from '@renderer/hooks/useSettings'
import { useShortcut } from '@renderer/hooks/useShortcuts'
import { Assistant, Topic } from '@renderer/types'
import { Tooltip } from 'antd'
import { t } from 'i18next'
import { LayoutGrid, Search } from 'lucide-react'
import { FC } from 'react'
import styled from 'styled-components'

import UpdateAppButton from './components/UpdateAppButton'

// Styled Components
export const NavbarIcon = styled.div`
  -webkit-app-region: none;
  border-radius: 8px;
  height: 30px;
  padding: 0 7px;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  .iconfont {
    font-size: 18px;
    color: var(--color-icon);
    &.icon-a-addchat {
      font-size: 20px;
    }
    &.icon-a-darkmode {
      font-size: 20px;
    }
    &.icon-appstore {
      font-size: 20px;
    }
  }
  .anticon {
    color: var(--color-icon);
    font-size: 16px;
  }
  &:hover {
    background-color: var(--color-background-mute);
    color: var(--color-icon-white);
  }
`

const NarrowIcon = styled(NavbarIcon)`
  @media (max-width: 1000px) {
    display: none;
  }
`

const TopicNameContainer = styled.div`
  display: flex;
  align-items: center;
  flex: 1;
  padding-left: 16px;
  min-width: 0; /* Allow text to be truncated */
`

const TopicName = styled.div`
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
  cursor: default;

  &:hover {
    color: var(--color-text-2);
  }

  @media (max-width: 768px) {
    max-width: 200px;
  }

  @media (max-width: 480px) {
    max-width: 120px;
  }
`

interface Props {
  activeAssistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  setActiveAssistant: (assistant: Assistant) => void
  position: 'left' | 'right'
}

const SymbioteNavbar: FC<Props> = ({ activeTopic }) => {
  const { sidebarIcons } = useSettings()

  useShortcut('search_message', () => {
    SearchPopup.show()
  })

  return (
    <Navbar className="symbiote-navbar">
      {/* Topic name display */}
      <TopicNameContainer>
        <TopicName title={activeTopic.name}>
          {activeTopic.name}
        </TopicName>
      </TopicNameContainer>

      <NavbarRight style={{ justifyContent: 'flex-end', flex: 1 }} className="symbiote-navbar-right">
        <HStack alignItems="center" gap={8}>
          <UpdateAppButton />
          <Tooltip title={t('chat.assistant.search.placeholder')} mouseEnterDelay={0.8}>
            <NarrowIcon onClick={() => SearchPopup.show()}>
              <Search size={18} />
            </NarrowIcon>
          </Tooltip>
          {/* Expand dialog button removed - keeping interface in expanded mode */}
          {sidebarIcons.visible.includes('minapp') && (
            <MinAppsPopover>
              <Tooltip title={t('minapp.title')} mouseEnterDelay={0.8}>
                <NarrowIcon>
                  <LayoutGrid size={18} />
                </NarrowIcon>
              </Tooltip>
            </MinAppsPopover>
          )}
        </HStack>
      </NavbarRight>
    </Navbar>
  )
}

export default SymbioteNavbar