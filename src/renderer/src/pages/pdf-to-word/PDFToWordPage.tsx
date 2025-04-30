import { Navbar, NavbarCenter } from '@renderer/components/app/Navbar'
import { Button, Card, Empty, message, Space, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'
import { FC, useState } from 'react'
import styled from 'styled-components'
import type { UploadFile, UploadProps } from 'antd/es/upload/interface'

// 使用主进程的 PDF 服务来处理 PDF 转 Word
// 不再使用 pdfjs-dist 库

const PDFToWordPage: FC = () => {
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [converting, setConverting] = useState<boolean>(false)
  const [messageApi, contextHolder] = message.useMessage()

  // 不再需要设置 PDF.js worker 路径

  // 处理文件上传
  const handleUploadChange: UploadProps['onChange'] = (info) => {
    let newFileList = [...info.fileList]

    // 限制只能上传一个文件
    newFileList = newFileList.slice(-1)

    // 只接受PDF文件
    newFileList = newFileList.filter(file => {
      if (file.type === 'application/pdf') {
        return true
      }
      if (file.name.toLowerCase().endsWith('.pdf')) {
        return true
      }
      messageApi.error('只能上传PDF文件')
      return false
    })

    setFileList(newFileList)
  }

  // 我们不再需要单独提取 PDF 文本，直接使用 toWord 方法

  // 处理文件转换
  const handleConvert = async () => {
    if (fileList.length === 0) {
      messageApi.error('请先上传PDF文件')
      return
    }

    try {
      console.log('开始转换PDF到Word...');
      setConverting(true)
      messageApi.loading('正在转换中...')

      // 获取文件对象
      const file = fileList[0]
      console.log('文件信息:', {
        name: file.name,
        size: file.size,
        type: file.type,
        uid: file.uid
      });

      const fileObj = file.originFileObj
      if (!fileObj) {
        throw new Error('无法获取文件对象')
      }
      console.log('已获取文件对象');

      // 读取文件内容
      console.log('开始读取文件内容...');
      const arrayBuffer = await fileObj.arrayBuffer()
      console.log(`文件内容已读取，大小: ${arrayBuffer.byteLength} 字节`);

      // 使用主进程的 PDF 服务进行转换
      messageApi.loading('正在解析PDF并创建Word文档...')
      console.log('调用主进程的 PDF 服务...');

      // 保存文件
      let finalPath = null;

      try {
        // 使用保存对话框让用户选择保存位置
        finalPath = await window.api.file.save(
          fileList[0].name.replace(/\.pdf$/i, '.docx') || 'document.docx',
          ''
        )

        if (!finalPath) {
          messageApi.info('已取消保存')
          return
        }

        // 调用主进程的 PDF 转 Word 服务
        const result = await window.api.pdf.toWord(arrayBuffer, finalPath)

        if (!result.success) {
          throw new Error(result.error || '转换失败')
        }

        console.log('Word文档创建成功');
        messageApi.success('转换成功！')
      } catch (exportError) {
        console.error('创建Word文档失败:', exportError);
        throw new Error('创建Word文档失败: ' + (exportError instanceof Error ? exportError.message : String(exportError)))
      }
    } catch (error) {
      console.error('转换失败:', error)
      messageApi.error('转换失败: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setConverting(false)
    }
  }

  // 我们不再需要选择输出路径的函数

  return (
    <Container>
      {contextHolder}
      <Navbar>
        <NavbarCenter>PDF转Word工具</NavbarCenter>
      </Navbar>
      <Content>
        <Card title="PDF转Word转换器" style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Upload
              fileList={fileList}
              onChange={handleUploadChange}
              beforeUpload={() => false}
              maxCount={1}
              accept=".pdf"
            >
              <Button icon={<UploadOutlined />}>选择PDF文件</Button>
            </Upload>

            {fileList.length > 0 ? (
              <Button
                type="primary"
                onClick={handleConvert}
                loading={converting}
                disabled={converting}
                style={{ marginTop: 16 }}
              >
                开始转换
              </Button>
            ) : (
              <Empty description="请上传PDF文件" style={{ margin: '20px 0' }} />
            )}
          </Space>
        </Card>
      </Content>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 24px;
  overflow-y: auto;
`

export default PDFToWordPage
