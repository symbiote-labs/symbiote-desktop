import { LinkOutlined } from '@ant-design/icons'
import { MCPServer } from '@renderer/types'
import { Alert, Button, Input, Modal, Select, Space, Typography } from 'antd'
import { RefreshCw } from 'lucide-react'
import { FC, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { syncModelScopeServers } from './modelscopeSyncUtils'

const { Text, Link } = Typography
const { Option } = Select

interface SyncPopupProps {
  open: boolean
  onCancel: () => void
  mcpServers: MCPServer[]
  updateMcpServers: (servers: MCPServer[]) => void
}

// 声明组件类型
const SyncServersPopup: FC<SyncPopupProps> = ({ open, onCancel, mcpServers, updateMcpServers }) => {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<string>('modelscope')
  const [token, setToken] = useState<string>('')
  const [tokenError, setTokenError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const handleProviderChange = useCallback((value: string) => {
    setProvider(value)
    setToken('')
    setTokenError('')
    setError('')
  }, [])

  const handleTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setToken(e.target.value)
    setTokenError('')
    setError('')
  }, [])

  const handleSync = useCallback(async () => {
    if (!token.trim()) {
      setTokenError(t('assistants.settings.mcp.sync.tokenRequired'))
      return
    }

    setLoading(true)
    setError('')

    try {
      if (provider === 'modelscope') {
        const result = await syncModelScopeServers(token, mcpServers)

        if (result.success) {
          updateMcpServers(result.servers || [])
          window.message.success({ content: t('assistants.settings.mcp.sync.success'), key: 'sync-servers' })
          onCancel()
        } else {
          setError(result.error || t('assistants.settings.mcp.sync.error'))
        }
      }
    } catch (err) {
      console.error('Sync error:', err)
      setError(t('assistants.settings.mcp.sync.error'))
    } finally {
      setLoading(false)
    }
  }, [token, provider, mcpServers, t, onCancel, updateMcpServers])

  return (
    <Modal title={t('assistants.settings.mcp.sync.title')} open={open} onCancel={onCancel} footer={null} width={460}>
      <ContentWrapper>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Label>{t('assistants.settings.mcp.sync.selectProvider')}</Label>
            <Select value={provider} onChange={handleProviderChange} style={{ width: '100%' }}>
              <Option value="modelscope">ModelScope</Option>
            </Select>
          </div>

          {provider === 'modelscope' && (
            <>
              <LinksContainer>
                <LinkItem>
                  <Text>{t('assistants.settings.mcp.sync.discoverMcpServers')}</Text>
                  <Link href="https://modelscope.cn/models" target="_blank">
                    <LinkOutlined style={{ marginLeft: 8 }} />
                  </Link>
                </LinkItem>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('assistants.settings.mcp.sync.discoverMcpServersDescription')}
                </Text>

                <LinkItem>
                  <Text>{t('assistants.settings.mcp.sync.getToken')}</Text>
                  <Link href="https://modelscope.cn/my/myaccesstoken" target="_blank">
                    <LinkOutlined style={{ marginLeft: 8 }} />
                  </Link>
                </LinkItem>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('assistants.settings.mcp.sync.getTokenDescription')}
                </Text>
              </LinksContainer>

              <div>
                <Label>{t('assistants.settings.mcp.sync.setToken')}</Label>
                <Input
                  placeholder={t('assistants.settings.mcp.sync.tokenPlaceholder')}
                  value={token}
                  onChange={handleTokenChange}
                  status={tokenError ? 'error' : ''}
                />
                {tokenError && <ErrorText>{tokenError}</ErrorText>}
              </div>
            </>
          )}

          {error && <Alert message={error} type="error" showIcon style={{ marginTop: 12 }} />}

          <ButtonsContainer>
            <Button onClick={onCancel}>{t('cancel')}</Button>
            <Button type="primary" icon={<RefreshCw size={16} />} onClick={handleSync} loading={loading}>
              {t('assistants.settings.mcp.sync.button')}
            </Button>
          </ButtonsContainer>
        </Space>
      </ContentWrapper>
    </Modal>
  )
}

const ContentWrapper = styled.div`
  padding: 12px 0;
`

const Label = styled.div`
  margin-bottom: 8px;
  font-weight: 500;
`

const LinksContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const LinkItem = styled.div`
  display: flex;
  align-items: center;
  margin-top: 8px;
`

const ErrorText = styled.div`
  color: var(--color-error);
  font-size: 12px;
  margin-top: 4px;
`

const ButtonsContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
`

// 定义一个导出模块，包含静态方法
const SyncPopupModule = {
  show: (mcpServers: MCPServer[], updateMcpServers: (servers: MCPServer[]) => void) => {
    // 创建一个div用于挂载Modal
    const div = document.createElement('div')
    document.body.appendChild(div)

    // 创建Root
    const root = createRoot(div)

    // 创建销毁函数
    const destroy = () => {
      root.unmount()
      if (div.parentNode) {
        div.parentNode.removeChild(div)
      }
    }

    // 渲染Modal
    root.render(
      <SyncServersPopup open={true} onCancel={destroy} mcpServers={mcpServers} updateMcpServers={updateMcpServers} />
    )

    // 返回销毁函数，以便调用方可以手动销毁
    return { destroy }
  }
}

export default Object.assign(SyncServersPopup, SyncPopupModule)
