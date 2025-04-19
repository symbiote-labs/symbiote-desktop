import {
  CheckOutlined,
  DownloadOutlined,
  DownOutlined,
  EditOutlined,
  LoadingOutlined,
  PlayCircleOutlined,
  RedoOutlined,
  SearchOutlined,
  UndoOutlined
} from '@ant-design/icons'
import ExecutionResult, { ExecutionResultProps } from '@renderer/components/CodeExecutorButton/ExecutionResult'
import CodeMirrorEditor, { CodeMirrorEditorRef } from '@renderer/components/CodeMirrorEditor'
import CopyIcon from '@renderer/components/Icons/CopyIcon'
import UnWrapIcon from '@renderer/components/Icons/UnWrapIcon'
import WrapIcon from '@renderer/components/Icons/WrapIcon'
import { HStack } from '@renderer/components/Layout'
import { useSettings } from '@renderer/hooks/useSettings'
import { message, Tooltip } from 'antd'
import dayjs from 'dayjs'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import Mermaid from './Mermaid'
import { isValidPlantUML, PlantUML } from './PlantUML'
import SvgPreview from './SvgPreview'

interface EditableCodeBlockProps {
  children: string
  className?: string
  [key: string]: any
}

const EditableCodeBlock: React.FC<EditableCodeBlockProps> = ({ children, className }) => {
  const match = /language-(\w+)/.exec(className || '') || children?.includes('\n')
  const { codeShowLineNumbers, fontSize, codeCollapsible, codeWrappable } = useSettings()
  const language = match?.[1] ?? 'text'
  const [isExpanded, setIsExpanded] = useState(!codeCollapsible)
  const [isUnwrapped, setIsUnwrapped] = useState(!codeWrappable)
  const [shouldShowExpandButton, setShouldShowExpandButton] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [code, setCode] = useState(children)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<ExecutionResultProps | null>(null)
  const codeContentRef = useRef<HTMLPreElement>(null)
  const editorRef = useRef<CodeMirrorEditorRef>(null)
  const { t } = useTranslation()

  const showFooterCopyButton = children && children.length > 500 && !codeCollapsible
  const showDownloadButton = ['csv', 'json', 'txt', 'md'].includes(language)

  useEffect(() => {
    setCode(children)
  }, [children])

  useEffect(() => {
    setIsExpanded(!codeCollapsible)
    setShouldShowExpandButton(codeCollapsible && (codeContentRef.current?.scrollHeight ?? 0) > 350)
  }, [codeCollapsible])

  useEffect(() => {
    setIsUnwrapped(!codeWrappable)
  }, [codeWrappable])

  // 当点击编辑按钮时调用
  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      // 如果当前是编辑状态，则保存代码
      if (editorRef.current) {
        // 使用 getContent 方法获取编辑器内容
        const newCode = editorRef.current.getContent()
        setCode(newCode)
      }
    }
    // 切换编辑状态
    setIsEditing(!isEditing)
  }, [isEditing])

  // handleCodeChange 函数，只在撤销/重做操作时才会被调用
  const handleCodeChange = useCallback((newCode: string) => {
    // 只在撤销/重做操作时才会被调用，所以可以安全地更新代码
    // 这不会影响普通的输入操作
    setCode(newCode)
  }, [])

  // 执行代码
  const executeCode = useCallback(async () => {
    if (!code) return

    setIsExecuting(true)
    setExecutionResult(null)

    try {
      let result

      // 根据语言类型选择执行方法
      if (language === 'javascript' || language === 'js') {
        result = await window.api.codeExecutor.executeJS(code)
      } else if (language === 'python' || language === 'py') {
        result = await window.api.codeExecutor.executePython(code)
      } else {
        message.error(t('code.execution.unsupported_language'))
        setIsExecuting(false)
        return
      }

      setExecutionResult(result)
    } catch (error) {
      console.error('Code execution error:', error)
      setExecutionResult({
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setIsExecuting(false)
    }
  }, [code, language, t])

  if (language === 'mermaid') {
    return <Mermaid chart={children} />
  }

  if (language === 'plantuml' && isValidPlantUML(children)) {
    return <PlantUML diagram={children} />
  }

  if (language === 'svg') {
    return (
      <CodeBlockWrapper className="code-block">
        <CodeHeader>
          <CodeLanguage>{'<SVG>'}</CodeLanguage>
          <CopyButton text={children} />
        </CodeHeader>
        <SvgPreview>{children}</SvgPreview>
      </CodeBlockWrapper>
    )
  }

  return match ? (
    <CodeBlockWrapper className="code-block">
      <CodeHeader>
        <CodeLanguage>{'<' + language.toUpperCase() + '>'}</CodeLanguage>
      </CodeHeader>
      <StickyWrapper>
        <HStack
          position="absolute"
          gap={12}
          alignItems="center"
          style={{ bottom: '0.2rem', right: '1rem', height: '27px' }}>
          {showDownloadButton && <DownloadButton language={language} data={code} />}
          {codeWrappable && <UnwrapButton unwrapped={isUnwrapped} onClick={() => setIsUnwrapped(!isUnwrapped)} />}
          {codeCollapsible && shouldShowExpandButton && (
            <CollapseIcon expanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)} />
          )}
          {isEditing && (
            <>
              <UndoRedoButton
                icon={<UndoOutlined />}
                title={t('code_block.undo')}
                onClick={() => editorRef.current?.undo()}
              />
              <UndoRedoButton
                icon={<RedoOutlined />}
                title={t('code_block.redo')}
                onClick={() => editorRef.current?.redo()}
              />
              <UndoRedoButton
                icon={<SearchOutlined />}
                title={t('code_block.search')}
                onClick={() => editorRef.current?.openSearch()}
              />
            </>
          )}
          {(language === 'javascript' || language === 'js' || language === 'python' || language === 'py') && (
            <ExecuteButton isExecuting={isExecuting} onClick={executeCode} title={t('code.execute')} />
          )}
          <EditButton isEditing={isEditing} onClick={handleEditToggle} />
          <CopyButton text={code} />
        </HStack>
      </StickyWrapper>
      {isEditing ? (
        <EditorContainer
          style={{
            maxHeight: codeCollapsible && !isExpanded ? '350px' : 'none',
            overflow: codeCollapsible && !isExpanded ? 'auto' : 'visible'
          }}>
          <CodeMirrorEditor
            ref={editorRef}
            code={code}
            language={language}
            onChange={handleCodeChange}
            showLineNumbers={codeShowLineNumbers}
            fontSize={fontSize - 1}
            height={codeCollapsible && !isExpanded ? '350px' : 'auto'}
          />
        </EditorContainer>
      ) : (
        <CodeContent
          ref={codeContentRef}
          isShowLineNumbers={codeShowLineNumbers}
          isUnwrapped={isUnwrapped}
          isCodeWrappable={codeWrappable}
          style={{
            border: '0.5px solid var(--color-code-background)',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            marginTop: 0,
            fontSize: fontSize - 1,
            maxHeight: codeCollapsible && !isExpanded ? '350px' : 'none',
            overflow: codeCollapsible && !isExpanded ? 'auto' : 'visible',
            position: 'relative',
            whiteSpace: isUnwrapped ? 'pre' : 'pre-wrap'
          }}>
          {code}
        </CodeContent>
      )}
      {executionResult && (
        <ExecutionResult
          success={executionResult.success}
          output={executionResult.output}
          error={executionResult.error}
        />
      )}
      {codeCollapsible && (
        <ExpandButton
          isExpanded={isExpanded}
          onClick={() => setIsExpanded(!isExpanded)}
          showButton={shouldShowExpandButton}
        />
      )}
      {showFooterCopyButton && (
        <CodeFooter>
          <CopyButton text={code} style={{ marginTop: -40, marginRight: 10 }} />
        </CodeFooter>
      )}
    </CodeBlockWrapper>
  ) : (
    <WrappedCode className={className}>{children}</WrappedCode>
  )
}

