import { messageBlocksSelectors } from '@renderer/store/messageBlock'
import { useAppSelector } from '@renderer/store'
import { selectMessagesForTopic } from '@renderer/store/newMessage'
import type { Assistant, Topic } from '@renderer/types'
import type { Message } from '@renderer/types/newMessage'
import { Alert } from 'antd'
import { groupBy, isEmpty, minBy, orderBy } from 'lodash'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { RootState } from '@renderer/store'
import { useMessageOperations } from '@renderer/hooks/useMessageOperations'
import { useSettings } from '@renderer/hooks/useSettings'
import { useChatContext } from '@renderer/hooks/useChatContext'
import InfiniteScroll from 'react-infinite-scroll-component'
import styled from 'styled-components'

import ChatNavigation from './ChatNavigation'
import MessageAnchorLine from './MessageAnchorLine'
import MessageGroup from './MessageGroup'
import NarrowLayout from './NarrowLayout'
import SymbiotePrompt from './SymbiotePrompt'

interface SymbioteMessagesProps {
  assistant: Assistant
  topic: Topic
  setActiveTopic: (topic: Topic) => void
  onComponentUpdate?(): void
  onFirstUpdate?(): void
}

const SymbioteMessages: React.FC<SymbioteMessagesProps> = ({ assistant, topic, setActiveTopic, onComponentUpdate, onFirstUpdate }) => {
  const [displayLimit, setDisplayLimit] = useState(30)
  const { t } = useTranslation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const messageElements = useRef<{ [messageId: string]: HTMLElement }>({})
  const { messageNavigation } = useSettings()
  const { isMultiSelectMode } = useChatContext(topic)
  const messageOperations = useMessageOperations(topic)

  const messages = useSelector((state: RootState) => selectMessagesForTopic(state, topic.id))
  const blockEntities = useAppSelector((state) => messageBlocksSelectors.selectEntities(state))

  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const filteredMessages = useMemo(() => {
    return messages.filter((message) => {
      if (assistant.settings?.hideMessages) {
        return message.role !== 'system'
      }
      return true
    })
  }, [messages, assistant.settings?.hideMessages])

  const orderedMessages = useMemo(() => {
    return orderBy(filteredMessages, ['createdAt'], ['asc'])
  }, [filteredMessages])

  const displayMessages = useMemo(() => {
    return orderedMessages.slice(-displayLimit)
  }, [orderedMessages, displayLimit])

  const groupedMessages = useMemo(() => {
    const grouped = groupBy(displayMessages, (message) =>
      message.role === 'assistant' ? 'assistant' : 'user'
    )
    return Object.entries(grouped)
  }, [displayMessages])

  const hasMore = orderedMessages.length > displayLimit

  const showPrompt = useMemo(() => {
    if (isEmpty(messages)) {
      return true
    }
    const firstMessage = minBy(messages, 'createdAt')
    return !firstMessage || !assistant.settings?.hideMessages
  }, [messages, assistant.settings?.hideMessages])

  const loadMoreMessages = useCallback(() => {
    if (isLoadingMore || !hasMore) return

    setIsLoadingMore(true)
    setTimeout(() => {
      setDisplayLimit((prev) => prev + 30)
      setIsLoadingMore(false)
    }, 300)
  }, [isLoadingMore, hasMore])

  const registerMessageElement = useCallback((messageId: string, element: HTMLElement | null) => {
    if (element) {
      messageElements.current[messageId] = element
    } else {
      delete messageElements.current[messageId]
    }
  }, [])

  const handleScrollPosition = useCallback(() => {
    onComponentUpdate?.()
  }, [onComponentUpdate])

  useEffect(() => {
    onFirstUpdate?.()
  }, [onFirstUpdate])

  useEffect(() => {
    // Simple implementation without contentSafetyMiddleware
    // if (contentSafetyMiddleware) {
    //   contentSafetyMiddleware.processTopic?.(topic)
    // }
  }, [topic])

  return (
    <MessagesContainer
      id="messages"
      className="messages-container"
      ref={scrollContainerRef}
      style={{ position: 'relative', paddingTop: showPrompt ? 10 : 0 }}
      key={assistant.id}
      onScroll={handleScrollPosition}>
      <NarrowLayout style={{ display: 'flex', flexDirection: 'column-reverse' }}>
        <InfiniteScroll
          dataLength={displayMessages.length}
          next={loadMoreMessages}
          hasMore={hasMore}
          loader={null}
          scrollableTarget="messages"
          inverse
          style={{ overflow: 'visible' }}>
          <ScrollContainer>
            {groupedMessages.map(([key, groupMessages]) => (
              <MessageGroup
                key={key}
                messages={groupMessages as any}
                topic={topic}
                hidePresetMessages={assistant.settings?.hideMessages}
                registerMessageElement={registerMessageElement}
              />
            ))}
            {isLoadingMore && (
              <LoaderContainer>
                {/* <SvgSpinners180Ring color="var(--color-text-2)" /> */}
                <div>Loading...</div>
              </LoaderContainer>
            )}
          </ScrollContainer>
        </InfiniteScroll>
        {showPrompt && <SymbiotePrompt assistant={assistant} key={assistant.prompt} topic={topic} />}
      </NarrowLayout>
      {messageNavigation === 'anchor' && <MessageAnchorLine messages={displayMessages} />}
      {messageNavigation === 'buttons' && <ChatNavigation containerId="messages" />}
      {/*
      <SelectionBox
        isMultiSelectMode={isMultiSelectMode}
        scrollContainerRef={scrollContainerRef}
        messageElements={messageElements.current}
        handleSelectMessage={messageOperations.handleSelectMessage}
      />
      */}
    </MessagesContainer>
  )
}

const MessagesContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  height: 100%;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--color-border);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background-color: var(--color-border-dark);
  }
`

const ScrollContainer = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100%;
`

const LoaderContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  height: 60px;
`

export default SymbioteMessages