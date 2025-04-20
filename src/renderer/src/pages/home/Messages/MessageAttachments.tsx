import {
  CopyOutlined,
  DownloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  UndoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined
} from '@ant-design/icons'
import FileManager from '@renderer/services/FileManager'
import { FileType, FileTypes, Message } from '@renderer/types'
import { download } from '@renderer/utils/download'
import { Image as AntdImage, Space, Upload } from 'antd'
import { FC, memo, useCallback, useMemo } from 'react'
import styled from 'styled-components'

interface Props {
  message: Message
}

const MessageAttachments: FC<Props> = ({ message }) => {
  // 使用 useCallback 记忆化复制图片函数，避免不必要的重新创建
  const handleCopyImage = useCallback(async (image: FileType) => {
    const data = await FileManager.readFile(image)
    const blob = new Blob([data], { type: 'image/png' })
    const item = new ClipboardItem({ [blob.type]: blob })
    await navigator.clipboard.write([item])
  }, [])

  if (!message.files) {
    return null
  }

  if (message?.files && message.files[0]?.type === FileTypes.IMAGE) {
    return (
      <Container style={{ marginBottom: 8 }}>
        {message.files?.map((image) => {
          // 使用 useCallback 记忆化工具栏渲染函数，避免不必要的重新创建
          const memoizedToolbarRender = useCallback(
            (
              _,
              {
                transform: { scale },
                actions: { onFlipY, onFlipX, onRotateLeft, onRotateRight, onZoomOut, onZoomIn, onReset }
              }
            ) => (
              <ToobarWrapper size={12} className="toolbar-wrapper">
                <SwapOutlined rotate={90} onClick={onFlipY} />
                <SwapOutlined onClick={onFlipX} />
                <RotateLeftOutlined onClick={onRotateLeft} />
                <RotateRightOutlined onClick={onRotateRight} />
                <ZoomOutOutlined disabled={scale === 1} onClick={onZoomOut} />
                <ZoomInOutlined disabled={scale === 50} onClick={onZoomIn} />
                <UndoOutlined onClick={onReset} />
                <CopyOutlined onClick={() => handleCopyImage(image)} />
                <DownloadOutlined onClick={() => download(FileManager.getFileUrl(image))} />
              </ToobarWrapper>
            ),
            [image, handleCopyImage] // 依赖于当前循环的 image 对象和 handleCopyImage 函数
          )

          return (
            <Image
              src={FileManager.getFileUrl(image)}
              key={image.id}
              width="33%"
              preview={{
                toolbarRender: memoizedToolbarRender // 使用记忆化的函数
              }}
            />
          )
        })}
      </Container>
    )
  }

  // 使用 useMemo 记忆化文件列表，避免不必要的重新计算
  const memoizedFileList = useMemo(() => {
    return message.files?.map((file) => {
      // 使用 FileManager.getFileUrl 来获取文件URL，它会处理路径问题
      const fileUrl = FileManager.getFileUrl(file)
      console.log('消息附件URL:', fileUrl)

      return {
        uid: file.id,
        url: fileUrl,
        status: 'done' as const, // 使用 as const 来指定类型
        name: FileManager.formatFileName(file)
      }
    })
  }, [message.files])

  return (
    <Container style={{ marginTop: 2, marginBottom: 8 }} className="message-attachments">
      <Upload listType="text" disabled fileList={memoizedFileList} />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: row;
  gap: 10px;
  margin-top: 8px;
`

const Image = styled(AntdImage)`
  border-radius: 10px;
`

const ToobarWrapper = styled(Space)`
  padding: 0px 24px;
  color: #fff;
  font-size: 20px;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 100px;
  .anticon {
    padding: 12px;
    cursor: pointer;
  }
  .anticon:hover {
    opacity: 0.3;
  }
`

// 使用 memo 包装组件，避免不必要的重渲染
export default memo(MessageAttachments)
