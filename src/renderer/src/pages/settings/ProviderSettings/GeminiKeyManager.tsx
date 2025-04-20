import { CopyOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { formatApiKeys } from '@renderer/services/ApiService'
import { Provider } from '@renderer/types'
import { maskApiKey } from '@renderer/utils/api'
import { Button, Input, Modal, Space, Typography, Upload } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const { Text } = Typography

interface GeminiKeyManagerProps {
  provider: Provider
  currentApiKey: string
  onApiKeyChange: (newApiKey: string) => void
}

const GeminiKeyManager: React.FC<GeminiKeyManagerProps> = ({ currentApiKey, onApiKeyChange }) => {
  const { t } = useTranslation()
  const [isAddKeyModalVisible, setIsAddKeyModalVisible] = useState(false)
  const [isImportModalVisible, setIsImportModalVisible] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [importText, setImportText] = useState('')

  // 当前密钥列表
  const currentKeys = currentApiKey.split(',').filter((key) => key.trim() !== '')

  // 添加新密钥
  const handleAddKey = () => {
    if (!newKey.trim()) return

    const formattedKey = newKey.trim()
    const keys = [...currentKeys, formattedKey]
    const uniqueKeys = [...new Set(keys)]
    const newApiKey = uniqueKeys.join(',')

    // Only update if the value has actually changed
    if (newApiKey !== currentApiKey) {
      onApiKeyChange(newApiKey)
    }

    setNewKey('')
    setIsAddKeyModalVisible(false)
  }

  // 批量导入密钥
  const handleImportKeys = () => {
    if (!importText.trim()) return

    const importedKeys = importText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')

    const allKeys = [...currentKeys, ...importedKeys]
    const uniqueKeys = [...new Set(allKeys)]
    const newApiKey = uniqueKeys.join(',')

    // 只有当值确实发生变化时才更新
    if (newApiKey !== currentApiKey) {
      onApiKeyChange(newApiKey)
    }

    setImportText('')
    setIsImportModalVisible(false)
  }

  // 从文件导入密钥
  const handleFileImport = (info: any) => {
    const file = info.file.originFileObj
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      if (content) {
        setImportText(content)
      }
    }
    reader.readAsText(file)
  }

  // 复制密钥到剪贴板
  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    window.message.success({
      content: t('common.copied'),
      duration: 2
    })
  }

  return (
    <>
      <KeyManagerContainer>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsAddKeyModalVisible(true)}>
            {t('settings.provider.gemini.add_key')}
          </Button>
          <Button icon={<UploadOutlined />} onClick={() => setIsImportModalVisible(true)}>
            {t('settings.provider.gemini.import_keys')}
          </Button>
        </Space>

        <KeyCountInfo>
          {currentKeys.length > 0 && (
            <Text type="secondary">{t('settings.provider.gemini.key_count', { count: currentKeys.length })}</Text>
          )}
        </KeyCountInfo>
      </KeyManagerContainer>

      {/* 显示密钥列表 */}
      {currentKeys.length > 0 && (
        <KeysListContainer>
          {currentKeys.map((key, index) => (
            <KeyItem key={index}>
              <Text>{maskApiKey(key)}</Text>
              <Button type="text" icon={<CopyOutlined />} onClick={() => copyKey(key)} />
            </KeyItem>
          ))}
        </KeysListContainer>
      )}

      {/* 添加新密钥的模态框 */}
      <Modal
        title={t('settings.provider.gemini.add_key_title')}
        open={isAddKeyModalVisible}
        onOk={handleAddKey}
        onCancel={() => setIsAddKeyModalVisible(false)}
        okButtonProps={{ disabled: !newKey.trim() }}>
        <Input.Password
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onBlur={(e) => {
            const formattedValue = formatApiKeys(e.target.value)
            if (formattedValue !== newKey) {
              setNewKey(formattedValue)
            }
          }}
          placeholder={t('settings.provider.gemini.enter_key')}
          autoFocus
        />
      </Modal>

      {/* 批量导入密钥的模态框 */}
      <Modal
        title={t('settings.provider.gemini.import_keys_title')}
        open={isImportModalVisible}
        onOk={handleImportKeys}
        onCancel={() => setIsImportModalVisible(false)}
        okButtonProps={{ disabled: !importText.trim() }}
        width={600}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text>{t('settings.provider.gemini.import_keys_desc')}</Text>

          <Upload.Dragger
            accept=".txt"
            beforeUpload={() => false}
            onChange={handleFileImport}
            showUploadList={false}
            style={{ marginBottom: 16 }}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p className="ant-upload-text">{t('settings.provider.gemini.drop_file')}</p>
          </Upload.Dragger>

          <Input.TextArea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            onBlur={(e) => {
              // 处理多行文本格式化
              const lines = e.target.value.split('\n')
              const formattedLines = lines.map((line) => {
                return formatApiKeys(line)
              })
              const formattedText = formattedLines.join('\n')

              if (formattedText !== importText) {
                setImportText(formattedText)
              }
            }}
            placeholder={t('settings.provider.gemini.enter_keys')}
            rows={8}
          />
        </Space>
      </Modal>
    </>
  )
}

const KeyManagerContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  margin-bottom: 16px;
`

const KeyCountInfo = styled.div`
  display: flex;
  align-items: center;
`

const KeysListContainer = styled.div`
  margin-top: 8px;
  padding: 8px;
  border-radius: 6px;
  background-color: var(--color-background-soft);
  margin-bottom: 16px;
`

const KeyItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  border-radius: 4px;
  margin-bottom: 4px;
  background-color: var(--color-background);

  &:last-child {
    margin-bottom: 0;
  }
`

export default GeminiKeyManager
