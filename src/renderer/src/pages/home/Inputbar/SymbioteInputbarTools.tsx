import { useAppDispatch, useAppSelector } from '@renderer/store'
import { Assistant, FileType, KnowledgeBase, Model } from '@renderer/types'
import { Dispatch, ReactNode, SetStateAction, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { Tooltip } from 'antd'
import { MessageSquareDiff } from 'lucide-react'

import AttachmentButton, { AttachmentButtonRef } from './AttachmentButton'
import { ToolbarButton } from './Inputbar'

export interface SymbioteInputbarToolsRef {
  openQuickPanel: () => void
}

export interface SymbioteInputbarToolsProps {
  assistant: Assistant
  model: Model
  files: FileType[]
  setFiles: (files: FileType[]) => void
  showKnowledgeIcon: boolean
  selectedKnowledgeBases: KnowledgeBase[]
  handleKnowledgeBaseSelect: (bases?: KnowledgeBase[]) => void
  setText: Dispatch<SetStateAction<string>>
  resizeTextArea: () => void
  onEnableGenerateImage: () => void
  isExpended: boolean
  onToggleExpended: () => void
  addNewTopic: () => void
  newTopicShortcut: string
}

const SymbioteInputbarTools = ({
  ref,
  model,
  files,
  setFiles,
  addNewTopic,
  newTopicShortcut
}: SymbioteInputbarToolsProps & { ref?: React.RefObject<SymbioteInputbarToolsRef | null> }) => {
  const { t } = useTranslation()
  const attachmentButtonRef = useRef<AttachmentButtonRef>(null)

  useImperativeHandle(ref, () => ({
    openQuickPanel: () => attachmentButtonRef.current?.openQuickPanel()
  }))

  return (
    <ToolsContainer>
      {/* New Topic button */}
      <Tooltip placement="top" title={t('chat.input.new_topic', { Command: newTopicShortcut })} arrow>
        <ToolbarButton type="text" onClick={addNewTopic}>
          <MessageSquareDiff size={19} />
        </ToolbarButton>
      </Tooltip>

      {/* Attachment button */}
      <AttachmentButton
        ref={attachmentButtonRef}
        model={model}
        files={files}
        setFiles={setFiles}
        ToolbarButton={ToolbarButton}
      />
    </ToolsContainer>
  )
}

const ToolsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`

export default SymbioteInputbarTools