/**
 * 书签类型定义
 */

// 书签项类型
export interface Bookmark {
  id: string
  title: string
  url: string
  favicon?: string
  parentId: string | null // null 表示在根目录
  createdAt: string
  updatedAt: string
}

// 书签文件夹类型
export interface BookmarkFolder {
  id: string
  title: string
  parentId: string | null // null 表示在根目录
  createdAt: string
  updatedAt: string
}

// 书签树节点类型（用于渲染树形结构）
export interface BookmarkTreeNode {
  id: string
  title: string
  url?: string
  favicon?: string
  parentId: string | null
  children?: BookmarkTreeNode[]
  isFolder: boolean
  createdAt: string
  updatedAt: string
}
