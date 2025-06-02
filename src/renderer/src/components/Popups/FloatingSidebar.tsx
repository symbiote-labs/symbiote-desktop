import HomeTabs from '@renderer/pages/home/Tabs/index'
import TopicTabs from '@renderer/pages/home/Tabs/TopicTabs'
import { Assistant, Topic } from '@renderer/types'
import { Popover } from 'antd'
import { FC, useEffect, useState } from 'react'
import styled from 'styled-components'

interface Props {
  children: React.ReactNode
  activeAssistant: Assistant
  setActiveAssistant: (assistant: Assistant) => void
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  position: 'left' | 'right'
  isOpen: boolean
  onVisibilityChange: (visible: boolean) => void
  contentType?: 'home' | 'topicsOnly'
}

const FloatingSidebar: FC<Props> = ({
  children,
  activeAssistant,
  setActiveAssistant,
  activeTopic,
  setActiveTopic,
  position = 'left',
  isOpen,
  onVisibilityChange,
  contentType = 'home'
}) => {
  const [maxHeight, setMaxHeight] = useState(Math.floor(window.innerHeight * 0.75))

  useEffect(() => {
    const handleResize = () => {
      setMaxHeight(Math.floor(window.innerHeight * 0.75))
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const popoverContent = (
    <PopoverContent maxHeight={maxHeight}>
      {contentType === 'home' ? (
        <HomeTabs
          activeAssistant={activeAssistant}
          activeTopic={activeTopic}
          setActiveAssistant={setActiveAssistant}
          setActiveTopic={setActiveTopic}
          position={position}
          forceToSeeAllTab={true}
          style={{
            background: 'transparent',
            border: 'none',
            maxHeight: maxHeight
          }}
        />
      ) : (
        <TopicTabs
          activeAssistant={activeAssistant}
          activeTopic={activeTopic}
          setActiveTopic={setActiveTopic}
          position={position}
          style={{
            background: 'transparent',
            border: 'none',
            maxHeight: maxHeight
          }}
        />
      )}
    </PopoverContent>
  )

  return (
    <Popover
      open={isOpen}
      onOpenChange={onVisibilityChange}
      content={popoverContent}
      trigger={['click', 'contextMenu']}
      placement={position === 'left' ? 'rightTop' : 'leftTop'}
      showArrow
      mouseEnterDelay={0.8}
      mouseLeaveDelay={20}
      styles={{
        body: {
          padding: 0
        }
      }}>
      {children}
    </Popover>
  )
}

const PopoverContent = styled.div<{ maxHeight: number }>`
  max-height: ${(props) => props.maxHeight}px;
`

export default FloatingSidebar
