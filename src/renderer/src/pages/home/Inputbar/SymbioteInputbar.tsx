import { isVisionModel } from '@renderer/config/models'
import { useQuickPanel } from '@renderer/components/QuickPanel'
import db from '@renderer/databases'
import { useAssistant } from '@renderer/hooks/useAssistant'
import { useMessageOperations, useTopicLoading } from '@renderer/hooks/useMessageOperations'
import { modelGenerating, useRuntime } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
import { useShortcutDisplay } from '@renderer/hooks/useShortcuts'
import { addAssistantMessagesToTopic, getDefaultTopic } from '@renderer/services/AssistantService'
import { EventEmitter } from '@renderer/services/EventService'
import { EVENT_NAMES } from '@renderer/services/EventService'
import { getUserMessage } from '@renderer/services/MessagesService'
import { estimateTextTokens } from '@renderer/services/TokenService'
import { useAppDispatch } from '@renderer/store'
import { sendMessage as sendMessageThunk } from '@renderer/store/thunk/messageThunk'
import { Assistant, FileType, FileTypes, Topic } from '@renderer/types'
import type { MessageInputBaseParams } from '@renderer/types/newMessage'
import { classNames, getFileExtension } from '@renderer/utils'
import { getFilesFromDropEvent } from '@renderer/utils/input'
import { documentExts, imageExts, textExts } from '@shared/config/constant'
import { Tooltip } from 'antd'
import TextArea, { TextAreaRef } from 'antd/es/input/TextArea'
import dayjs from 'dayjs'
import { isEmpty } from 'lodash'
import { CirclePause } from 'lucide-react'
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import NarrowLayout from '../Messages/NarrowLayout'
import AttachmentPreview from './AttachmentPreview'
import { ToolbarButton } from './Inputbar'
import SendMessageButton from './SendMessageButton'
import SymbioteInputbarTools, { SymbioteInputbarToolsRef } from './SymbioteInputbarTools'
import TokenCount from './TokenCount'

interface Props {
  assistant: Assistant
  setActiveTopic: (topic: Topic) => void
  topic: Topic
}

let _text = ''
let _files: FileType[] = []

