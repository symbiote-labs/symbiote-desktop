import { CloseOutlined, DragOutlined, LeftOutlined } from '@ant-design/icons'
import WorkspaceExplorer from '@renderer/components/WorkspaceExplorer'
import WorkspaceFileViewer from '@renderer/components/WorkspaceFileViewer'
import WorkspaceSelector from '@renderer/components/WorkspaceSelector'
import { Button, Divider, Drawer, message, Typography } from 'antd'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const WorkspaceDrawerContent = styled.div`
  height: calc(100% - 40px); /* 减去顶部栏的高度 */
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background: var(--color-background);
`

const SelectorWrapper = styled.div`
  padding: 16px;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
`

const ExplorerContainer = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  background: var(--color-background);
`

const FileViewerHeader = styled.div`
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-soft);
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

const DraggableHeader = styled.div`
  height: 40px;
  background-color: var(--color-background-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  cursor: move;
  -webkit-app-region: drag;
  user-select: none;
  border-bottom: 1px solid var(--color-border);
`

const HeaderTitle = styled(Typography.Text)`
  font-weight: 500;
  font-size: 14px;
`

const DragHandle = styled.div`
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
`

const CloseButton = styled(Button)`
  margin-left: 8px;
  -webkit-app-region: no-drag;
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
      title={null} // 移除默认标题，使用自定义标题栏
      placement="right"
      width="50vw"
      onClose={() => {
        onClose()
        setSelectedFile(null)
      }}
      open={visible}
      styles={{
        header: { display: 'none' }, // 隐藏默认标题栏
        body: { padding: '40px 0 0 0', height: '100%', overflow: 'hidden' }
      }}
      closable={false}
      destroyOnClose>
      {/* 添加可拖动的顶部栏 */}
      <DraggableHeader>
        <HeaderTitle>{selectedFile ? t('workspace.fileViewer') : t('workspace.title')}</HeaderTitle>
        <DragHandle>
          <DragOutlined style={{ marginRight: 8 }} />
          <CloseButton
            type="text"
            icon={<CloseOutlined />}
            size="small"
            onClick={() => {
              onClose()
              setSelectedFile(null)
            }}
          />
        </DragHandle>
      </DraggableHeader>

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
