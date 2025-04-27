import {
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  FolderAddOutlined,
  FolderOutlined,
  ImportOutlined,
  PlusOutlined,
  SearchOutlined,
  StarOutlined
} from '@ant-design/icons'
import { Button, Input, message, Modal, Space, Spin, Table, Tree, Typography } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'

import { useBookmarks } from '../hooks/useBookmarks'
import { Bookmark, BookmarkFolder, BookmarkTreeNode } from '../types/bookmark'
import AddBookmarkDialog from './AddBookmarkDialog'

const { Title } = Typography

// 样式
const ManagerContainer = styled.div`
  display: flex;
  height: 100%;
  background-color: var(--color-bg-1);
`

const SidebarContainer = styled.div`
  width: 250px;
  padding: 16px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
`

const ContentContainer = styled.div`
  flex: 1;
  padding: 16px;
  overflow-y: auto;
`

const SearchContainer = styled.div`
  margin-bottom: 16px;
`

const ActionsContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
`

const LoadingContainer = styled.div`
  padding: 20px;
  text-align: center;
`

const FaviconImage = styled.img`
  width: 16px;
  height: 16px;
`

interface BookmarkManagerProps {
  onOpenUrl: (url: string, inNewTab?: boolean) => void
  onClose: () => void
}

const BookmarkManager: React.FC<BookmarkManagerProps> = ({ onOpenUrl, onClose }) => {
  const {
    bookmarks,
    // folders, // 未使用，但保留注释以便将来使用
    bookmarkTree,
    loading,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    addFolder,
    updateFolder,
    // deleteFolder, // 未使用，但保留注释以备将来使用
    searchBookmarks,
    exportBookmarks,
    importBookmarks
  } = useBookmarks()

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Bookmark[]>([])
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [folderBookmarks, setFolderBookmarks] = useState<Bookmark[]>([])
  const [addDialogVisible, setAddDialogVisible] = useState(false)
  const [editBookmark, setEditBookmark] = useState<Bookmark | null>(null)
  const [addFolderDialogVisible, setAddFolderDialogVisible] = useState(false)
  const [editFolder, setEditFolder] = useState<BookmarkFolder | null>(null)

  // 处理搜索
  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery) {
        const results = await searchBookmarks(searchQuery)
        setSearchResults(results)
      } else {
        setSearchResults([])
      }
    }

    performSearch()
  }, [searchQuery, searchBookmarks])

  // 处理文件夹选择
  useEffect(() => {
    if (selectedFolder !== undefined) {
      const folderItems = bookmarks.filter((bookmark) => bookmark.parentId === selectedFolder)
      setFolderBookmarks(folderItems)
    }
  }, [selectedFolder, bookmarks])

  // 处理添加书签
  const handleAddBookmark = useCallback(
    async (title: string, url: string, favicon?: string, folderId?: string | null) => {
      const result = await addBookmark(title, url, favicon, folderId ?? null)
      if (result) {
        message.success('Bookmark added successfully')
      }
    },
    [addBookmark]
  )

  // 处理编辑书签
  const handleEditBookmark = useCallback(
    async (title: string, url: string, favicon?: string, folderId?: string | null) => {
      if (!editBookmark) return

      const updates: Partial<Bookmark> = {
        title,
        url,
        favicon,
        parentId: folderId ?? null
      }

      const result = await updateBookmark(editBookmark.id, updates)
      if (result) {
        message.success('Bookmark updated successfully')
        setEditBookmark(null)
      }
    },
    [editBookmark, updateBookmark]
  )

  // 处理删除书签
  const handleDeleteBookmark = useCallback(
    async (id: string) => {
      Modal.confirm({
        title: 'Delete Bookmark',
        content: 'Are you sure you want to delete this bookmark?',
        okText: 'Yes',
        okType: 'danger',
        cancelText: 'No',
        onOk: async () => {
          const success = await deleteBookmark(id)
          if (success) {
            message.success('Bookmark deleted successfully')
          }
        }
      })
    },
    [deleteBookmark]
  )

  // 处理添加文件夹
  const handleAddFolder = useCallback(
    async (title: string) => {
      const result = await addFolder(title, selectedFolder)
      if (result) {
        message.success('Folder added successfully')
        setAddFolderDialogVisible(false)
      }
    },
    [addFolder, selectedFolder]
  )

  // 处理编辑文件夹
  const handleEditFolder = useCallback(
    async (title: string) => {
      if (!editFolder) return

      const result = await updateFolder(editFolder.id, { title })
      if (result) {
        message.success('Folder updated successfully')
        setEditFolder(null)
      }
    },
    [editFolder, updateFolder]
  )

  // 处理删除文件夹 - 目前未使用，但保留以备将来使用
  // const handleDeleteFolder = useCallback(
  //   async (id: string) => {
  //     Modal.confirm({
  //       title: 'Delete Folder',
  //       content: 'Are you sure you want to delete this folder and all its contents?',
  //       okText: 'Yes',
  //       okType: 'danger',
  //       cancelText: 'No',
  //       onOk: async () => {
  //         const success = await deleteFolder(id)
  //         if (success) {
  //           message.success('Folder deleted successfully')
  //           if (selectedFolder === id) {
  //             setSelectedFolder(null)
  //           }
  //         }
  //       }
  //     })
  //   },
  //   [deleteFolder, selectedFolder]
  // )

  // 处理导出书签
  const handleExportBookmarks = useCallback(async () => {
    const data = await exportBookmarks()
    if (data) {
      const jsonString = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = 'bookmarks.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      message.success('Bookmarks exported successfully')
    }
  }, [exportBookmarks])

  // 处理导入书签
  const handleImportBookmarks = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string
          const data = JSON.parse(content)

          if (data.bookmarks && data.folders) {
            const success = await importBookmarks(data)
            if (success) {
              message.success('Bookmarks imported successfully')
            }
          } else {
            message.error('Invalid bookmark file format')
          }
        } catch (err) {
          console.error('Failed to import bookmarks:', err)
          message.error('Failed to import bookmarks')
        }
      }

      reader.readAsText(file)
    }

    input.click()
  }, [importBookmarks])

  // 构建树数据
  const buildTreeData = useCallback((nodes: BookmarkTreeNode[]) => {
    return nodes.map((node) => ({
      title: node.title,
      key: node.id,
      icon: node.isFolder ? <FolderOutlined /> : <StarOutlined />,
      isLeaf: !node.isFolder,
      children: node.children ? buildTreeData(node.children) : undefined
    }))
  }, [])

  // 处理打开书签
  const handleOpenBookmark = useCallback(
    (url: string) => {
      console.log('Opening bookmark URL:', url)
      onOpenUrl(url, false) // 在当前标签页打开
      onClose() // 关闭书签管理器
    },
    [onOpenUrl, onClose]
  )

  // 表格列定义
  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Bookmark) => (
        <Space>
          {record.favicon ? <FaviconImage src={record.favicon} alt="" /> : <StarOutlined />}
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_: any, record: Bookmark) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => setEditBookmark(record)} size="small" />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteBookmark(record.id)}
            size="small"
          />
          <Button type="link" onClick={() => handleOpenBookmark(record.url)} size="small">
            Open
          </Button>
        </Space>
      )
    }
  ]

  return (
    <ManagerContainer>
      <SidebarContainer>
        <Title level={4}>Bookmarks</Title>

        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddDialogVisible(true)} size="small">
            Add
          </Button>
          <Button icon={<FolderAddOutlined />} onClick={() => setAddFolderDialogVisible(true)} size="small">
            New Folder
          </Button>
        </Space>

        {loading ? (
          <LoadingContainer>
            <Spin />
          </LoadingContainer>
        ) : (
          <Tree
            treeData={buildTreeData(bookmarkTree)}
            onSelect={(selectedKeys) => {
              if (selectedKeys.length > 0) {
                setSelectedFolder(selectedKeys[0] as string)
              } else {
                setSelectedFolder(null)
              }
            }}
            selectedKeys={selectedFolder ? [selectedFolder] : []}
            defaultExpandAll
            showIcon
          />
        )}
      </SidebarContainer>

      <ContentContainer>
        <SearchContainer>
          <Input
            placeholder="Search bookmarks"
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
          />
        </SearchContainer>

        <ActionsContainer>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddDialogVisible(true)}>
              Add Bookmark
            </Button>
            <Button icon={<FolderAddOutlined />} onClick={() => setAddFolderDialogVisible(true)}>
              New Folder
            </Button>
          </Space>

          <Space>
            <Button icon={<ImportOutlined />} onClick={handleImportBookmarks}>
              Import
            </Button>
            <Button icon={<ExportOutlined />} onClick={handleExportBookmarks}>
              Export
            </Button>
            <Button onClick={onClose}>Close</Button>
          </Space>
        </ActionsContainer>

        <Table
          dataSource={searchQuery ? searchResults : folderBookmarks}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'No bookmarks found' }}
        />
      </ContentContainer>

      {/* 添加书签对话框 */}
      <AddBookmarkDialog
        visible={addDialogVisible}
        onClose={() => setAddDialogVisible(false)}
        onAdd={handleAddBookmark}
      />

      {/* 编辑书签对话框 */}
      {editBookmark && (
        <AddBookmarkDialog
          visible={!!editBookmark}
          onClose={() => setEditBookmark(null)}
          initialValues={editBookmark}
          onAdd={handleEditBookmark}
        />
      )}

      {/* 添加文件夹对话框 */}
      <Modal
        title="Add Folder"
        open={addFolderDialogVisible}
        onOk={() => {
          const input = document.getElementById('folderNameInput') as HTMLInputElement
          if (input && input.value) {
            handleAddFolder(input.value)
          }
        }}
        onCancel={() => setAddFolderDialogVisible(false)}>
        <Input id="folderNameInput" placeholder="Folder name" prefix={<FolderOutlined />} autoFocus />
      </Modal>

      {/* 编辑文件夹对话框 */}
      <Modal
        title="Edit Folder"
        open={!!editFolder}
        onOk={() => {
          const input = document.getElementById('editFolderNameInput') as HTMLInputElement
          if (input && input.value) {
            handleEditFolder(input.value)
          }
        }}
        onCancel={() => setEditFolder(null)}>
        <Input
          id="editFolderNameInput"
          placeholder="Folder name"
          prefix={<FolderOutlined />}
          defaultValue={editFolder?.title}
          autoFocus
        />
      </Modal>
    </ManagerContainer>
  )
}

export default BookmarkManager
