import {
  CopyOutlined,
  DownloadOutlined,
  ReloadOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  SwapOutlined,
  UndoOutlined,
  WarningOutlined,
  ZoomInOutlined,
  ZoomOutOutlined
} from '@ant-design/icons'
import { Message } from '@renderer/types'
import { Alert, Button, Image as AntdImage, Space, Spin, Tooltip } from 'antd'
import { FC, memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  message: Message
}

const MessageImage: FC<Props> = ({ message }) => {
  const { t } = useTranslation()
  const [imageStatus, setImageStatus] = useState<Record<number, 'loading' | 'success' | 'error'>>({})
  const [proxyUrls, setProxyUrls] = useState<Record<number, string>>({})

  // 初始化图像状态
  useEffect(() => {
    if (message.metadata?.generateImage?.images) {
      console.log('[MessageImage] 初始化图像状态，图像类型:', message.metadata.generateImage.type)
      console.log('[MessageImage] 图像数量:', message.metadata.generateImage.images.length)

      // 检查图像格式
      message.metadata.generateImage.images.forEach((image, index) => {
        console.log(`[MessageImage] 图像 ${index} 前50个字符:`, image.substring(0, 50))
        console.log(`[MessageImage] 图像 ${index} 是否为base64格式:`, image.startsWith('data:'))
      })

      const initialStatus: Record<number, 'loading' | 'success' | 'error'> = {}
      message.metadata.generateImage.images.forEach((_, index) => {
        initialStatus[index] = 'loading'
      })
      setImageStatus(initialStatus)
    }
  }, [message.metadata?.generateImage])

  // 使用 useCallback 记忆化下载函数，避免不必要的重新创建
  const onDownload = useCallback(
    (imageUrl: string, index: number) => {
      try {
        console.log('[MessageImage] 开始下载图片:', imageUrl)
        const link = document.createElement('a')
        link.href = imageUrl
        link.download = `image-${Date.now()}-${index}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.message.success(t('message.download.success'))
      } catch (error) {
        console.error('[MessageImage] 下载图片失败:', error)
        window.message.error(t('message.download.failed'))
      }
    },
    [t]
  )

  // 复制图片到剪贴板
  const onCopy = useCallback(
    async (type: string, image: string) => {
      try {
        console.log('[MessageImage] 开始复制图片:', type)
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
              try {
                console.log('[MessageImage] 开始获取图片数据:', image)
                const response = await fetch(image)
                if (!response.ok) {
                  throw new Error(`HTTP error: ${response.status}`)
                }
                const blob = await response.blob()

                await navigator.clipboard.write([
                  new ClipboardItem({
                    [blob.type]: blob
                  })
                ])
              } catch (fetchError) {
                console.error('[MessageImage] 获取图片数据失败:', fetchError)
                // 尝试使用img元素复制
                const img = document.createElement('img')
                img.crossOrigin = 'anonymous'
                img.onload = async () => {
                  try {
                    const canvas = document.createElement('canvas')
                    canvas.width = img.width
                    canvas.height = img.height
                    const ctx = canvas.getContext('2d')
                    ctx?.drawImage(img, 0, 0)
                    canvas.toBlob(async (blob) => {
                      if (blob) {
                        await navigator.clipboard.write([
                          new ClipboardItem({
                            [blob.type]: blob
                          })
                        ])
                        window.message.success(t('message.copy.success'))
                      }
                    })
                  } catch (canvasError) {
                    console.error('[MessageImage] Canvas复制失败:', canvasError)
                    throw canvasError
                  }
                }
                img.onerror = (imgError) => {
                  console.error('[MessageImage] 图片加载失败:', imgError)
                  throw imgError
                }
                img.src = image
                return // 提前返回，等待异步操作完成
              }
            }
            break
        }

        window.message.success(t('message.copy.success'))
      } catch (error) {
        console.error('[MessageImage] 复制图片失败:', error)
        window.message.error(t('message.copy.failed'))
      }
    },
    [t]
  )

  // 尝试使用代理URL
  const tryUseProxy = useCallback((imageUrl: string, index: number) => {
    console.log('[MessageImage] 尝试使用代理URL:', imageUrl)
    // 这里可以添加多个代理选项
    const proxyOptions = [
      `https://cors-anywhere.herokuapp.com/${imageUrl}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrl)}`,
      `https://proxy.cors.sh/${imageUrl}`
    ]

    // 使用第一个代理选项
    const proxyUrl = proxyOptions[0]
    setProxyUrls((prev) => ({ ...prev, [index]: proxyUrl }))
    setImageStatus((prev) => ({ ...prev, [index]: 'loading' }))

    console.log('[MessageImage] 使用代理URL:', proxyUrl)
  }, [])

  // 创建一个函数来生成工具栏渲染函数，避免在循环中使用 useCallback
  const createToolbarRenderer = (image: string, index: number) => {
    return (
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
    )
  }

  // 处理图像加载成功
  const handleImageLoad = (index: number) => {
    console.log('[MessageImage] 图像加载成功:', index)
    setImageStatus((prev) => ({ ...prev, [index]: 'success' }))
  }

  // 处理图像加载失败
  const handleImageError = (index: number, imageUrl: string) => {
    console.error('[MessageImage] 图像加载失败:', index, imageUrl)
    setImageStatus((prev) => ({ ...prev, [index]: 'error' }))
  }

  // 重试加载图像
  const retryLoadImage = (index: number) => {
    console.log('[MessageImage] 重试加载图像:', index)
    setImageStatus((prev) => ({ ...prev, [index]: 'loading' }))
    // 添加随机参数强制重新加载
    const originalUrl = message.metadata?.generateImage?.images[index]
    if (originalUrl) {
      const refreshedUrl = `${originalUrl}${originalUrl.includes('?') ? '&' : '?'}refresh=${Date.now()}`
      setProxyUrls((prev) => ({ ...prev, [index]: refreshedUrl }))
    } else {
      console.error('[MessageImage] 无法获取原始URL')
      setImageStatus((prev) => ({ ...prev, [index]: 'error' }))
    }
  }

  // 获取图像URL
  const getImageUrl = (originalUrl: string, index: number) => {
    return proxyUrls[index] || originalUrl
  }

  // 添加调试信息
  console.log('[MessageImage] 渲染图像组件，图像类型:', message.metadata?.generateImage?.type)
  console.log('[MessageImage] 图像数量:', message.metadata?.generateImage?.images?.length || 0)
  if (message.metadata?.generateImage?.images && message.metadata.generateImage.images.length > 0) {
    const firstImage = message.metadata.generateImage.images[0]
    if (firstImage) {
      console.log('[MessageImage] 第一张图像前50个字符:', firstImage.substring(0, 50))
      console.log('[MessageImage] 图像是否为base64格式:', firstImage.startsWith('data:'))
    }
  }

  return (
    <Container style={{ marginBottom: 8 }}>
      {message.metadata?.generateImage?.images?.map((image, index) => {
        const imageUrl = getImageUrl(image, index)
        const status = imageStatus[index]

        console.log(`[MessageImage] 处理图像 ${index}, 状态:`, status)
        console.log(`[MessageImage] 图像URL前50个字符:`, imageUrl.substring(0, 50))

        return (
          <ImageWrapper key={`image-wrapper-${index}`}>
            {status === 'loading' && (
              <LoadingOverlay>
                <Spin />
              </LoadingOverlay>
            )}

            {status === 'error' && (
              <ErrorOverlay>
                <Alert
                  message="图像加载失败"
                  description={
                    <Space direction="vertical">
                      <div>可能是由于跨域限制或网络问题</div>
                      <div>图像类型: {message.metadata?.generateImage?.type}</div>
                      <div>图像URL前50个字符: {imageUrl.substring(0, 50)}</div>
                      <Space>
                        <Button type="primary" icon={<ReloadOutlined />} onClick={() => retryLoadImage(index)}>
                          重试
                        </Button>
                        <Button icon={<DownloadOutlined />} onClick={() => onDownload(imageUrl, index)}>
                          直接下载
                        </Button>
                        <Tooltip title="尝试使用代理服务器">
                          <Button icon={<WarningOutlined />} onClick={() => tryUseProxy(image, index)}>
                            使用代理
                          </Button>
                        </Tooltip>
                      </Space>
                    </Space>
                  }
                  type="error"
                  showIcon
                />
              </ErrorOverlay>
            )}

            {/* 判断是否为base64图像 */}
            {message.metadata?.generateImage?.type === 'base64' ? (
              // 使用Antd Image组件显示base64图像，以支持放大功能
              <Image
                src={imageUrl}
                key={`image-${index}`}
                width="100%"
                preview={{
                  toolbarRender: createToolbarRenderer(imageUrl, index)
                }}
                onLoad={(e) => {
                  console.log(`[MessageImage] Base64图像 ${index} 加载成功:`, e)
                  handleImageLoad(index)
                }}
                onError={(e) => {
                  console.error(`[MessageImage] Base64图像 ${index} 加载失败:`, e)
                  handleImageError(index, imageUrl)
                }}
                style={{ display: status === 'error' ? 'none' : 'block' }}
              />
            ) : (
              // 使用原来的Antd Image组件
              <Image
                src={imageUrl}
                key={`image-${index}`}
                width="100%"
                preview={{
                  toolbarRender: createToolbarRenderer(imageUrl, index)
                }}
                onLoad={(e) => {
                  console.log(`[MessageImage] 图像 ${index} 加载成功:`, e)
                  handleImageLoad(index)
                }}
                onError={(e) => {
                  console.error(`[MessageImage] 图像 ${index} 加载失败:`, e)
                  handleImageError(index, imageUrl)
                }}
                style={{ display: status === 'error' ? 'none' : 'block' }}
                crossOrigin="anonymous" // 添加跨域属性
              />
            )}
          </ImageWrapper>
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
  flex-wrap: wrap;
`

const ImageWrapper = styled.div`
  position: relative;
  width: 33%;
  min-width: 250px;
  margin-bottom: 10px;

  @media (max-width: 768px) {
    width: 100%;
  }
`

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.1);
  z-index: 1;
  border-radius: 10px;
`

const ErrorOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px;
  z-index: 1;
  border-radius: 10px;
  background-color: rgba(255, 255, 255, 0.9);
`

const Image = styled(AntdImage)`
  border-radius: 10px;
  width: 100%;
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
