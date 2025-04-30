import './index.css'

import { FileOutlined, FolderOutlined, ReloadOutlined } from '@ant-design/icons'
import WorkspaceService from '@renderer/services/WorkspaceService'
import { RootState } from '@renderer/store'
import { Empty, message, Spin } from 'antd'
import path from 'path-browserify'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import { AutoSizer, List } from 'react-virtualized'
import styled from 'styled-components'

// 样式组件
const ExplorerContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
`

const HeaderTitle = styled.div`
  font-weight: 500;
  font-size: 16px;
`

const ReloadButton = styled.div`
  cursor: pointer;
  &:hover {
    color: #1890ff;
  }
`

const ListContainer = styled.div`
  flex: 1;
  overflow: hidden;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`

const EmptyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
`

const FileItem = styled.div`
  display: flex;
  align-items: center;
  padding: 0 8px;
  cursor: pointer;
  user-select: none;
  height: 100%;

  &:hover {
    background-color: var(--color-background-soft);
  }
`

const FolderItem = styled(FileItem)`
  font-weight: 500;
`

const IconWrapper = styled.span`
  margin-right: 8px;
`

const BreadcrumbContainer = styled.div`
  padding: 8px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  overflow-x: auto;
  white-space: nowrap;
`

const BreadcrumbItem = styled.span`
  cursor: pointer;
  &:hover {
    color: #1890ff;
  }
`

const BreadcrumbSeparator = styled.span`
  margin: 0 8px;
  color: #d9d9d9;
`

// 文件项类型
interface FileItemType {
  name: string
  path: string
  fullPath: string
  isDirectory: boolean
  extension?: string
}

// 组件属性
interface SimpleVirtualizedExplorerProps {
  onFileSelect?: (filePath: string, content: string) => void
}

// 主组件
const SimpleVirtualizedExplorer: React.FC<SimpleVirtualizedExplorerProps> = ({ onFileSelect }) => {
  const { t } = useTranslation()
  const [files, setFiles] = useState<FileItemType[]>([])
  const [loading, setLoading] = useState(false)
  const [currentPath, setCurrentPath] = useState('')
  const [breadcrumbs, setBreadcrumbs] = useState<{ name: string; path: string }[]>([])

  // 从Redux获取当前工作区
  const currentWorkspace = useSelector((state: RootState) => {
    const { currentWorkspaceId, workspaces } = state.workspace
    return currentWorkspaceId ? workspaces.find((w) => w.id === currentWorkspaceId) || null : null
  })

  // 加载当前目录的文件
  const loadFiles = async (dirPath = '') => {
    if (!currentWorkspace) return

    try {
      setLoading(true)

      // 获取文件夹结构
      const folderStructure = await WorkspaceService.getWorkspaceFolderStructure(currentWorkspace.path, {
        directoryPath: dirPath,
        maxDepth: 1,
        excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
        lazyLoad: true
      })

      // 转换为文件列表
      const fileList: FileItemType[] = []

      // 添加文件夹
      if (folderStructure.children) {
        // 先添加文件夹
        const folders = folderStructure.children
          .filter((item) => item.type === 'directory')
          .map((item) => ({
            name: item.name,
            path: item.path,
            fullPath: path.join(currentWorkspace.path, item.path).replace(/\\/g, '/'),
            isDirectory: true
          }))

        // 再添加文件
        const files = folderStructure.children
          .filter((item) => item.type === 'file')
          .map((item) => ({
            name: item.name,
            path: item.path,
            fullPath: path.join(currentWorkspace.path, item.path).replace(/\\/g, '/'),
            isDirectory: false,
            extension: item.extension
          }))

        // 合并并排序
        fileList.push(...folders.sort((a, b) => a.name.localeCompare(b.name)))
        fileList.push(...files.sort((a, b) => a.name.localeCompare(b.name)))
      }

      setFiles(fileList)
      setCurrentPath(dirPath)

      // 更新面包屑
      updateBreadcrumbs(dirPath)
    } catch (error) {
      console.error('Failed to load files:', error)
      message.error(t('workspace.loadError'))
    } finally {
      setLoading(false)
    }
  }

  // 更新面包屑
  const updateBreadcrumbs = (dirPath: string) => {
    const parts = dirPath.split('/').filter(Boolean)
    const breadcrumbItems = [{ name: t('workspace.root'), path: '' }]

    let currentPath = ''
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      breadcrumbItems.push({ name: part, path: currentPath })
    }

    setBreadcrumbs(breadcrumbItems)
  }

  // 处理文件点击
  const handleFileClick = async (file: FileItemType) => {
    if (file.isDirectory) {
      // 如果是文件夹，进入该文件夹
      loadFiles(file.path)
    } else if (onFileSelect) {
      // 如果是文件，读取文件内容
      try {
        const content = await WorkspaceService.readWorkspaceFile(file.fullPath)
        onFileSelect(file.fullPath, content)
      } catch (error) {
        console.error('Failed to read file:', error)
        message.error(t('workspace.readFileError'))
      }
    }
  }

  // 处理面包屑点击
  const handleBreadcrumbClick = (path: string) => {
    loadFiles(path)
  }

  // 初始加载
  useEffect(() => {
    if (currentWorkspace) {
      loadFiles()
    }
  }, [currentWorkspace])

  // 渲染文件项
  const renderRow = ({ index, key, style }: { index: number; key: string; style: React.CSSProperties }) => {
    const file = files[index]

    return (
      <div key={key} style={style} onClick={() => handleFileClick(file)}>
        {file.isDirectory ? (
          <FolderItem>
            <IconWrapper>
              <FolderOutlined style={{ color: '#e8c341' }} />
            </IconWrapper>
            {file.name}
          </FolderItem>
        ) : (
          <FileItem>
            <IconWrapper>
              <FileOutlined style={{ color: '#8c8c8c' }} />
            </IconWrapper>
            {file.name}
          </FileItem>
        )}
      </div>
    )
  }

  if (!currentWorkspace) {
    return (
      <EmptyContainer>
        <Empty description={t('workspace.selectWorkspace')} />
      </EmptyContainer>
    )
  }

  return (
    <ExplorerContainer>
      <HeaderContainer>
        <HeaderTitle>{t('workspace.explorer')}</HeaderTitle>
        <ReloadButton onClick={() => loadFiles(currentPath)}>
          <ReloadOutlined />
        </ReloadButton>
      </HeaderContainer>

      <BreadcrumbContainer>
        {breadcrumbs.map((item, index) => (
          <React.Fragment key={item.path}>
            {index > 0 && <BreadcrumbSeparator>/</BreadcrumbSeparator>}
            <BreadcrumbItem onClick={() => handleBreadcrumbClick(item.path)}>{item.name}</BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbContainer>

      <ListContainer>
        {loading ? (
          <LoadingContainer>
            <Spin size="large" />
          </LoadingContainer>
        ) : files.length > 0 ? (
          <AutoSizer>
            {({ width, height }) => (
              <List width={width} height={height} rowCount={files.length} rowHeight={30} rowRenderer={renderRow} />
            )}
          </AutoSizer>
        ) : (
          <EmptyContainer>
            <Empty description={t('workspace.noFiles')} />
          </EmptyContainer>
        )}
      </ListContainer>
    </ExplorerContainer>
  )
}

export default SimpleVirtualizedExplorer