const SymbioteInputbar: FC<Props> = ({ assistant: _assistant, setActiveTopic, topic }) => {
  const [text, setText] = useState(_text)
  const [inputFocus, setInputFocus] = useState(false)
  const { assistant, addTopic, model } = useAssistant(_assistant.id)
  const {
    sendMessageShortcut,
    fontSize,
    pasteLongTextAsFile,
    pasteLongTextThreshold,
    enableBackspaceDeleteModel
  } = useSettings()
  const [expended, setExpend] = useState(false)
  const [estimateTokenCount, setEstimateTokenCount] = useState(0)
  const [contextCount] = useState({ current: 0, max: 0 })
  const textareaRef = useRef<TextAreaRef>(null)
  const [files, setFiles] = useState<FileType[]>(_files)
  const { t } = useTranslation()
  const containerRef = useRef(null)
  const { searching } = useRuntime()
  const { pauseMessages } = useMessageOperations(topic)
  const loading = useTopicLoading(topic)
  const dispatch = useAppDispatch()
  const [isFileDragging, setIsFileDragging] = useState(false)
  const [textareaHeight] = useState<number>()
  const currentMessageId = useRef<string>('')
  const isVision = useMemo(() => isVisionModel(model), [model])
  const supportExts = useMemo(() => [...textExts, ...documentExts, ...(isVision ? imageExts : [])], [isVision])

  const quickPanel = useQuickPanel()
  const symbioteinputbarToolsRef = useRef<SymbioteInputbarToolsRef>(null)

  const newTopicShortcut = useShortcutDisplay('new_topic')

  _text = text
  _files = files

  const inputEmpty = useMemo(() => {
    return isEmpty(text.trim()) && isEmpty(files)
  }, [text, files])

  const inputTokenCount = useMemo(() => {
    let totalTokens = 0
    files.forEach((file) => {
      if (file.ext === '.txt' || file.ext === '.md') {
        totalTokens += (file as any).tokensCount || 0
      } else {
        totalTokens += 300
      }
    })
    return totalTokens
  }, [files])

  const addNewTopic = useCallback(async () => {
    await modelGenerating()

    const newTopic = getDefaultTopic(assistant.id)

    await db.topics.add({ id: newTopic.id, messages: [] })
    await addAssistantMessagesToTopic({ assistant, topic: newTopic })

    addTopic(newTopic)
    setActiveTopic(newTopic)

    setTimeout(() => EventEmitter.emit(EVENT_NAMES.SHOW_TOPIC_SIDEBAR), 0)
  }, [addTopic, assistant, setActiveTopic])

  const resizeTextArea = useCallback(() => {
    const textArea = textareaRef.current?.resizableTextArea?.textArea
    if (textArea) {
      if (textareaHeight) {
        return
      }
      textArea.style.height = 'auto'
      textArea.style.height = textArea?.scrollHeight > 400 ? '400px' : `${textArea?.scrollHeight}px`
    }
  }, [textareaHeight])

  useEffect(() => {
    const updateTokenCount = async () => {
      if (text.trim()) {
        const count = await estimateTextTokens(text)
        setEstimateTokenCount(count)
      } else {
        setEstimateTokenCount(0)
      }
    }
    updateTokenCount()
  }, [text])

  const sendMessage = useCallback(async () => {
    if (loading || inputEmpty) return

    const messageParams: MessageInputBaseParams = {
      content: text.trim(),
      files: files,
      assistant: assistant,
      topic: topic
    }

    const { message, blocks } = getUserMessage(messageParams)

    currentMessageId.current = message.id

    setText('')
    setFiles([])
    textareaRef.current?.focus()

    dispatch(sendMessageThunk(message, blocks, assistant, topic.id))
  }, [loading, inputEmpty, text, files, assistant, topic, dispatch])

  const onPaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (searching) return

      const clipboardData = event.clipboardData
      if (!clipboardData) return

      if (clipboardData.files.length > 0) {
        event.preventDefault()
        const files = Array.from(clipboardData.files)
        const fileExtensions = files.map((file) => `.${file.name.split('.').pop()?.toLowerCase()}`)
        const validFiles = files.filter((_, index) => supportExts.includes(fileExtensions[index]))

        if (validFiles.length > 0) {
          const _files = await Promise.all(
            validFiles.map(async (file) => {
              const extension = getFileExtension(file.name)
              const fileName = `pasted_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}${extension}`
              const buffer = await file.arrayBuffer()
              const size = buffer.byteLength

              const fileType: FileType = {
                id: Math.random().toString(36).substring(7),
                name: fileName,
                origin_name: fileName,
                path: '',
                type: FileTypes.DOCUMENT,
                ext: extension,
                size: size,
                created_at: dayjs().toISOString(),
                count: 0
              }

              return fileType
            })
          )
          setFiles((prevFiles) => [...prevFiles, ..._files])
        }
        return
      }

      const pastedText = clipboardData.getData('text')
      if (pastedText && pasteLongTextAsFile && pastedText.length > pasteLongTextThreshold) {
        event.preventDefault()
        const fileName = `pasted_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.txt`
        const size = new Blob([pastedText]).size

        const fileType: FileType = {
          id: Math.random().toString(36).substring(7),
          name: fileName,
          origin_name: fileName,
          path: '',
          type: FileTypes.TEXT,
          ext: '.txt',
          size: size,
          created_at: dayjs().toISOString(),
          count: 0
        }

        setFiles((prevFiles) => [...prevFiles, fileType])
      }
    },
    [searching, supportExts, pasteLongTextAsFile, pasteLongTextThreshold]
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isEnterPressed = event.key === 'Enter'

    if (sendMessageShortcut === 'Enter' && isEnterPressed && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      if (quickPanel.isVisible) return event.preventDefault()
      sendMessage()
      return event.preventDefault()
    }

    if (sendMessageShortcut === 'Shift+Enter' && isEnterPressed && event.shiftKey) {
      if (quickPanel.isVisible) return event.preventDefault()
      sendMessage()
      return event.preventDefault()
    }

    if (sendMessageShortcut === 'Ctrl+Enter' && isEnterPressed && event.ctrlKey) {
      if (quickPanel.isVisible) return event.preventDefault()
      sendMessage()
      return event.preventDefault()
    }

    if (sendMessageShortcut === 'Command+Enter' && isEnterPressed && event.metaKey) {
      if (quickPanel.isVisible) return event.preventDefault()
      sendMessage()
      return event.preventDefault()
    }

    if (enableBackspaceDeleteModel && event.key === 'Backspace' && text.trim() === '' && files.length > 0) {
      setFiles((prev) => prev.slice(0, -1))
      return event.preventDefault()
    }
  }

  const onPause = async () => {
    await pauseMessages()
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFileDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return
    }
    setIsFileDragging(false)
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsFileDragging(false)

    const droppedFiles = await getFilesFromDropEvent(e)
    if (droppedFiles.length > 0) {
      setFiles((prevFiles) => [...prevFiles, ...droppedFiles])
    }
  }

  const onToggleExpended = () => {
    setExpend(!expended)
  }

  const isExpanded = useMemo(() => {
    return expended || files.length > 0
  }, [expended, files.length])

  return (
    <Container
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      className="inputbar">
      <NarrowLayout style={{ width: '100%' }}>
        <InputBarContainer
          id="inputbar"
          className={classNames('inputbar-container', inputFocus && 'focus', isFileDragging && 'file-dragging')}
          ref={containerRef}>
          {files.length > 0 && <AttachmentPreview files={files} setFiles={setFiles} />}
          <InputContainer>
            <InputWrapper>
              <StyledTextArea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={onPaste}
                onFocus={() => setInputFocus(true)}
                onBlur={() => setInputFocus(false)}
                placeholder={t('chat.input.placeholder')}
                autoSize={{ minRows: 1, maxRows: 20 }}
                variant="borderless"
                className="nodrag"
                style={{
                  fontSize: fontSize,
                  resize: 'none'
                }}
              />
            </InputWrapper>
          </InputContainer>
          <Toolbar>
            <SymbioteInputbarTools
              ref={symbioteinputbarToolsRef}
              assistant={assistant}
              model={model}
              files={files}
              setFiles={setFiles}
              showKnowledgeIcon={false}
              selectedKnowledgeBases={[]}
              handleKnowledgeBaseSelect={() => {}}
              setText={setText}
              resizeTextArea={resizeTextArea}
              onEnableGenerateImage={() => {}}
              isExpended={isExpanded}
              onToggleExpended={onToggleExpended}
              addNewTopic={addNewTopic}
              newTopicShortcut={newTopicShortcut}
            />
            <ToolbarMenu>
              <TokenCount
                estimateTokenCount={estimateTokenCount}
                inputTokenCount={inputTokenCount}
                contextCount={contextCount}
                ToolbarButton={ToolbarButton}
                onClick={() => {}}
              />
              {loading && (
                <Tooltip placement="top" title={t('chat.input.pause')} arrow>
                  <ToolbarButton type="text" onClick={onPause} style={{ marginRight: -2, marginTop: 1 }}>
                    <CirclePause style={{ color: 'var(--color-error)', fontSize: 20 }} />
                  </ToolbarButton>
                </Tooltip>
              )}
              {!loading && <SendMessageButton sendMessage={sendMessage} disabled={loading || inputEmpty} />}
            </ToolbarMenu>
          </Toolbar>
        </InputBarContainer>
      </NarrowLayout>
    </Container>
  )
}

