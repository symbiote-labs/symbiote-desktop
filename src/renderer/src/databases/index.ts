import { Bookmark, BookmarkFolder } from '@renderer/pages/Browser/types/bookmark'
import { Workspace } from '@renderer/store/workspace'
import { FileType, KnowledgeItem, QuickPhrase, Topic, TranslateHistory } from '@renderer/types'
import { Dexie, type EntityTable } from 'dexie'

import { upgradeToV5 } from './upgrades'

// Database declaration (move this to its own module also)
export const db = new Dexie('CherryStudio') as Dexie & {
  files: EntityTable<FileType, 'id'>
  topics: EntityTable<Pick<Topic, 'id' | 'messages'>, 'id'>
  settings: EntityTable<{ id: string; value: any }, 'id'>
  knowledge_notes: EntityTable<KnowledgeItem, 'id'>
  translate_history: EntityTable<TranslateHistory, 'id'>
  quick_phrases: EntityTable<QuickPhrase, 'id'>
  workspaces: EntityTable<Workspace, 'id'>
  bookmarks: EntityTable<Bookmark, 'id'>
  bookmark_folders: EntityTable<BookmarkFolder, 'id'>
}

db.version(1).stores({
  files: 'id, name, origin_name, path, size, ext, type, created_at, count'
})

db.version(2).stores({
  files: 'id, name, origin_name, path, size, ext, type, created_at, count',
  topics: '&id, messages',
  settings: '&id, value'
})

db.version(3).stores({
  files: 'id, name, origin_name, path, size, ext, type, created_at, count',
  topics: '&id, messages',
  settings: '&id, value',
  knowledge_notes: '&id, baseId, type, content, created_at, updated_at'
})

db.version(4).stores({
  files: 'id, name, origin_name, path, size, ext, type, created_at, count',
  topics: '&id, messages',
  settings: '&id, value',
  knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
  translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt'
})

db.version(5)
  .stores({
    files: 'id, name, origin_name, path, size, ext, type, created_at, count',
    topics: '&id, messages',
    settings: '&id, value',
    knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
    translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt'
  })
  .upgrade((tx) => upgradeToV5(tx))

db.version(6).stores({
  files: 'id, name, origin_name, path, size, ext, type, created_at, count',
  topics: '&id, messages',
  settings: '&id, value',
  knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
  translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt',
  quick_phrases: 'id'
})

db.version(7).stores({
  files: 'id, name, origin_name, path, size, ext, type, created_at, count',
  topics: '&id, messages',
  settings: '&id, value',
  knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
  translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt',
  quick_phrases: 'id',
  workspaces: '&id, name, path, createdAt, updatedAt'
})

db.version(8).stores({
  files: 'id, name, origin_name, path, size, ext, type, created_at, count',
  topics: '&id, messages',
  settings: '&id, value',
  knowledge_notes: '&id, baseId, type, content, created_at, updated_at',
  translate_history: '&id, sourceText, targetText, sourceLanguage, targetLanguage, createdAt',
  quick_phrases: 'id',
  workspaces: '&id, name, path, createdAt, updatedAt',
  bookmarks: '&id, title, url, parentId, createdAt, updatedAt',
  bookmark_folders: '&id, title, parentId, createdAt, updatedAt'
})

export default db
