import PDFSplitter from '@renderer/components/PDFSplitter'
import { isVisionModel } from '@renderer/config/models'
import { useSettings } from '@renderer/hooks/useSettings'
import { setPdfSettings } from '@renderer/store/settings'
import { FileType, Model } from '@renderer/types'
import { documentExts, imageExts, textExts } from '@shared/config/constant'
import { Tooltip } from 'antd'
import { Paperclip } from 'lucide-react'
import { FC, useCallback, useImperativeHandle, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'

export interface AttachmentButtonRef {
  openQuickPanel: () => void
  handlePdfFile: (file: FileType) => boolean
}

interface Props {
  ref?: React.RefObject<AttachmentButtonRef | null>
  model: Model
  files: FileType[]
  setFiles: (files: FileType[]) => void
  ToolbarButton: any
  disabled?: boolean
}

const AttachmentButton: FC<Props> = ({ ref, model, files, setFiles, ToolbarButton, disabled }) => {
  const { t } = useTranslation()
  const { pdfSettings } = useSettings()
  const dispatch = useDispatch()
  const [pdfSplitterVisible, setPdfSplitterVisible] = useState(false)
  const [selectedPdfFile, setSelectedPdfFile] = useState<FileType | null>(null)

  const extensions = useMemo(
    () => (isVisionModel(model) ? [...imageExts, ...documentExts, ...textExts] : [...documentExts, ...textExts]),
    [model]
  )

  // 强制初始化PDF设置
  const forcePdfSettingsInitialization = useCallback(() => {
    console.log('[AttachmentButton] Forcing PDF settings initialization')
    // 如果pdfSettings为undefined或缺少enablePdfSplitting属性，则使用默认值初始化
    if (!pdfSettings || pdfSettings.enablePdfSplitting === undefined) {
      const defaultPdfSettings = {
        enablePdfSplitting: true,
        defaultPageRangePrompt: '输入页码范围，例如：1-5,8,10-15'
      }

      console.log('[AttachmentButton] Dispatching setPdfSettings with:', defaultPdfSettings)
      dispatch(setPdfSettings(defaultPdfSettings))
      return defaultPdfSettings
    }

    return pdfSettings
  }, [dispatch, pdfSettings])

  const handlePdfFile = useCallback(
    (file: FileType) => {
      console.log('[AttachmentButton] handlePdfFile called with file:', file)

      // 强制初始化PDF设置
      const settings = forcePdfSettingsInitialization()
      console.log('[AttachmentButton] PDF settings after initialization:', settings)

      if (settings.enablePdfSplitting && file.ext.toLowerCase() === '.pdf') {
        console.log('[AttachmentButton] PDF splitting enabled, showing splitter dialog')
        setSelectedPdfFile(file)
        setPdfSplitterVisible(true)
        return true // 返回true表示我们已经处理了这个文件
      }
      console.log('[AttachmentButton] PDF splitting disabled or not a PDF file, returning false')
      return false // 返回false表示这个文件需要正常处理
    },
    [forcePdfSettingsInitialization]
  )

  const handlePdfSplitterConfirm = useCallback(
    async (file: FileType, pageRange: string) => {
      console.log('[AttachmentButton] handlePdfSplitterConfirm called with file:', file, 'pageRange:', pageRange)
      try {
        // 调用主进程的PDF分割功能
        console.log('[AttachmentButton] Calling window.api.pdf.splitPDF')
        const newFile = await window.api.pdf.splitPDF(file, pageRange)
        console.log('[AttachmentButton] PDF split successful, new file:', newFile)
        setFiles([...files, newFile])
        setPdfSplitterVisible(false)
        setSelectedPdfFile(null)
      } catch (error) {
        console.error('[AttachmentButton] Error splitting PDF:', error)
        window.message.error({
          content: t('pdf.error_splitting'),
          key: 'pdf-error-splitting'
        })
      }
    },
    [files, setFiles, t]
  )

  const onSelectFile = useCallback(async () => {
    // 强制初始化PDF设置
    const settings = forcePdfSettingsInitialization()
    console.log('[AttachmentButton] PDF settings before file selection:', settings)

    const _files = await window.api.file.select({
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Files',
          extensions: extensions.map((i) => i.replace('.', ''))
        }
      ]
    })

    if (_files) {
      // 检查是否有PDF文件需要特殊处理
      const pdfFiles = _files.filter((file) => file.ext.toLowerCase() === '.pdf')
      const nonPdfFiles = _files.filter((file) => file.ext.toLowerCase() !== '.pdf')

      // 添加非PDF文件
      if (nonPdfFiles.length > 0) {
        setFiles([...files, ...nonPdfFiles])
      }

      // 处理PDF文件
      if (pdfFiles.length > 0) {
        console.log('[AttachmentButton] PDF files selected:', pdfFiles)
        console.log('[AttachmentButton] PDF settings after initialization:', settings)

        if (settings.enablePdfSplitting === true) {
          console.log('[AttachmentButton] PDF splitting is enabled')
          // 如果有多个PDF文件，只处理第一个
          setSelectedPdfFile(pdfFiles[0])
          setPdfSplitterVisible(true)
          console.log('[AttachmentButton] Set PDF splitter visible with file:', pdfFiles[0])

          // 如果有多个PDF文件，提示用户一次只能处理一个PDF文件
          if (pdfFiles.length > 1) {
            console.log('[AttachmentButton] Multiple PDF files selected, showing info message')
            window.message.info({
              content: t('pdf.one_at_a_time'),
              key: 'pdf-one-at-a-time'
            })
          }
        } else {
          console.log('[AttachmentButton] PDF splitting is disabled, adding all PDF files')
          // 如果未启用PDF分割功能，直接添加所有PDF文件
          setFiles([...files, ...pdfFiles])
        }
      }
    }
  }, [extensions, files, setFiles, forcePdfSettingsInitialization, t])

  const openQuickPanel = useCallback(() => {
    onSelectFile()
  }, [onSelectFile])

  useImperativeHandle(ref, () => ({
    openQuickPanel,
    handlePdfFile
  }))

  return (
    <>
      <Tooltip
        placement="top"
        title={isVisionModel(model) ? t('chat.input.upload') : t('chat.input.upload.document')}
        arrow>
        <ToolbarButton type="text" onClick={onSelectFile} disabled={disabled}>
          <Paperclip size={18} style={{ color: files.length ? 'var(--color-primary)' : 'var(--color-icon)' }} />
        </ToolbarButton>
      </Tooltip>

      {selectedPdfFile && (
        <PDFSplitter
          file={selectedPdfFile}
          visible={pdfSplitterVisible}
          onCancel={() => {
            setPdfSplitterVisible(false)
            setSelectedPdfFile(null)
          }}
          onConfirm={handlePdfSplitterConfirm}
        />
      )}
    </>
  )
}

export default AttachmentButton
