import {
  BulbOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  PaperClipOutlined,
  SendOutlined
} from '@ant-design/icons'
import TranslateButton from '@renderer/components/TranslateButton'
import { FileType, FileTypes } from '@renderer/types' // 假设路径正确
import { Button, message, Space, Switch, Tabs, theme as antdTheme, Typography } from 'antd'
import TextArea from 'antd/es/input/TextArea'
import type { GlobalToken } from 'antd/es/theme/interface' // 导入 GlobalToken 类型
import path from 'path-browserify'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import SyntaxHighlighter from 'react-syntax-highlighter'
// 选择你喜欢的主题，确保它们与 RawScrollContainer 的背景/颜色有足够区分
import { docco, vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import styled from 'styled-components'
import { v4 as uuidv4 } from 'uuid'

// 确认 useTheme hook 路径正确
import { useTheme } from '../../hooks/useTheme'

const { Title } = Typography
const { TabPane } = Tabs

// --- Styled Components Props Interfaces ---

interface StyledPropsWithToken {
  token: GlobalToken
}

interface RawScrollContainerProps extends StyledPropsWithToken {
  isDark: boolean
}

// --- Styled Components ---

const FileViewerContainer = styled.div<StyledPropsWithToken>`
  height: 100%;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background-color: ${(props) => props.token.colorBgContainer};
  border: 1px solid ${(props) => props.token.colorBorderSecondary};
  border-radius: ${(props) => props.token.borderRadiusLG}px;
  overflow: hidden;
`

const FileHeader = styled.div<StyledPropsWithToken>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid ${(props) => props.token.colorBorderSecondary};
  flex-shrink: 0;
`

const FileTitle = styled(Title)`
  margin: 0 !important;
  font-size: 16px !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 16px;
`

const FileContent = styled.div`
  flex: 1;
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
`

const FullHeightTabs = styled(Tabs)`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;

  .ant-tabs-content-holder {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  .ant-tabs-content {
    height: 100%;
  }
  .ant-tabs-tabpane {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
`

const ScrollContainerBase = styled.div`
  flex: 1;
  overflow: auto;
  min-height: 100px;
`

const CodeScrollContainer = styled(ScrollContainerBase)`
  padding: 0; /* 内边距由 SyntaxHighlighter 控制 */
  position: relative;
`

// 关键：调整 RawScrollContainer 样式以明确区分
const RawScrollContainer = styled(ScrollContainerBase)<RawScrollContainerProps>`
  padding: 16px;
  white-space: pre-wrap;
  word-break: break-all;
  /* 尝试使用不同的背景色和字体来强制区分 */
  background-color: ${(props) =>
    props.isDark ? '#1e1e1e' : props.token.colorFillTertiary}; /* 暗色用#1e1e1e, 亮色用稍暗的填充色 */
  color: ${(props) => (props.isDark ? '#d4d4d4' : props.token.colorText)}; /* 暗色用#d4d4d4, 亮色用标准文本色 */
  /* 使用标准字体，而不是代码字体，提供视觉区别 */
  font-family: ${(props) => props.token.fontFamily};
  font-size: ${(props) => props.token.fontSize}px; /* 使用标准字体大小 */
  line-height: ${(props) => props.token.lineHeight}; /* 使用标准行高 */
`

const ActionBar = styled.div<StyledPropsWithToken>`
  padding: 10px 16px;
  border-top: 1px solid ${(props) => props.token.colorBorderSecondary};
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
`

const EditorTextArea = styled(TextArea)<{ isDark: boolean }>`
  height: 100% !important;
  resize: none !important;
  border: none;
  outline: none;
  padding: 16px;
  font-family: ${(props) => props.theme.fontFamilyCode || 'monospace'};
  font-size: 14px;
  line-height: 1.5;
  background-color: ${(props) => (props.isDark ? '#1e1e1e' : '#f5f5f5')};
  color: ${(props) => (props.isDark ? '#d4d4d4' : '#333')};
`

// --- Component ---

interface FileViewerProps {
  filePath: string
  content: string
  onClose: () => void
  onSendToChat?: (content: string) => void
  onSendFileToChat?: (file: FileType) => void
  onContentChange?: (newContent: string, filePath: string) => void
}

const WorkspaceFileViewer: React.FC<FileViewerProps> = ({
  filePath,
  content,
  onClose,
  onSendToChat,
  onSendFileToChat,
  onContentChange
}) => {
  const { t } = useTranslation()
  const { theme: appTheme } = useTheme()
  const { token } = antdTheme.useToken()

  const extensionMap = useMemo<Record<string, string>>(
    () => ({
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      c: 'c',
      cpp: 'cpp',
      cs: 'csharp',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      sh: 'bash',
      bat: 'batch',
      ps1: 'powershell',
      sql: 'sql'
    }),
    []
  )

  const [language, setLanguage] = useState<string>('text')
  const [useInternalLightTheme, setUseInternalLightTheme] = useState(appTheme !== 'dark')
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(content)
  const [isTranslating, setIsTranslating] = useState(false)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const extension = path.extname(filePath).toLowerCase().substring(1)
    setLanguage(extensionMap[extension] || 'text')
  }, [filePath, extensionMap])

  useEffect(() => {
    setEditedContent(content)
  }, [content])

  useEffect(() => {
    setUseInternalLightTheme(appTheme !== 'dark')
  }, [appTheme])

  const toggleSyntaxTheme = useCallback(() => setUseInternalLightTheme((prev) => !prev), [])
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content)
    message.success(t('common.copied'))
  }, [content, t])
  const handleSendToChat = useCallback(() => {
    if (onSendToChat) {
      onSendToChat(content)
    }
  }, [content, onSendToChat])
  const handleSendFileAsAttachment = useCallback(() => {
    if (onSendFileToChat) {
      const fileExt = path.extname(filePath)
      const fileName = path.basename(filePath)
      const fileType = (() => {
        const extLower = fileExt.toLowerCase()
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extLower)) return FileTypes.IMAGE
        if (['.txt', '.md', '.json', '.log'].includes(extLower)) return FileTypes.TEXT
        return FileTypes.DOCUMENT
      })()
      const file: FileType = {
        id: uuidv4(),
        name: fileName,
        origin_name: fileName,
        path: filePath,
        size: new Blob([content]).size,
        ext: fileExt,
        type: fileType,
        created_at: new Date().toISOString(),
        count: 1
      }
      onSendFileToChat(file)
      message.success(t('workspace.fileSentAsAttachment'))
    }
  }, [filePath, content, onSendFileToChat, t])
  const handleClose = useCallback(() => onClose(), [onClose])

  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleSave = useCallback(() => {
    if (onContentChange && editedContent !== content) {
      onContentChange(editedContent, filePath)
      message.success(t('common.saved'))
    }
    setIsEditing(false)
  }, [editedContent, content, filePath, onContentChange, t])

  const handleCancelEdit = useCallback(() => {
    setEditedContent(content)
    setIsEditing(false)
  }, [content])

  const handleTranslated = useCallback(
    (translatedText: string) => {
      if (isEditing) {
        setEditedContent(translatedText)
      } else if (onContentChange) {
        onContentChange(translatedText, filePath)
      }
      setIsTranslating(false)
    },
    [isEditing, onContentChange, filePath]
  )

  const syntaxHighlighterStyle = useInternalLightTheme ? docco : vs2015
  const isDarkThemeForRaw = !useInternalLightTheme

  return (
    <FileViewerContainer token={token}>
      <FileHeader token={token}>
        <FileTitle level={4} title={path.basename(filePath)}>
          {path.basename(filePath)}
        </FileTitle>
        <Space>
          <Switch
            checkedChildren={<BulbOutlined />}
            unCheckedChildren={<BulbOutlined />}
            checked={useInternalLightTheme}
            onChange={toggleSyntaxTheme}
            title={t('common.toggleTheme')}
          />
          <Button type="text" icon={<CloseOutlined />} onClick={handleClose} />
        </Space>
      </FileHeader>

      <FileContent>
        <FullHeightTabs defaultActiveKey="code">
          {/* 代码 Tab: 使用 SyntaxHighlighter 或 TextArea */}
          <TabPane tab={t('workspace.code')} key="code">
            <CodeScrollContainer>
              {isEditing ? (
                <EditorTextArea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  isDark={!useInternalLightTheme}
                  ref={textAreaRef}
                  spellCheck={false}
                />
              ) : (
                <SyntaxHighlighter
                  language={language}
                  style={syntaxHighlighterStyle} // 应用所选主题
                  showLineNumbers
                  wrapLines={true}
                  lineProps={{ style: { wordBreak: 'break-all', whiteSpace: 'pre-wrap' } }}
                  customStyle={{
                    margin: 0,
                    padding: '16px',
                    borderRadius: 0,
                    minHeight: '100%',
                    fontSize: token.fontSizeSM // 可以用小号字体
                    // 背景色由 style prop 的主题决定
                  }}
                  codeTagProps={{ style: { display: 'block', fontFamily: token.fontFamilyCode } }} // 明确使用代码字体
                >
                  {content}
                </SyntaxHighlighter>
              )}
            </CodeScrollContainer>
          </TabPane>

          {/* 原始内容 Tab: 只使用 RawScrollContainer 显示纯文本 */}
          <TabPane tab={t('workspace.raw')} key="raw">
            <RawScrollContainer isDark={isDarkThemeForRaw} token={token}>
              {content} {/* 直接渲染文本内容，没有 SyntaxHighlighter */}
            </RawScrollContainer>
          </TabPane>
        </FullHeightTabs>
      </FileContent>

      <ActionBar token={token}>
        <Space>
          {isEditing ? (
            <>
              <Button icon={<CheckOutlined />} type="primary" onClick={handleSave}>
                {t('common.save')}
              </Button>
              <Button onClick={handleCancelEdit}>{t('common.cancel')}</Button>
            </>
          ) : (
            <Button icon={<EditOutlined />} onClick={handleEdit} disabled={!onContentChange}>
              {t('common.edit')}
            </Button>
          )}
        </Space>
        <Space>
          <Button icon={<CopyOutlined />} onClick={handleCopy}>
            {t('common.copy')}
          </Button>
          <TranslateButton
            text={isEditing ? editedContent : content}
            onTranslated={handleTranslated}
            isLoading={isTranslating}
            style={{ borderRadius: '6px' }}
            disabled={isEditing && !onContentChange}
          />
          {onSendToChat && (
            <Button type="primary" icon={<SendOutlined />} onClick={handleSendToChat}>
              {t('workspace.sendToChat')}
            </Button>
          )}
          {onSendFileToChat && (
            <Button icon={<PaperClipOutlined />} onClick={handleSendFileAsAttachment}>
              {t('workspace.sendAsAttachment')}
            </Button>
          )}
        </Space>
      </ActionBar>
    </FileViewerContainer>
  )
}

export default WorkspaceFileViewer
