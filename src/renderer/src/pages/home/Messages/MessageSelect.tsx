import { Checkbox } from 'antd'
import { FC, ReactNode, useEffect, useRef } from 'react'
import styled from 'styled-components'

import { useChatContext } from './ChatContext'

interface SelectableMessageProps {
  children: ReactNode
  isMultiSelectMode: boolean
  isSelected: boolean
  onSelect: (selected: boolean) => void
  messageId: string
  registerElement?: (id: string, element: HTMLElement | null) => void
}

const SelectableMessage: FC<SelectableMessageProps> = ({
  children,
  isMultiSelectMode,
  isSelected,
  onSelect,
  messageId,
  registerElement
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { registerMessageElement: contextRegister } = useChatContext()

  useEffect(() => {
    if (containerRef.current) {
      if (registerElement) {
        registerElement(messageId, containerRef.current)
      }
      contextRegister(messageId, containerRef.current)

      return () => {
        if (registerElement) {
          registerElement(messageId, null)
        }
        contextRegister(messageId, null)
      }
    }
    return undefined
  }, [messageId, registerElement, contextRegister])

  return (
    <Container ref={containerRef}>
      {isMultiSelectMode && (
        <CheckboxWrapper>
          <Checkbox checked={isSelected} onChange={(e) => onSelect(e.target.checked)} />
        </CheckboxWrapper>
      )}
      <MessageContent isMultiSelectMode={isMultiSelectMode}>{children}</MessageContent>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  width: 100%;
  position: relative;
`

const CheckboxWrapper = styled.div`
  padding: 10px 0 10px 20px;
  display: flex;
  align-items: flex-start;
`

const MessageContent = styled.div<{ isMultiSelectMode: boolean }>`
  flex: 1;
  ${(props) => props.isMultiSelectMode && 'margin-left: 8px;'}
`

export default SelectableMessage
