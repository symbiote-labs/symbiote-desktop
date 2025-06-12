import { Assistant, Topic } from '@renderer/types'
import { FC } from 'react'
import styled from 'styled-components'

import Topics from './TopicsTab'

interface Props {
  activeAssistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  position: 'left' | 'right'
  style?: React.CSSProperties
}

const TopicTabs: FC<Props> = ({ activeAssistant, activeTopic, setActiveTopic, position, style }) => {
  const borderStyle = '0.5px solid var(--color-border)'
  const border =
    position === 'left' ? { borderRight: borderStyle } : { borderLeft: borderStyle, borderTopLeftRadius: 0 }

  return (
    <Container style={{ ...border, ...style }} className="topic-tabs">
      <TabContent className="topic-tabs-content">
        <Topics assistant={activeAssistant} activeTopic={activeTopic} setActiveTopic={setActiveTopic} />
      </TabContent>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  max-width: var(--assistants-width);
  min-width: var(--assistants-width);
  background-color: var(--color-background);
  overflow: hidden;
  .collapsed {
    width: 0;
    border-left: none;
  }
`

const TabContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
`

export default TopicTabs