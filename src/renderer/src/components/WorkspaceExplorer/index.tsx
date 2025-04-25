import { FileOutlined, FolderOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import WorkspaceService from '@renderer/services/WorkspaceService'
import { RootState } from '@renderer/store'
import { Empty, Input, message, Spin, Switch, Tree } from 'antd'
import path from 'path-browserify'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import SimpleVirtualizedExplorer from './SimpleVirtualizedExplorer'

const { DirectoryTree } = Tree

const WorkspaceExplorerContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`

const SearchContainer = styled.div`
  padding: 8px;
  display: flex;
  align-items: center;
`

const TreeContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: 0 8px 8px 8px;
`

const EmptyContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
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

const SwitchContainer = styled.div`
  display: flex;
  align-items: center;
`

const StyledSwitch = styled(Switch)`
  margin-right: 8px;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`

const LoadingText = styled.div`
  padding: 20px;
  text-align: center;
`

const IconWrapper = styled.span`
  margin-right: 8px;
`

interface TreeNode {
  title: string
  key: string
  isLeaf: boolean
  children?: TreeNode[]
  path?: string
  fullPath?: string
  hasChildren?: boolean // 标记该目录是否有子项
  loaded?: boolean // 标记该目录的子项是否已加载
}

const WorkspaceExplorer: React.FC<{
  onFileSelect?: (filePath: string, content: string) => void
}> = ({ onFileSelect }) => {
  const { t } = useTranslation()
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [autoExpandParent, setAutoExpandParent] = useState(true)
  const [loading, setLoading] = useState(false)
  const [useVirtualized, setUseVirtualized] = useState(false)

  // 从Redux获取当前工作区
  const currentWorkspace = useSelector((state: RootState) => {
    const { currentWorkspaceId, workspaces } = state.workspace
    return currentWorkspaceId ? workspaces.find((w) => w.id === currentWorkspaceId) || null : null
  })

  // 转换为Tree组件所需的数据结构
  const convertToTreeData = (node: any, parentKey = ''): TreeNode => {
    const currentKey = parentKey ? `${parentKey}/${node.name}` : node.name

    if (node.type === 'file') {
      return {
        title: node.name,
        key: currentKey,
        isLeaf: true,
        path: node.path,
        fullPath: path.join(currentWorkspace!.path, node.path).replace(/\\/g, '/')
      }
    }

    return {
      title: node.name,
      key: currentKey,
      isLeaf: false,
      children:
        node.children && node.children.length > 0
          ? node.children.map((child: any) => convertToTreeData(child, currentKey))
          : [],
      path: node.path || '',
      fullPath: node.path ? path.join(currentWorkspace!.path, node.path).replace(/\\/g, '/') : currentWorkspace!.path,
      hasChildren: node.hasChildren,
      loaded: node.children && node.children.length > 0 // 如果有子项，则认为已加载
    }
  }

  // 加载目录的子项
  const loadDirectoryChildren = async (node: TreeNode) => {
    if (!currentWorkspace || !node.path) return

    try {
      // 获取该目录的结构
      const folderStructure = await WorkspaceService.getWorkspaceFolderStructure(currentWorkspace.path, {
        directoryPath: node.path,
        maxDepth: 1, // 只加载一层
        excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
        lazyLoad: true // 使用懒加载模式
      })

      // 更新节点的子项
      const updateTreeData = (list: TreeNode[], key: string, children: TreeNode[]): TreeNode[] => {
        return list.map((node) => {
          if (node.key === key) {
            return {
              ...node,
              children,
              loaded: true
            }
          }
          if (node.children) {
            return {
              ...node,
              children: updateTreeData(node.children, key, children)
            }
          }
          return node
        })
      }

      // 转换子项为树节点
      const childrenNodes = folderStructure.children.map((child: any) => convertToTreeData(child, node.key))

      // 更新树数据
      setTreeData((prevTreeData) => updateTreeData(prevTreeData, node.key, childrenNodes))
    } catch (error) {
      console.error(`Failed to load directory children for ${node.path}:`, error)
      message.error(t('workspace.loadError'))
    }
  }

  // 加载工作区文件结构
  const loadWorkspaceFiles = async () => {
    if (!currentWorkspace) {
      console.log('loadWorkspaceFiles: 当前没有选择工作区，无法加载文件')
      return
    }

    try {
      console.log('loadWorkspaceFiles: 开始加载工作区文件结构:', currentWorkspace.path)
      setLoading(true)
      const folderStructure = await WorkspaceService.getWorkspaceFolderStructure(currentWorkspace.path, {
        maxDepth: 1, // 只加载根目录的直接子项
        excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/build/**'],
        lazyLoad: true // 使用懒加载模式
      })

      console.log('loadWorkspaceFiles: 获取到文件夹结构:', folderStructure)

      const treeNodes = [convertToTreeData(folderStructure)]
      console.log('loadWorkspaceFiles: 转换后的树节点:', treeNodes)
      setTreeData(treeNodes)

      // 默认展开根节点
      setExpandedKeys([treeNodes[0].key])
      console.log('loadWorkspaceFiles: 设置默认展开的节点:', treeNodes[0].key)
    } catch (error) {
      console.error('loadWorkspaceFiles: 加载工作区文件失败:', error)
      message.error(t('workspace.loadError'))
    } finally {
      setLoading(false)
    }
  }

  // 当工作区变化时加载文件
  useEffect(() => {
    console.log('WorkspaceExplorer: 工作区变化，当前工作区:', currentWorkspace)
    if (currentWorkspace) {
      console.log('WorkspaceExplorer: 开始加载工作区文件:', currentWorkspace.path)
      loadWorkspaceFiles()
    } else {
      console.log('WorkspaceExplorer: 当前没有选择工作区')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace])

  // 处理搜索
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    setSearchValue(value)

    if (!value) {
      setExpandedKeys([])
      setAutoExpandParent(false)
      return
    }

    // 查找匹配的节点并展开其父节点
    const expandedKeysSet = new Set<string>()

    const searchTree = (nodes: TreeNode[], parentKey: string | null = null) => {
      nodes.forEach((node) => {
        if (node.title.toLowerCase().includes(value.toLowerCase())) {
          if (parentKey) expandedKeysSet.add(parentKey)
        }

        if (node.children) {
          searchTree(node.children, node.key)
        }
      })
    }

    searchTree(treeData)
    setExpandedKeys(Array.from(expandedKeysSet))
    setAutoExpandParent(true)
  }

  // 处理展开/折叠
  const handleExpand = (expandedKeys: React.Key[], info: any) => {
    setExpandedKeys(expandedKeys as string[])
    setAutoExpandParent(false)

    // 如果是展开操作，并且节点是目录，且还未加载子项
    if (info.expanded && !info.node.isLeaf) {
      const node = info.node as TreeNode

      // 检查节点是否已加载子项
      const hasLoadedChildren = node.loaded || (node.children && node.children.length > 0)

      // 如果节点有子项但还未加载，或者标记为有子项但子项数组为空
      if (!hasLoadedChildren && (node.hasChildren || (node.children && node.children.length === 0))) {
        loadDirectoryChildren(node)
      }
    }
  }

  // 处理文件选择
  const handleSelect = async (selectedKeys: React.Key[], info: any) => {
    if (selectedKeys.length === 0 || !info.node.isLeaf) return

    try {
      const filePath = info.node.fullPath
      const content = await WorkspaceService.readWorkspaceFile(filePath)

      if (onFileSelect) {
        onFileSelect(filePath, content)
      }
    } catch (error) {
      console.error('Failed to read file:', error)
      message.error(t('workspace.readFileError'))
    }
  }

  // 过滤树节点
  const filterTreeNode = (node: any) => {
    if (!searchValue) return true
    return node.title.toLowerCase().includes(searchValue.toLowerCase())
  }

  // 渲染树节点标题
  const renderTitle = (nodeData: any) => {
    const Icon = nodeData.isLeaf ? FileOutlined : FolderOutlined
    return (
      <span>
        <IconWrapper>
          <Icon />
        </IconWrapper>
        {nodeData.title}
      </span>
    )
  }

  return (
    <WorkspaceExplorerContainer>
      <HeaderContainer>
        <HeaderTitle>{t('workspace.explorer')}</HeaderTitle>
        <SwitchContainer>
          <StyledSwitch
            size="small"
            checked={useVirtualized}
            onChange={setUseVirtualized}
            title={t('workspace.useVirtualized')}
          />
          <ReloadButton onClick={loadWorkspaceFiles}>
            <ReloadOutlined />
          </ReloadButton>
        </SwitchContainer>
      </HeaderContainer>

      <SearchContainer>
        <Input
          placeholder={t('workspace.search')}
          prefix={<SearchOutlined />}
          onChange={handleSearch}
          value={searchValue}
          allowClear
        />
      </SearchContainer>

      <TreeContainer>
        {loading ? (
          <LoadingContainer>
            <Spin size="large">
              <LoadingText>{t('common.loading')}</LoadingText>
            </Spin>
          </LoadingContainer>
        ) : currentWorkspace ? (
          useVirtualized ? (
            // 使用虚拟化树视图
            <SimpleVirtualizedExplorer onFileSelect={onFileSelect} />
          ) : treeData.length > 0 ? (
            // 使用传统树视图
            <DirectoryTree
              treeData={treeData}
              expandedKeys={expandedKeys}
              autoExpandParent={autoExpandParent}
              onExpand={handleExpand}
              onSelect={handleSelect}
              filterTreeNode={filterTreeNode}
              titleRender={renderTitle}
            />
          ) : (
            <EmptyContainer>
              <Empty description={t('workspace.noFiles')} />
            </EmptyContainer>
          )
        ) : (
          <EmptyContainer>
            <Empty description={t('workspace.selectWorkspace')} />
          </EmptyContainer>
        )}
      </TreeContainer>
    </WorkspaceExplorerContainer>
  )
}

export default WorkspaceExplorer
