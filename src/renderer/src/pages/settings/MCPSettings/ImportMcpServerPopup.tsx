import { InboxOutlined } from '@ant-design/icons'
import { nanoid } from '@reduxjs/toolkit'
import { TopView } from '@renderer/components/TopView'
import { useMCPServers } from '@renderer/hooks/useMCPServers'
import { MCPServer } from '@renderer/types'
import { Input, Modal, Space, Typography, Upload } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Dragger } = Upload
const { TextArea } = Input
const { Text } = Typography

interface Props {
  resolve: (data: any) => void
}

const PopupContainer: React.FC<Props> = ({ resolve }) => {
  const [open, setOpen] = useState(true)
  const [jsonConfig, setJsonConfig] = useState('')
  const [jsonSaving, setJsonSaving] = useState(false)
  const [jsonError, setJsonError] = useState('')
  const { addMCPServer } = useMCPServers()
  const { t } = useTranslation()

  const onOk = async () => {
    setJsonSaving(true)

    try {
      if (!jsonConfig.trim()) {
        setJsonError(t('settings.mcp.jsonRequired'))
        setJsonSaving(false)
        return
      }

      const parsedConfig = JSON.parse(jsonConfig)

      // 处理两种可能的格式：
      // 1. 单个服务器配置: { "command": "npx", ... }
      // 2. mcpServers 格式: { "mcpServers": { "serverId": { ... } } }

      if (parsedConfig.mcpServers && typeof parsedConfig.mcpServers === 'object') {
        // 处理 mcpServers 格式
        const serverEntries = Object.entries(parsedConfig.mcpServers)
        if (serverEntries.length === 0) {
          throw new Error(t('settings.mcp.noServerFound'))
        }

        // 只导入第一个服务器
        const [id, serverConfig] = serverEntries[0]

        const server: MCPServer = {
          id: nanoid(), // 生成新ID，避免与现有服务器冲突
          isActive: false,
          ...(serverConfig as any)
        }

        if (!server.name) {
          server.name = id
        }

        addMCPServer(server)
        window.message.success(t('settings.mcp.importSuccess'))
        setOpen(false)
        resolve({})
        TopView.hide(TopViewKey)
      } else if (typeof parsedConfig === 'object') {
        // 处理单个服务器配置
        const server: MCPServer = {
          id: nanoid(),
          name: parsedConfig.name || t('settings.mcp.importedServer'),
          isActive: false,
          ...parsedConfig
        }

        addMCPServer(server)
        window.message.success(t('settings.mcp.importSuccess'))
        setOpen(false)
        resolve({})
        TopView.hide(TopViewKey)
      } else {
        throw new Error(t('settings.mcp.invalidServerFormat'))
      }
    } catch (error: any) {
      console.error('Failed to import MCP server config:', error)
      setJsonError(error.message || t('settings.mcp.jsonImportError'))
      window.message.error(t('settings.mcp.jsonImportError'))
    } finally {
      setJsonSaving(false)
    }
  }

  const onCancel = () => {
    setOpen(false)
    resolve({})
    TopView.hide(TopViewKey)
  }

  const onClose = () => {
    resolve({})
  }

  const handleFileUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        setJsonConfig(content)
        setJsonError('')
      } catch (error) {
        console.error('Error reading file:', error)
        setJsonError(t('settings.mcp.fileReadError'))
      }
    }
    reader.readAsText(file)
    return false // 阻止默认上传行为
  }

  ImportMcpServerPopup.hide = onCancel

  return (
    <Modal
      title={t('settings.mcp.importServer')}
      open={open}
      onOk={onOk}
      okText={t('settings.mcp.import')}
      confirmLoading={jsonSaving}
      onCancel={onCancel}
      afterClose={onClose}
      width={600}
      centered>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>{t('settings.mcp.importServerDesc')}</Text>

        <Dragger accept=".json" showUploadList={false} beforeUpload={handleFileUpload} style={{ marginBottom: 16 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('settings.mcp.dropJsonFile')}</p>
          <p className="ant-upload-hint">{t('settings.mcp.clickOrDrop')}</p>
        </Dragger>

        <Text>{t('settings.mcp.orPasteJson')}</Text>

        <TextArea
          value={jsonConfig}
          onChange={(e) => {
            setJsonConfig(e.target.value)
            setJsonError('')
          }}
          placeholder={`{
  "name": "my-mcp-server",
  "command": "npx",
  "args": ["-y", "@example/mcp-server"],
  "type": "stdio"
}`}
          style={{
            width: '100%',
            fontFamily: 'monospace',
            minHeight: '200px'
          }}
        />

        {jsonError && <ErrorText>{jsonError}</ErrorText>}

        <Text type="secondary">{t('settings.mcp.importModeHint')}</Text>
      </Space>
    </Modal>
  )
}

const ErrorText = styled(Text)`
  color: #ff4d4f;
  display: block;
  margin-top: 8px;
`

const TopViewKey = 'ImportMcpServerPopup'

export default class ImportMcpServerPopup {
  static topviewId = 0
  static hide() {
    TopView.hide(TopViewKey)
  }
  static show() {
    return new Promise<any>((resolve) => {
      TopView.show(
        <PopupContainer
          resolve={(v) => {
            resolve(v)
            TopView.hide(TopViewKey)
          }}
        />,
        TopViewKey
      )
    })
  }
}