const EditButton: React.FC<{ isEditing: boolean; onClick: () => void }> = ({ isEditing, onClick }) => {
  const { t } = useTranslation()
  const editLabel = isEditing ? t('code_block.done_editing') : t('code_block.edit')

  return (
    <Tooltip title={editLabel}>
      <EditButtonWrapper onClick={onClick} title={editLabel}>
        {isEditing ? <CheckOutlined style={{ color: 'var(--color-primary)' }} /> : <EditOutlined />}
      </EditButtonWrapper>
    </Tooltip>
  )
}

const ExpandButton: React.FC<{
  isExpanded: boolean
  onClick: () => void
  showButton: boolean
}> = ({ isExpanded, onClick, showButton }) => {
  const { t } = useTranslation()
  if (!showButton) return null

  return (
    <ExpandButtonWrapper onClick={onClick}>
      <div className="button-text">{isExpanded ? t('code_block.collapse') : t('code_block.expand')}</div>
    </ExpandButtonWrapper>
  )
}

const UnwrapButton: React.FC<{ unwrapped: boolean; onClick: () => void }> = ({ unwrapped, onClick }) => {
  const { t } = useTranslation()
  const unwrapLabel = unwrapped ? t('code_block.enable_wrap') : t('code_block.disable_wrap')
  return (
    <Tooltip title={unwrapLabel}>
      <UnwrapButtonWrapper onClick={onClick} title={unwrapLabel}>
        {unwrapped ? (
          <UnWrapIcon style={{ width: '100%', height: '100%' }} />
        ) : (
          <WrapIcon style={{ width: '100%', height: '100%' }} />
        )}
      </UnwrapButtonWrapper>
    </Tooltip>
  )
}

