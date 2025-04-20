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
import { Message } from '@renderer/types'
import { Image as AntdImage, Space } from 'antd'
import { FC, memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  message: Message
}

const MessageImage: FC<Props> = ({ message }) => {
  const { t } = useTranslation()

  // 使用 useCallback 记忆化下载函数，避免不必要的重新创建
  const onDownload = useCallback(
    (imageBase64: string, index: number) => {
      try {
        const link = document.createElement('a')
        link.href = imageBase64
        link.download = `image-${Date.now()}-${index}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.message.success(t('message.download.success'))
      } catch (error) {
        console.error('下载图片失败:', error)
        window.message.error(t('message.download.failed'))
      }
    },
    [t]
  )

  // 复制图片到剪贴板
  const onCopy = useCallback(
    async (type: string, image: string) => {
      try {
        switch (type) {
          case 'base64': {
            // 处理 base64 格式的图片
            const parts = image.split(';base64,')
            if (parts.length === 2) {
              const mimeType = parts[0].replace('data:', '')
              const base64Data = parts[1]
              const byteCharacters = atob(base64Data)
              const byteArrays: Uint8Array[] = []

              for (let offset = 0; offset < byteCharacters.length; offset += 512) {
                const slice = byteCharacters.slice(offset, offset + 512)
                const byteNumbers = new Array(slice.length)
                for (let i = 0; i < slice.length; i++) {
                  byteNumbers[i] = slice.charCodeAt(i)
                }
                const byteArray = new Uint8Array(byteNumbers)
                byteArrays.push(byteArray)
              }

              const blob = new Blob(byteArrays, { type: mimeType })
              await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })])
            } else {
              throw new Error('无效的 base64 图片格式')
            }
            break
          }
          case 'url':
            {
              // 处理 URL 格式的图片
              const response = await fetch(image)
              const blob = await response.blob()

              await navigator.clipboard.write([
                new ClipboardItem({
                  [blob.type]: blob
                })
              ])
            }
            break
        }

        window.message.success(t('message.copy.success'))
      } catch (error) {
        console.error('复制图片失败:', error)
        window.message.error(t('message.copy.failed'))
      }
    },
    [t]
  )

  return (
    <Container style={{ marginBottom: 8 }}>
      {message.metadata?.generateImage!.images.map((image, index) => {
        // 使用 useCallback 记忆化工具栏渲染函数，避免不必要的重新创建
        const memoizedToolbarRender = useCallback(
          (
            _: any,
            {
              transform: { scale },
              actions: { onFlipY, onFlipX, onRotateLeft, onRotateRight, onZoomOut, onZoomIn, onReset }
            }: any
          ) => (
            <ToobarWrapper size={12} className="toolbar-wrapper">
              <SwapOutlined rotate={90} onClick={onFlipY} />
              <SwapOutlined onClick={onFlipX} />
              <RotateLeftOutlined onClick={onRotateLeft} />
              <RotateRightOutlined onClick={onRotateRight} />
              <ZoomOutOutlined disabled={scale === 1} onClick={onZoomOut} />
              <ZoomInOutlined disabled={scale === 50} onClick={onZoomIn} />
              <UndoOutlined onClick={onReset} />
              <CopyOutlined onClick={() => onCopy(message.metadata?.generateImage?.type!, image)} />
              <DownloadOutlined onClick={() => onDownload(image, index)} />
            </ToobarWrapper>
          ),
          [image, index, onCopy, onDownload, message.metadata?.generateImage?.type]
        )

        return (
          <Image
            src={image}
            key={`image-${index}`}
            width="33%"
            preview={{
              toolbarRender: memoizedToolbarRender
            }}
          />
        )
      })}
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
export default memo(MessageImage)
