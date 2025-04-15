import { TranslationOutlined } from '@ant-design/icons'
import type { Message, TranslationMessageBlock } from '@renderer/types/newMessageTypes'
import { Divider } from 'antd'
import React from 'react'
import BeatLoader from 'react-spinners/BeatLoader'

import Markdown from '../../Markdown/Markdown'

interface Props {
  block: TranslationMessageBlock
}

const TranslationBlock: React.FC<Props> = ({ block }) => {
  // Create a minimal message object stub required by the Markdown component
  const minimalMessageStub: Partial<Message> & Pick<Message, 'id' | 'role' | 'content'> = {
    id: block.messageId,
    role: 'assistant',
    content: block.content,
    assistantId: '',
    topicId: '',
    createdAt: block.createdAt || '',
    status: 'success',
    type: 'text',
    blocks: [block.id]
  }

  const isLoading = block.status === 'processing' || block.status === 'streaming'

  return (
    <React.Fragment>
      <Divider style={{ margin: 0, marginBottom: 10 }}>
        <TranslationOutlined /> {block.targetLanguage || 'Translation'}
      </Divider>
      {isLoading ? (
        <BeatLoader color="var(--color-text-2)" size={10} style={{ marginBottom: 15 }} />
      ) : (
        <Markdown message={minimalMessageStub as Message} />
      )}
    </React.Fragment>
  )
}

export default React.memo(TranslationBlock)