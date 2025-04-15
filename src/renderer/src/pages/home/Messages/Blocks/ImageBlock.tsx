import type { ImageMessageBlock } from '@renderer/types/newMessageTypes'
import { Image as AntdImage } from 'antd'
import React from 'react'

import MessageAttachments from '../MessageAttachments'

interface Props {
  block: ImageMessageBlock
}

const ImageBlock: React.FC<Props> = ({ block }) => {
  if (block.url) {
    // 渲染基于URL的图片
    return (
      <div style={{ marginTop: '8px' }}>
        <AntdImage
          src={block.url}
          alt="generated image"
          style={{ maxWidth: '100%', borderRadius: '6px' }}
        />
      </div>
    )
  } else if (block.file) {
    // 渲染基于文件的图片
    const dummyMessage = {
      id: block.messageId,
      role: 'assistant',
      files: [block.file],
      assistantId: '',
      topicId: '',
      createdAt: '',
      status: 'success',
      type: 'text',
      blocks: [block.id]
    } as any

    return <MessageAttachments message={dummyMessage} />
  } else {
    // 处理没有URL和文件的情况
    console.warn('ImageBlock has neither URL nor file:', block)
    return <div>[Image Block: No source]</div>
  }
}

export default React.memo(ImageBlock)