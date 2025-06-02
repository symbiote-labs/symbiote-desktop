import { useTheme } from '@renderer/context/ThemeProvider'
import { Assistant, Topic } from '@renderer/types'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  assistant: Assistant
  topic?: Topic
}

const SymbiotePrompt: FC<Props> = ({ assistant, topic }) => {
  const { t } = useTranslation()
  const { theme } = useTheme()

  const prompt = assistant.prompt || t('chat.default.description')
  const topicPrompt = topic?.prompt || ''
  const isDark = theme === 'dark'

  if (!prompt && !topicPrompt) {
    return null
  }

  return (
    <Container className="system-prompt" $isDark={isDark}>
      <Text>{prompt}</Text>
    </Container>
  )
}

const Container = styled.div<{ $isDark: boolean }>`
  cursor: default; /* Changed from pointer to default - no clickable functionality */
  padding: 20px;
  margin: 10px;
  border-radius: 8px;
  background-color: ${(props) => (props.$isDark ? '#282828' : '#f8f9fa')};
  border: 1px solid ${(props) => (props.$isDark ? '#444' : '#e5e5e5')};
  transition: all 0.2s ease;
  /* Removed hover effects to indicate non-clickable */
`

const Text = styled.div`
  color: var(--color-text-2);
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
`

export default SymbiotePrompt