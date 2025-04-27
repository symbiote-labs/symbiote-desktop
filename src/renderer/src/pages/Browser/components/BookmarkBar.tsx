import { FolderOutlined, StarOutlined } from '@ant-design/icons'
import { Dropdown, Menu, Tooltip } from 'antd'
import React, { useCallback, useState } from 'react'
import styled from 'styled-components'

import { useBookmarks } from '../hooks/useBookmarks'
import { BookmarkTreeNode } from '../types/bookmark'

// 样式
const BookmarkBarContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 8px;
  background-color: var(--color-bg-1);
  border-bottom: 1px solid var(--color-border);
  overflow-x: auto;
  white-space: nowrap;
  height: 32px;

  &::-webkit-scrollbar {
    height: 0;
    display: none;
  }
`

const BookmarkItem = styled.div<{ isActive?: boolean }>`
  display: flex;
  align-items: center;
  padding: 0 8px;
  height: 24px;
  border-radius: 4px;
  margin-right: 4px;
  cursor: pointer;
  white-space: nowrap;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--color-text-1);
  background-color: ${(props) => (props.isActive ? 'var(--color-bg-2)' : 'transparent')};

  &:hover {
    background-color: var(--color-bg-2);
  }

  .anticon {
    margin-right: 4px;
    font-size: 14px;
  }

  img.favicon {
    width: 16px;
    height: 16px;
    margin-right: 4px;
    object-fit: contain;
  }
`

const BookmarkFolderItem = styled(BookmarkItem)`
  color: var(--color-text-1);
  font-weight: 500;
`

// 未使用的组件，保留以备将来使用
// const MoreButton = styled(Button)`
//   margin-left: auto;
//   padding: 0 8px;
//   height: 24px;
//   font-size: 12px;
// `

interface BookmarkBarProps {
  onOpenUrl: (url: string, inNewTab?: boolean) => void
}

const BookmarkBar: React.FC<BookmarkBarProps> = ({ onOpenUrl }) => {
  const { bookmarkTree, loading } = useBookmarks()
  const [activeFolder, setActiveFolder] = useState<string | null>(null)

  // 处理书签点击
  const handleBookmarkClick = useCallback(
    (bookmark: BookmarkTreeNode) => {
      if (bookmark.url) {
        console.log('Bookmark clicked:', bookmark.url)
        onOpenUrl(bookmark.url, false) // 在当前标签页打开
      }
    },
    [onOpenUrl]
  )

  // 渲染书签项
  const renderBookmarkItem = useCallback(
    (bookmark: BookmarkTreeNode) => {
      if (bookmark.isFolder) {
        // 渲染文件夹
        return (
          <Dropdown
            key={bookmark.id}
            overlay={
              <Menu>
                {bookmark.children?.map((child) => (
                  <Menu.Item
                    key={child.id}
                    onClick={() => handleBookmarkClick(child)}
                    icon={
                      child.isFolder ? (
                        <FolderOutlined />
                      ) : child.favicon ? (
                        <img src={child.favicon} className="favicon" alt="" />
                      ) : (
                        <StarOutlined />
                      )
                    }>
                    {child.title}
                  </Menu.Item>
                ))}
                {(!bookmark.children || bookmark.children.length === 0) && <Menu.Item disabled>No bookmarks</Menu.Item>}
              </Menu>
            }
            trigger={['click']}
            onVisibleChange={(visible) => {
              if (visible) {
                setActiveFolder(bookmark.id)
              } else if (activeFolder === bookmark.id) {
                setActiveFolder(null)
              }
            }}>
            <BookmarkFolderItem isActive={activeFolder === bookmark.id}>
              <FolderOutlined />
              <span>{bookmark.title}</span>
            </BookmarkFolderItem>
          </Dropdown>
        )
      } else {
        // 渲染书签
        return (
          <Tooltip key={bookmark.id} title={bookmark.url}>
            <BookmarkItem onClick={() => handleBookmarkClick(bookmark)}>
              {bookmark.favicon ? <img src={bookmark.favicon} className="favicon" alt="" /> : <StarOutlined />}
              <span>{bookmark.title}</span>
            </BookmarkItem>
          </Tooltip>
        )
      }
    },
    [activeFolder, handleBookmarkClick]
  )

  // 如果正在加载，显示加载状态
  if (loading) {
    return <BookmarkBarContainer>Loading bookmarks...</BookmarkBarContainer>
  }

  // 渲染书签栏
  return (
    <BookmarkBarContainer>
      {bookmarkTree.map(renderBookmarkItem)}
      {bookmarkTree.length === 0 && <BookmarkItem>No bookmarks yet. Add some bookmarks to see them here.</BookmarkItem>}
    </BookmarkBarContainer>
  )
}

export default BookmarkBar
