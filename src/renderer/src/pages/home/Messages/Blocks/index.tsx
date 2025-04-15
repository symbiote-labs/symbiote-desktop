import type {
  CodeMessageBlock,
  ErrorMessageBlock,
  FileMessageBlock,
  ImageMessageBlock,
  MainTextMessageBlock,
  Message,
  MessageBlock,
  ThinkingMessageBlock,
  TranslationMessageBlock,
  WebSearchMessageBlock
} from '@renderer/types/newMessageTypes'
import { MessageBlockType } from '@renderer/types/newMessageTypes'
import React from 'react'

import CodeBlock from './CodeBlock'
import ErrorBlock from './ErrorBlock'
import FileBlock from './FileBlock'
import ImageBlock from './ImageBlock'
import MainTextBlock from './MainTextBlock'
import ThinkingBlock from './ThinkingBlock'
import TranslationBlock from './TranslationBlock'
import WebSearchBlock from './WebSearchBlock'

interface Props {
  blocks: MessageBlock[]
  model?: Model
  messageStatus?: Message['status']
}

const MessageBlockRenderer: React.FC<Props> = ({ blocks, model, messageStatus }) => {
  if (!blocks || blocks.length === 0) return null
  console.log('blocks', blocks)
  return null
  return (
    <>
      {blocks.map((block) => {
        switch (block.type) {
          case MessageBlockType.MAIN_TEXT:
            return <MainTextBlock key={block.id} block={block as MainTextMessageBlock} model={model} />
          case MessageBlockType.IMAGE:
            return <ImageBlock key={block.id} block={block as ImageMessageBlock} />
          case MessageBlockType.FILE:
            return <FileBlock key={block.id} block={block as FileMessageBlock} />
          // case MessageBlockType.TOOL:
          //   return <ToolBlock key={block.id} block={block as ToolBlock} />
          // case MessageBlockType.CITATION:
          //   return <CitationBlock key={block.id} block={block as CitationBlock} />
          case MessageBlockType.WEB_SEARCH:
            return <WebSearchBlock key={block.id} block={block as WebSearchMessageBlock} />
          case MessageBlockType.ERROR:
            return <ErrorBlock key={block.id} block={block as ErrorMessageBlock} />
          case MessageBlockType.THINKING:
            return <ThinkingBlock key={block.id} block={block as ThinkingMessageBlock} />
          case MessageBlockType.CODE:
            return <CodeBlock key={block.id} block={block as CodeMessageBlock} />
          case MessageBlockType.TRANSLATION:
            return <TranslationBlock key={block.id} block={block as TranslationMessageBlock} />
          default:
            console.warn('Unsupported block type in MessageBlockRenderer:', block.type, block)
            return null
        }
      })}
    </>
  )
}

export default React.memo(MessageBlockRenderer)
