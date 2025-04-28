import Spinner from '@renderer/components/Spinner'
import { MessageBlockStatus, MessageBlockType, type PlaceholderMessageBlock } from '@renderer/types/newMessage'
import React from 'react'

interface PlaceholderBlockProps {
  block: PlaceholderMessageBlock
}
const PlaceholderBlock: React.FC<PlaceholderBlockProps> = ({ block }) => {
  if (block.status === MessageBlockStatus.PROCESSING && block.type === MessageBlockType.UNKNOWN) {
    return <Spinner text="message.processing" />
  }
  return null
}

export default React.memo(PlaceholderBlock)
