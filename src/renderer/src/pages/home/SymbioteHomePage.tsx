import { useAssistants } from '@renderer/hooks/useAssistant'
import { useSettings } from '@renderer/hooks/useSettings'
import { useActiveTopic } from '@renderer/hooks/useTopic'
import { useAppSelector } from '@renderer/store'
import { selectSymbioteAssistant } from '@renderer/store/assistants'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import NavigationService from '@renderer/services/NavigationService'
import { Assistant } from '@renderer/types'
import { FC, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import SymbioteChat from './SymbioteChat'
import SymbioteNavbar from './SymbioteNavbar'
import TopicTabs from './Tabs/TopicTabs'

let _activeAssistant: Assistant

const HomePage: FC = () => {
  const { assistants } = useAssistants()
  const symbioteAssistant = useAppSelector(selectSymbioteAssistant)
  const navigate = useNavigate()

  const location = useLocation()
  const state = location.state

  // Prioritize Symbiote assistant, then state, then previous active, then first available
  const [activeAssistant, setActiveAssistant] = useState(
    state?.assistant || _activeAssistant || symbioteAssistant || assistants[0]
  )
  const { activeTopic, setActiveTopic } = useActiveTopic(activeAssistant, state?.topic)
  const { showTopics, topicPosition } = useSettings()
  const showAssistants = false

  _activeAssistant = activeAssistant

  useEffect(() => {
    NavigationService.setNavigate(navigate)
  }, [navigate])

  useEffect(() => {
    state?.assistant && setActiveAssistant(state?.assistant)
    state?.topic && setActiveTopic(state?.topic)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => {
    const unsubscribe = EventEmitter.on(EVENT_NAMES.SWITCH_ASSISTANT, (assistantId: string) => {
      const newAssistant = assistants.find((a) => a.id === assistantId)
      if (newAssistant) {
        setActiveAssistant(newAssistant)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [assistants, setActiveAssistant])

  // Auto-switch to Symbiote assistant when it becomes available
  useEffect(() => {
    if (symbioteAssistant && (!activeAssistant || activeAssistant.id !== symbioteAssistant.id)) {
      console.log('[SymbioteHomePage] Switching to Symbiote assistant:', symbioteAssistant.name)
      setActiveAssistant(symbioteAssistant)
    }
  }, [symbioteAssistant, activeAssistant])

  useEffect(() => {
    const canMinimize = topicPosition === 'left' ? !showTopics : !showTopics && !showAssistants
    window.api.window.setMinimumSize(canMinimize ? 520 : 1080, 600)

    return () => {
      window.api.window.resetMinimumSize()
    }
  }, [showAssistants, showTopics, topicPosition])

  return (
    <Container id="home-page">
      <SymbioteNavbar
        activeAssistant={activeAssistant}
        activeTopic={activeTopic}
        setActiveTopic={setActiveTopic}
        setActiveAssistant={setActiveAssistant}
      />
      <ContentContainer id="content-container">
        {showTopics && topicPosition === 'left' && (
          <TopicTabs
            activeAssistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            position="left"
          />
        )}
        <SymbioteChat
          assistant={activeAssistant}
          activeTopic={activeTopic}
          setActiveTopic={setActiveTopic}
          setActiveAssistant={setActiveAssistant}
        />
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  max-width: calc(100vw - var(--sidebar-width));
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  overflow: hidden;
`

export default HomePage
