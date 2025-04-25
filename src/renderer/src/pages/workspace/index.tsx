import { CloseOutlined, DragOutlined, MinusOutlined } from '@ant-design/icons'
import WorkspaceExplorer from '@renderer/components/WorkspaceExplorer'
import WorkspaceFileViewer from '@renderer/components/WorkspaceFileViewer'
import WorkspaceSelector from '@renderer/components/WorkspaceSelector'
import { Button, Divider, Layout, message, Typography } from 'antd'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 检测操作系统
const isWindows = navigator.platform.indexOf('Win') > -1
const isMac = navigator.platform.indexOf('Mac') > -1
const isLinux = navigator.platform.indexOf('Linux') > -1

const { Content, Sider } = Layout
const { Title } = Typography

const WorkspaceContainer = styled(Layout)`
  height: 100%;
  display: flex;
  flex-direction: column;
`

const WorkspaceSider = styled(Sider)`
  background: var(--color-background);
  border-right: 1px solid var(--color-border);
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
`

const WorkspaceContent = styled(Content)`
  background: var(--color-background);
  padding: 0;
  height: 100%;
  overflow: hidden;
`

const WorkspaceHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
`

const WorkspaceTitle = styled(Title)`
  margin: 0 !important;
`

const EmptyContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-secondary);
  font-size: 16px;
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

  /* 为系统窗口控制按钮留出空间 */
  & > div:last-child {
    margin-right: ${() => (isWindows ? '100px' : isMac ? '80px' : '0')};
  }
`

const HeaderTitle = styled(Typography.Text)`
  font-weight: 500;
  font-size: 14px;
  color: var(--color-text);
`

const DragHandle = styled.div`
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
`

const WindowControlButton = styled(Button)`
  margin-left: 8px;
  -webkit-app-region: no-drag;
  color: var(--color-text-secondary);

  &:hover {
    color: var(--color-text);
    background-color: var(--color-background-mute);
  }

  &.close-button:hover {
    color: #fff;
    background-color: #ff4d4f;
  }
`

const WorkspaceMainContent = styled(Layout)`
  height: calc(100% - 40px); /* 减去顶部栏的高度 */
  display: flex;
  flex-direction: row;
`

const WorkspacePage: React.FC = () => {
  const { t } = useTranslation()
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null)

  // 处理文件选择
  const handleFileSelect = (filePath: string, content: string) => {
    setSelectedFile({ path: filePath, content })
  }

  // 关闭文件查看器
  const handleCloseViewer = () => {
    setSelectedFile(null)
  }

  // 处理窗口最小化
  const handleMinimize = () => {
    window.api.window.minimize()
  }

  // 处理窗口关闭
  const handleClose = () => {
    window.api.window.close()
  }

  // 处理文件内容更改
  const handleContentChange = async (newContent: string, filePath: string) => {
    try {
      await window.api.file.write(filePath, newContent)
      setSelectedFile((prev) => (prev ? { ...prev, content: newContent } : null))
      return true
    } catch (error) {
      console.error('保存文件失败:', error)
      message.error(t('workspace.saveFileError'))
      return false
    }
  }

  return (
    <WorkspaceContainer>
      {/* 可拖动的顶部栏 */}
      <DraggableHeader>
        <HeaderTitle>{t('workspace.title')}</HeaderTitle>
        <DragHandle>
          <DragOutlined style={{ marginRight: 8 }} />
          {isLinux && (
            <>
              <WindowControlButton type="text" icon={<MinusOutlined />} size="small" onClick={handleMinimize} />
              <WindowControlButton
                type="text"
                icon={<CloseOutlined />}
                size="small"
                onClick={handleClose}
                className="close-button"
              />
            </>
          )}
        </DragHandle>
      </DraggableHeader>

      {/* 主要内容区域 */}
      <WorkspaceMainContent>
        <WorkspaceSider width={300} theme="light">
          <WorkspaceHeader>
            <WorkspaceTitle level={4}>{t('workspace.title')}</WorkspaceTitle>
            <Divider style={{ margin: '12px 0' }} />
            <WorkspaceSelector />
          </WorkspaceHeader>
          <WorkspaceExplorer onFileSelect={handleFileSelect} />
        </WorkspaceSider>

        <WorkspaceContent>
          {selectedFile ? (
            <WorkspaceFileViewer
              filePath={selectedFile.path}
              content={selectedFile.content}
              onClose={handleCloseViewer}
              onContentChange={handleContentChange}
            />
          ) : (
            <EmptyContent>{t('workspace.selectFile')}</EmptyContent>
          )}
        </WorkspaceContent>
      </WorkspaceMainContent>
    </WorkspaceContainer>
  )
}

export default WorkspacePage
