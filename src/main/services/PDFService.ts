import { getFileType } from '@main/utils/file'
import { FileType } from '@types'
import { app } from 'electron'
import logger from 'electron-log'
import * as fs from 'fs'
import * as path from 'path'
import { PDFDocument } from 'pdf-lib'
import { v4 as uuidv4 } from 'uuid'

export class PDFService {
  // 使用方法而不是静态属性来获取目录路径
  private static getTempDir(): string {
    return path.join(app.getPath('temp'), 'CherryStudio')
  }

  private static getStorageDir(): string {
    return path.join(app.getPath('userData'), 'files')
  }

  // 引入需要的模块
  private static docx: any
  private static pdfParse: any

  // 懒加载模块
  private static async loadModules() {
    if (!this.docx) {
      try {
        this.docx = require('docx')
      } catch (error) {
        logger.error('[PDFService] Error loading docx module:', error)
        throw new Error('无法加载docx模块，请确保已安装')
      }
    }

    if (!this.pdfParse) {
      try {
        this.pdfParse = require('pdf-parse')
      } catch (error) {
        logger.error('[PDFService] Error loading pdf-parse module:', error)
        throw new Error('无法加载pdf-parse模块，请确保已安装')
      }
    }
  }

  /**
   * 获取PDF文件的页数
   * @param _ Electron IPC事件
   * @param filePath PDF文件路径
   * @returns PDF文件的页数
   */
  static async getPDFPageCount(_: Electron.IpcMainInvokeEvent, filePath: string): Promise<number> {
    try {
      logger.info(`[PDFService] Getting page count for PDF: ${filePath}`)
      const pdfBytes = fs.readFileSync(filePath)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      const pageCount = pdfDoc.getPageCount()
      logger.info(`[PDFService] PDF page count: ${pageCount}`)
      return pageCount
    } catch (error) {
      logger.error('[PDFService] Error getting PDF page count:', error)
      throw error
    }
  }

