import { useSettings } from '@renderer/hooks/useSettings'
import { reloadTranslations } from '@renderer/i18n'
import { FileType } from '@renderer/types'
import { Button, Input, message, Modal, Spin } from 'antd'
import * as pdfjsLib from 'pdfjs-dist'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 设置 PDF.js worker 路径
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

interface PDFSplitterProps {
  file: FileType
  visible: boolean
  onCancel: () => void
  onConfirm: (file: FileType, pageRange: string) => void
}

const PDFSplitter: FC<PDFSplitterProps> = ({ file, visible, onCancel, onConfirm }) => {
  const { t } = useTranslation()
  const { pdfSettings } = useSettings()
  const [pageRange, setPageRange] = useState<string>(
    pdfSettings?.defaultPageRangePrompt || t('pdf.page_range_placeholder')
  )
  const [totalPages, setTotalPages] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [processing, setProcessing] = useState<boolean>(false)
  // 页面选择相关状态在 PDFPreview 组件中实现

  // 强制重新加载翻译
  useEffect(() => {
    if (visible) {
      console.log('[PDFSplitter] Reloading translations')
      reloadTranslations()
    }
  }, [visible])

  useEffect(() => {
    const loadPdf = async () => {
      console.log('[PDFSplitter] loadPdf called, visible:', visible, 'file:', file)
      if (visible && file) {
        setLoading(true)
        try {
          console.log('[PDFSplitter] Loading PDF file:', file.path)

          // 使用文件路径直接加载PDF
          console.log('[PDFSplitter] Using PDFService to split PDF')

          // 尝试从文件属性中获取页数
          if (file.pdf_page_count) {
            console.log('[PDFSplitter] Using page count from file properties:', file.pdf_page_count)
            setTotalPages(file.pdf_page_count)
            setLoading(false)
          } else {
            // 如果文件属性中没有页数信息，则使用默认值
            // 注意：如果应用程序没有重新加载，getPageCount方法可能不可用
            console.log('[PDFSplitter] No page count in file properties, checking if getPageCount is available')

            if (window.api.pdf.getPageCount && typeof window.api.pdf.getPageCount === 'function') {
              console.log('[PDFSplitter] getPageCount method is available, fetching from server')
              try {
                window.api.pdf
                  .getPageCount(file.path)
                  .then((pageCount: number) => {
                    console.log('[PDFSplitter] Got page count from server:', pageCount)
                    setTotalPages(pageCount)
                    // 更新文件属性，以便下次使用
                    file.pdf_page_count = pageCount
                  })
                  .catch((error: unknown) => {
                    console.error('[PDFSplitter] Error getting page count:', error)
                    // 如果出错，使用默认值
                    const defaultPages = 100
                    console.log('[PDFSplitter] Using default page count:', defaultPages)
                    setTotalPages(defaultPages)
                  })
                  .finally(() => {
                    setLoading(false)
                  })
              } catch (error) {
                console.error('[PDFSplitter] Error calling getPageCount:', error)
                const defaultPages = 100
                console.log('[PDFSplitter] Using default page count:', defaultPages)
                setTotalPages(defaultPages)
                setLoading(false)
              }
            } else {
              console.log('[PDFSplitter] getPageCount method is not available, using default value')
              const defaultPages = 100
              console.log('[PDFSplitter] Using default page count:', defaultPages)
              setTotalPages(defaultPages)
              setLoading(false)
            }
          }
          // Loading state will be set in the finally block
        } catch (error) {
          console.error('[PDFSplitter] Error loading PDF:', error)
          message.error(t('error.unknown'))
          onCancel()
        }
      }
    }

    loadPdf()
  }, [visible, file, onCancel, t])

  // 处理预览按钮点击
  const handlePreview = () => {
    console.log('[PDFSplitter] handlePreview called, file:', file)
    // 使用系统默认的 PDF 查看器打开 PDF 文件
    window.api.file
      .openPath(file.path)
      .then(() => {
        console.log('[PDFSplitter] PDF file opened successfully')
      })
      .catch((error: unknown) => {
        console.error('[PDFSplitter] Error opening PDF file:', error)
        message.error(t('error.unknown'))
      })
  }

  const handleConfirm = async () => {
    console.log('[PDFSplitter] handleConfirm called, pageRange:', pageRange, 'totalPages:', totalPages)
    if (!validatePageRange(pageRange, totalPages)) {
      console.log('[PDFSplitter] Invalid page range')
      message.error(t('settings.pdf.invalid_range'))
      return
    }

    setProcessing(true)
    try {
      console.log('[PDFSplitter] Processing PDF with page range:', pageRange)
      console.log('[PDFSplitter] File to process:', file)
      // 将页码范围传递给父组件，实际的PDF分割将在主进程中完成
      onConfirm(file, pageRange)
      console.log('[PDFSplitter] onConfirm called successfully')
    } catch (error) {
      console.error('[PDFSplitter] Error processing PDF:', error)
      message.error(t('error.unknown'))
    } finally {
      setProcessing(false)
    }
  }

  // 验证页码范围格式
  const validatePageRange = (range: string, total: number): boolean => {
    console.log('[PDFSplitter] Validating page range:', range, 'total pages:', total)
    if (!range.trim()) {
      console.log('[PDFSplitter] Empty page range')
      return false
    }

    try {
      // 支持的格式: 1,2,3-5,7-9
      const parts = range.split(',')
      console.log('[PDFSplitter] Page range parts:', parts)

      for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed) {
          console.log('[PDFSplitter] Empty part, skipping')
          continue
        }

        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map((n) => parseInt(n.trim()))
          console.log('[PDFSplitter] Range part:', trimmed, 'start:', start, 'end:', end)
          if (isNaN(start) || isNaN(end) || start < 1 || end > total || start > end) {
            console.log('[PDFSplitter] Invalid range part:', trimmed, 'start:', start, 'end:', end)
            return false
          }
        } else {
          const page = parseInt(trimmed)
          console.log('[PDFSplitter] Single page:', page)
          if (isNaN(page) || page < 1 || page > total) {
            console.log('[PDFSplitter] Invalid page number:', page)
            return false
          }
        }
      }

      console.log('[PDFSplitter] Page range is valid')
      return true
    } catch (error) {
      console.error('[PDFSplitter] Error validating page range:', error)
      return false
    }
  }

  return (
    <Modal title={t('settings.pdf.split')} open={visible} onCancel={onCancel} footer={null} destroyOnClose>
      {loading ? (
        <LoadingContainer>
          <Spin size="large" />
        </LoadingContainer>
      ) : (
        <Container>
          <FileInfo>
            <div>{file.name}</div>
            <div>{t('settings.pdf.total_pages', { count: totalPages })}</div>
          </FileInfo>

          <InputContainer>
            <label>{t('settings.pdf.page_range')}</label>
            <Input
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              placeholder={t('settings.pdf.page_range_placeholder')}
            />
          </InputContainer>

          <ButtonContainer>
            <div>
              <Button onClick={handlePreview}>{t('settings.pdf.preview')}</Button>
            </div>
            <div>
              <Button onClick={onCancel}>{t('settings.pdf.cancel')}</Button>
              <Button type="primary" onClick={handleConfirm} loading={processing} style={{ marginLeft: '8px' }}>
                {processing ? t('settings.pdf.processing') : t('settings.pdf.confirm')}
              </Button>
            </div>
          </ButtonContainer>
        </Container>
      )}
    </Modal>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
`

const FileInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background-color: var(--color-bg-2);
  border-radius: 4px;
`

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
`

export default PDFSplitter