// Styled components
const Container = styled.div`
  position: relative;
  background-color: var(--color-background);
  border-top: 0.5px solid var(--color-border);

  &:hover {
    background-color: var(--color-background);
  }

  &:has(.file-dragging) {
    background: linear-gradient(135deg, rgba(22, 119, 255, 0.05) 0%, rgba(22, 119, 255, 0.1) 100%);
    border: 2px dashed var(--color-primary);
    border-radius: 8px;
  }
`

const InputBarContainer = styled.div`
  background-color: var(--color-background);
  border-radius: 8px;
  margin: 8px 8px 8px 8px;
  transition: all 0.2s ease;
  border: 1px solid var(--color-border);

  &.focus {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
  }

  &.file-dragging {
    border-color: var(--color-primary);
    background: linear-gradient(135deg, rgba(22, 119, 255, 0.05) 0%, rgba(22, 119, 255, 0.1) 100%);
  }
`

const InputContainer = styled.div`
  position: relative;
  padding: 12px 16px 0;
`

const InputWrapper = styled.div`
  position: relative;
  min-height: 40px;
  display: flex;
  align-items: center;
`

const StyledTextArea = styled(TextArea)`
  background: transparent !important;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text);
  resize: none;

  &:focus {
    border: none !important;
    box-shadow: none !important;
  }

  &::placeholder {
    color: var(--color-text-3);
  }

  .ant-input {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
`

const Toolbar = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px 12px;
  gap: 8px;
`

const ToolbarMenu = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
`

export default SymbioteInputbar