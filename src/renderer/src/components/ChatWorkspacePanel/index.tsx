import { LeftOutlined } from '@ant-design/icons'
import WorkspaceExplorer from '@renderer/components/WorkspaceExplorer'
import WorkspaceFileViewer from '@renderer/components/WorkspaceFileViewer'
import WorkspaceSelector from '@renderer/components/WorkspaceSelector'
import { Button, Divider, Drawer, message } from 'antd'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const WorkspaceDrawerContent = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: #fafbfc;
`

const SelectorWrapper = styled.div`
  padding: 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
`

const ExplorerContainer = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: #fafbfc;
`

const FileViewerHeader = styled.div`
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fff;
`

const FileViewerTitle = styled.span`
  font-weight: 500;
  font-size: 16px;
`

const BackButton = styled(Button)`
  margin-right: 10px;
`

const StyledDivider = styled(Divider)`
  margin: 0;
`

interface ChatWorkspacePanelProps {
  visible: boolean
  onClose: () => void
  onSendToChat?: (content: string) => void
  onSendFileToChat?: (file: any) => void
}

const ChatWorkspacePanel: React.FC<ChatWorkspacePanelProps> = ({
  visible,
  onClose,
  onSendToChat,
  onSendFileToChat
}) => {
  const { t } = useTranslation()
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null)
  // 移除未使用的状态变量

  const handleFileSelect = (filePath: string, content: string) => {
    setSelectedFile({ path: filePath, content })
    // 移除未使用的状态更新
  }

  const handleCloseViewer = () => {
    setSelectedFile(null)
    // 移除未使用的状态更新
  }

  const handleSendToChat = (content: string) => {
    onSendToChat?.(content)
    onClose()
    setSelectedFile(null)
  }

  const handleSendFileToChat = (file: any) => {
    onSendFileToChat?.(file)
    onClose()
    setSelectedFile(null)
    // 移除未使用的状态更新
  }

  const handleContentChange = async (newContent: string, filePath: string) => {
    try {
      await window.api.file.write(filePath, newContent)
      setSelectedFile((prev) => (prev ? { ...prev, content: newContent } : null))
      // 移除未使用的状态更新
      return true
    } catch (error) {
      console.error('保存文件失败:', error)
      message.error(t('workspace.saveFileError'))
      return false
    }
  }

  return (
    <Drawer
      title={selectedFile ? t('workspace.fileViewer') : t('workspace.title')}
      placement="right"
      width="50vw"
      onClose={() => {
        onClose()
        setSelectedFile(null)
      }}
      open={visible}
      styles={{
        header: { marginTop: '40px' },
        body: { padding: 0, height: 'calc(100% - 95px)', overflow: 'hidden' }
      }}
      closable={false}
      destroyOnClose>
      {selectedFile ? (
        <>
          <FileViewerHeader>
            <BackButton type="text" icon={<LeftOutlined />} onClick={handleCloseViewer} />
            <FileViewerTitle>{t('workspace.fileViewer')}</FileViewerTitle>
          </FileViewerHeader>
          <WorkspaceFileViewer
            filePath={selectedFile.path}
            content={selectedFile.content}
            onClose={handleCloseViewer}
            onSendToChat={handleSendToChat}
            onSendFileToChat={handleSendFileToChat}
            onContentChange={handleContentChange}
          />
        </>
      ) : (
        <WorkspaceDrawerContent>
          <SelectorWrapper>
            <WorkspaceSelector />
          </SelectorWrapper>
          <StyledDivider />
          <ExplorerContainer>
            <WorkspaceExplorer onFileSelect={handleFileSelect} />
          </ExplorerContainer>
        </WorkspaceDrawerContent>
      )}
    </Drawer>
  )
}

export default ChatWorkspacePanel
