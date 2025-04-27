import { MessageBlock, MessageBlockType } from '@renderer/types/newMessage'
import { BeatLoader } from 'react-spinners'

export default function loadingBlock(block: MessageBlock) {
  const LoadingList = {
    [MessageBlockType.MAIN_TEXT]: () => <BeatLoader size={8} />,
    [MessageBlockType.TOOL]: () => <BeatLoader size={8} />
  }

  return LoadingList[block.type]
}