const CopyButton: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => {
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()
  const copy = t('common.copy')

  const onCopy = () => {
    if (!text) return
    navigator.clipboard.writeText(text)
    window.message.success({ content: t('message.copied'), key: 'copy-code' })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Tooltip title={copy}>
      <CopyButtonWrapper onClick={onCopy} style={style}>
        {copied ? <CheckOutlined style={{ color: 'var(--color-primary)' }} /> : <CopyIcon className="copy" />}
      </CopyButtonWrapper>
    </Tooltip>
  )
}

const DownloadButton = ({ language, data }: { language: string; data: string }) => {
  const onDownload = () => {
    const fileName = `${dayjs().format('YYYYMMDDHHmm')}.${language}`
    window.api.file.save(fileName, data)
  }

  return (
    <DownloadWrapper onClick={onDownload}>
      <DownloadOutlined />
    </DownloadWrapper>
  )
}

const CodeBlockWrapper = styled.div`
  position: relative;
`

const EditorContainer = styled.div`
  border: 0.5px solid var(--color-code-background);
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  margin-top: 0;
  position: relative;
`

const CodeContent = styled.pre<{ isShowLineNumbers: boolean; isUnwrapped: boolean; isCodeWrappable: boolean }>`
  padding: 1em;
  background-color: var(--color-code-background);
  border-radius: 4px;
  overflow: auto;
  font-family: monospace;
  white-space: ${(props) => (props.isUnwrapped ? 'pre' : 'pre-wrap')};
  word-break: break-all;
`

const CodeHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5em 1em;
  background-color: var(--color-code-background);
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-bottom: 0.5px solid var(--color-border);
`

const CodeLanguage = styled.span`
  font-family: monospace;
  font-size: 0.8em;
  color: var(--color-text-3);
`

const StickyWrapper = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
`

const CodeFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 0.5em;
`

const ExpandButtonWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0.5em;
  cursor: pointer;
  background-color: var(--color-code-background);
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  border-top: 0.5px solid var(--color-border);

  .button-text {
    font-size: 0.8em;
    color: var(--color-text-3);
  }

  &:hover {
    background-color: var(--color-code-background-hover);
  }
`

const UnwrapButtonWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  color: var(--color-text-3);

  &:hover {
    color: var(--color-primary);
  }
`

const CopyButtonWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  color: var(--color-text-3);

  &:hover {
    color: var(--color-primary);
  }

  .copy {
    width: 100%;
    height: 100%;
  }
`

const EditButtonWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  color: var(--color-text-3);

  &:hover {
    color: var(--color-primary);
  }
`

const UndoRedoButton: React.FC<{ icon: React.ReactNode; title: string; onClick: () => void }> = ({
  icon,
  title,
  onClick
}) => {
  return (
    <Tooltip title={title}>
      <UndoRedoButtonWrapper onClick={onClick} title={title}>
        {icon}
      </UndoRedoButtonWrapper>
    </Tooltip>
  )
}

const UndoRedoButtonWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  color: var(--color-text-3);

  &:hover {
    color: var(--color-primary);
  }
`

const DownloadWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  color: var(--color-text-3);

  &:hover {
    color: var(--color-primary);
  }
`

const ExecuteButton: React.FC<{ isExecuting: boolean; onClick: () => void; title: string }> = ({
  isExecuting,
  onClick,
  title
}) => {
  return (
    <Tooltip title={title}>
      <ExecuteButtonWrapper onClick={onClick} disabled={isExecuting}>
        {isExecuting ? <LoadingOutlined /> : <PlayCircleOutlined />}
      </ExecuteButtonWrapper>
    </Tooltip>
  )
}

const ExecuteButtonWrapper = styled.div<{ disabled: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  color: var(--color-text-3);
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};

  &:hover {
    color: ${(props) => (props.disabled ? 'var(--color-text-3)' : 'var(--color-primary)')};
  }
`

const CollapseIcon = styled(({ expanded, ...props }: { expanded: boolean; onClick: () => void }) => (
  <div {...props}>{expanded ? <DownOutlined /> : <DownOutlined style={{ transform: 'rotate(180deg)' }} />}</div>
))`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  color: var(--color-text-3);

  &:hover {
    color: var(--color-primary);
  }
`

const WrappedCode = styled.code`
  text-wrap: wrap;
`

export default EditableCodeBlock