  /**
   * 分割PDF文件
   * @param _ Electron IPC事件
   * @param file 原始PDF文件
   * @param pageRange 页码范围，例如：1-5,8,10-15
   * @returns 分割后的PDF文件信息
   */
  static async splitPDF(_: Electron.IpcMainInvokeEvent, file: FileType, pageRange: string): Promise<FileType> {
    try {
      logger.info(`[PDFService] Splitting PDF: ${file.path}, page range: ${pageRange}`)
      logger.info(`[PDFService] File details:`, JSON.stringify(file))

      // 确保临时目录存在
      const tempDir = PDFService.getTempDir()
      if (!fs.existsSync(tempDir)) {
        logger.info(`[PDFService] Creating temp directory: ${tempDir}`)
        fs.mkdirSync(tempDir, { recursive: true })
      }

      // 确保存储目录存在
      const storageDir = PDFService.getStorageDir()
      if (!fs.existsSync(storageDir)) {
        logger.info(`[PDFService] Creating storage directory: ${storageDir}`)
        fs.mkdirSync(storageDir, { recursive: true })
      }

      // 读取原始PDF文件
      logger.info(`[PDFService] Reading PDF file: ${file.path}`)
      const pdfBytes = fs.readFileSync(file.path)
      logger.info(`[PDFService] PDF file read, size: ${pdfBytes.length} bytes`)
      const pdfDoc = await PDFDocument.load(pdfBytes)
      logger.info(`[PDFService] PDF document loaded, page count: ${pdfDoc.getPageCount()}`)

      // 创建新的PDF文档
      const newPdfDoc = await PDFDocument.create()
      logger.info(`[PDFService] New PDF document created`)

      // 解析页码范围
      const pageIndexes = this.parsePageRange(pageRange, pdfDoc.getPageCount())
      logger.info(`[PDFService] Page range parsed, indexes: ${pageIndexes.join(', ')}`)

      // 复制指定页面到新文档
      const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndexes)
      logger.info(`[PDFService] Pages copied, count: ${copiedPages.length}`)
      copiedPages.forEach((page, index) => {
        logger.info(`[PDFService] Adding page ${index + 1} to new document`)
        newPdfDoc.addPage(page)
      })

      // 保存新文档
      logger.info(`[PDFService] Saving new PDF document`)
      const newPdfBytes = await newPdfDoc.save()
      logger.info(`[PDFService] New PDF document saved, size: ${newPdfBytes.length} bytes`)

      // 生成新文件ID和路径
      const uuid = uuidv4()
      const ext = '.pdf'
      // 使用之前已经声明的storageDir变量
      const destPath = path.join(storageDir, uuid + ext)
      logger.info(`[PDFService] Destination path: ${destPath}`)

      // 写入新文件
      logger.info(`[PDFService] Writing new PDF file`)
      fs.writeFileSync(destPath, newPdfBytes)
      logger.info(`[PDFService] New PDF file written`)

      // 获取文件状态
      const stats = fs.statSync(destPath)
      logger.info(`[PDFService] File stats: size=${stats.size}, created=${stats.birthtime}`)

      // 创建新文件信息
      const newFile: FileType = {
        id: uuid,
        origin_name: `${path.basename(file.origin_name, '.pdf')}_pages_${pageRange}.pdf`,
        name: uuid + ext,
        path: destPath,
        created_at: stats.birthtime.toISOString(),
        size: stats.size,
        ext: ext,
        type: getFileType(ext),
        count: 1,
        pdf_page_range: pageRange
      }

      logger.info(`[PDFService] PDF split successful: ${newFile.path}`)
      logger.info(`[PDFService] New file details:`, JSON.stringify(newFile))
      return newFile
    } catch (error) {
      logger.error('[PDFService] Error splitting PDF:', error)
      throw error
    }
  }

  /**
   * 解析页码范围字符串为页码索引数组
   * @param pageRange 页码范围字符串，例如：1-5,8,10-15
   * @param totalPages PDF文档总页数
   * @returns 页码索引数组（从0开始）
   */
  private static parsePageRange(pageRange: string, totalPages: number): number[] {
    logger.info(`[PDFService] Parsing page range: ${pageRange}, total pages: ${totalPages}`)
    const pageIndexes: number[] = []
    const parts = pageRange.split(',')
    logger.info(`[PDFService] Page range parts: ${JSON.stringify(parts)}`)

    try {
      for (const part of parts) {
        const trimmed = part.trim()
        if (!trimmed) {
          logger.info(`[PDFService] Empty part, skipping`)
          continue
        }

        logger.info(`[PDFService] Processing part: ${trimmed}`)

        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-')
          const start = parseInt(startStr.trim())
          const end = parseInt(endStr.trim())
          logger.info(`[PDFService] Range part: ${trimmed}, start: ${start}, end: ${end}`)

          if (isNaN(start) || isNaN(end)) {
            logger.error(`[PDFService] Invalid range part (NaN): ${trimmed}`)
            continue
          }

          if (start < 1 || end > totalPages || start > end) {
            logger.warn(`[PDFService] Invalid range: ${start}-${end}, totalPages: ${totalPages}`)
            continue
          }

          for (let i = start; i <= end; i++) {
            pageIndexes.push(i - 1) // PDF页码从0开始，但用户输入从1开始
            logger.info(`[PDFService] Added page index: ${i - 1} (page ${i})`)
          }
        } else {
          const page = parseInt(trimmed)
          logger.info(`[PDFService] Single page: ${page}`)

          if (isNaN(page)) {
            logger.error(`[PDFService] Invalid page number (NaN): ${trimmed}`)
            continue
          }

          if (page < 1 || page > totalPages) {
            logger.warn(`[PDFService] Page ${page} out of range, totalPages: ${totalPages}`)
            continue
          }

          pageIndexes.push(page - 1) // PDF页码从0开始，但用户输入从1开始
          logger.info(`[PDFService] Added page index: ${page - 1} (page ${page})`)
        }
      }

      // 去重并排序
      const result = [...new Set(pageIndexes)].sort((a, b) => a - b)
      logger.info(`[PDFService] Final page indexes: ${result.join(', ')}`)
      return result
    } catch (error) {
      logger.error(`[PDFService] Error parsing page range: ${error}`)
      // 如果解析出错，返回空数组
      return []
    }
  }

  /**
   * 将PDF转换为Word文档
   * @param _ Electron IPC事件
   * @param params 包含PDF缓冲区和输出路径的参数
   * @returns 转换结果
   */
  static async toWord(_: Electron.IpcMainInvokeEvent, params: { pdfBuffer: ArrayBuffer, outputPath?: string }): Promise<{ success: boolean, path?: string, error?: string }> {
    try {
      logger.info('[PDFService] Starting PDF to Word conversion')

      // 加载必要的模块
      await this.loadModules()

      const { pdfBuffer, outputPath } = params

      // 将ArrayBuffer转换为Buffer
      const buffer = Buffer.from(pdfBuffer)

      // 解析PDF文本
      logger.info('[PDFService] Parsing PDF text')

      // 使用更高级的选项来提取文本
      const pdfData = await this.pdfParse(buffer, {
        // 使用自定义的渲染器来提取文本
        pagerender: function(pageData) {
          // 检查页面数据是否有效
          if (!pageData || !pageData.getTextContent) {
            logger.warn('[PDFService] Invalid page data or getTextContent method not available');
            return Promise.resolve('');
          }

          // 记录页面信息
          logger.info(`[PDFService] Processing page ${pageData.pageIndex + 1}`);

          return pageData.getTextContent({
            // 启用更多选项以获取更好的文本提取结果
            normalizeWhitespace: true,
            disableCombineTextItems: false
          }).then(function(textContent: { items: Array<{ str?: string, transform?: number[], width?: number }> }) {
            // 记录文本内容项目数
            logger.info(`[PDFService] Page ${pageData.pageIndex + 1} has ${textContent.items.length} text items`);

            if (textContent.items.length === 0) {
              logger.warn(`[PDFService] No text items found on page ${pageData.pageIndex + 1}`);
              return '';
            }

            let lastY: number | null = null;
            let lastX: number | null = null;
            let text = '';

            // 处理文本内容
            for (const item of textContent.items) {
              // 确保 item 有 str 属性且不为空
              if ('str' in item && item.str && item.str.trim().length > 0 && item.transform && item.transform.length >= 6) {
                const x = item.transform[4];
                const y = item.transform[5];

                // 根据Y坐标判断是否是新行
                if (lastY !== null && Math.abs(lastY - y) > 5) {
                  text += '\n';
                  lastX = null; // 重置X坐标
                }
                // 根据X坐标判断是否需要添加空格
                else if (lastX !== null && text.length > 0 &&
                         text[text.length - 1] !== ' ' &&
                         item.str[0] !== ' ' &&
                         x - lastX > 10) { // 如果X坐标差距较大，添加空格
                  text += ' ';
                }

                text += item.str;
                lastY = y;
                lastX = x + (item.width || 0);
              }
            }

            // 记录提取的文本长度
            logger.info(`[PDFService] Extracted ${text.length} characters from page ${pageData.pageIndex + 1}`);

            return text;
          }).catch(function(error: Error) {
            logger.error(`[PDFService] Error extracting text from page ${pageData.pageIndex + 1}:`, error);
            return '';
          });
        }
      });

      // 获取提取的文本
      const pdfText = pdfData.text;

      // 记录提取的文本长度
      logger.info(`[PDFService] Extracted text length: ${pdfText.length}`);

      // 如果文本太短，可能是提取失败
      if (pdfText.length < 10) {
        logger.warn(`[PDFService] Extracted text is too short: "${pdfText}"`);
      } else {
        // 记录提取的文本的前100个字符，用于调试
        logger.info(`[PDFService] First 100 characters of extracted text: "${pdfText.substring(0, 100).replace(/\n/g, '\\n')}..."`);
      }

      // 记录PDF的元数据
      if (pdfData.info) {
        logger.info(`[PDFService] PDF metadata:`, JSON.stringify(pdfData.info));
      }

      // 记录PDF的页数
      logger.info(`[PDFService] PDF page count: ${pdfData.numpages}`);

      // 记录PDF的版本
      if (pdfData.pdfInfo && pdfData.pdfInfo.version) {
        logger.info(`[PDFService] PDF version: ${pdfData.pdfInfo.version}`);
      }

      // 创建Word文档
      logger.info('[PDFService] Creating Word document')
      const { Document, Packer, Paragraph, TextRun } = this.docx

      // 将PDF文本分割成段落，使用更智能的分割方法
      const paragraphs = pdfText
        .split(/\n{2,}/)  // 使用两个或更多换行符分割段落
        .map((p: string) => p.replace(/\n/g, ' ').trim())  // 将段落内的换行符替换为空格
        .filter((p: string) => p.length > 0);  // 过滤掉空段落

      // 创建Word文档对象
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs.map((text: string) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: text.trim(),
                    size: 24 // 12pt
                  })
                ]
              })
            )
          }
        ]
      })

      // 生成Word文档
      logger.info('[PDFService] Generating Word document buffer')
      const docBuffer = await Packer.toBuffer(doc)

      // 确定输出路径
      let finalOutputPath = outputPath

      // 如果没有提供输出路径，则使用对话框让用户选择保存位置
      if (!finalOutputPath) {
        const { dialog } = require('electron')
        const result = await dialog.showSaveDialog({
          title: '保存Word文档',
          defaultPath: 'converted-document.docx',
          filters: [{ name: 'Word文档', extensions: ['docx'] }]
        })

        if (result.canceled) {
          logger.info('[PDFService] User canceled save dialog')
          return { success: false, error: '用户取消了保存' }
        }

        finalOutputPath = result.filePath
      }

      // 保存Word文档
      if (!finalOutputPath) {
        logger.error('[PDFService] Output path is undefined')
        return {
          success: false,
          error: '输出路径未定义'
        }
      }

      logger.info(`[PDFService] Saving Word document to: ${finalOutputPath}`)
      fs.writeFileSync(finalOutputPath, docBuffer)

      logger.info('[PDFService] PDF to Word conversion completed successfully')
      return {
        success: true,
        path: finalOutputPath
      }
    } catch (error) {
      logger.error('[PDFService] Error converting PDF to Word:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}
