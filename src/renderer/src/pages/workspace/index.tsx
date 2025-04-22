import React, { useState } from 'react'
import { Layout, Typography, Divider, message } from 'antd'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import WorkspaceSelector from '@renderer/components/WorkspaceSelector'
import WorkspaceExplorer from '@renderer/components/WorkspaceExplorer'
import WorkspaceFileViewer from '@renderer/components/WorkspaceFileViewer'

const { Content, Sider } = Layout
const { Title } = Typography

const WorkspaceContainer = styled(Layout)`
  height: 100%;
`

const WorkspaceSider = styled(Sider)`
  background: #fff;
  border-right: 1px solid #f0f0f0;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
`

const WorkspaceContent = styled(Content)`
  background: #fff;
  padding: 0;
  height: 100%;
  overflow: hidden;
`

const WorkspaceHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
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
  color: #999;
  font-size: 16px;
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

  // 处理文件内容更改
  const handleContentChange = async (newContent: string, filePath: string) => {
    try {
      await window.api.file.write(filePath, newContent)
      setSelectedFile((prev) => prev ? { ...prev, content: newContent } : null)
      return true
    } catch (error) {
      console.error('保存文件失败:', error)
      message.error(t('workspace.saveFileError'))
      return false
    }
  }

  return (
    <WorkspaceContainer>
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
          <EmptyContent>
            {t('workspace.selectFile')}
          </EmptyContent>
        )}
      </WorkspaceContent>
    </WorkspaceContainer>
  )
}

export default WorkspacePage
