import React, { useState } from 'react'
import { Button, Input, Alert, Card, Typography, Space, Tooltip, Badge, Modal, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setSymbioteBaseUrl } from '@renderer/store/settings'
import { useAuth } from '@renderer/context/AuthProvider'
import {
  Settings2,
  Link,
  CheckCircle,
  XCircle,
  User,
  Bot,
  Wifi,
  WifiOff,
  Clock,
  Eye,
  Copy
} from 'lucide-react'
import styled from 'styled-components'
import { SYMBIOTE_AGENT_ID, SYMBIOTE_ASSISTANT_ID } from '@renderer/utils/symbioteConfig'
import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '../settings'
import { useTheme } from '@renderer/context/ThemeProvider'

const { Text, Title, Paragraph } = Typography
const { TextArea } = Input

const SymbioteSettings: React.FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { user, isAuthenticated, isLoading } = useAuth()

  // Get settings from store
  const {
    symbioteBaseUrl,
    symbioteAgentConfigured,
    symbioteAssistantConfigured,
    lastSymbioteConfigUpdate
  } = useAppSelector((state) => state.settings)

  // Get agent and assistant from store
  const symbioteAgent = useAppSelector((state) =>
    state.agents.agents.find(agent => agent.id === SYMBIOTE_AGENT_ID)
  )
  const symbioteAssistant = useAppSelector((state) =>
    state.assistants.assistants.find(assistant => assistant.id === SYMBIOTE_ASSISTANT_ID)
  )

  const [localBaseUrl, setLocalBaseUrl] = useState(symbioteBaseUrl)
  const [isSaving, setIsSaving] = useState(false)
  const [showAgentJson, setShowAgentJson] = useState(false)
  const [showAssistantJson, setShowAssistantJson] = useState(false)

  const handleSaveBaseUrl = async () => {
    setIsSaving(true)
    try {
      // Update the store
      dispatch(setSymbioteBaseUrl(localBaseUrl))

      // Note: The services will need to be updated to read from the store
      // This will require updating AuthService and SymbioteApiService

      setTimeout(() => {
        setIsSaving(false)
      }, 500)
    } catch (error) {
      console.error('Failed to save base URL:', error)
      setIsSaving(false)
    }
  }

  const handleCopyJson = (jsonData: string) => {
    navigator.clipboard.writeText(jsonData).then(() => {
      message.success('JSON copied to clipboard!')
    }).catch(() => {
      message.error('Failed to copy JSON')
    })
  }

  const getStatusIcon = (configured: boolean) => {
    return configured ? (
      <CheckCircle size={16} style={{ color: '#52c41a' }} />
    ) : (
      <XCircle size={16} style={{ color: '#ff4d4f' }} />
    )
  }

  const getAuthStatusIcon = () => {
    if (isLoading) return <Clock size={16} style={{ color: '#1890ff' }} />
    return isAuthenticated ? (
      <Wifi size={16} style={{ color: '#52c41a' }} />
    ) : (
      <WifiOff size={16} style={{ color: '#ff4d4f' }} />
    )
  }

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleString()
  }

  const formatJson = (obj: any) => {
    return JSON.stringify(obj, null, 2)
  }

  return (
    <Container>
      <SettingContainer theme={theme}>
        {/* Authentication Status */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <User size={18} style={{ marginRight: 8 }} />
            Authentication Status
          </SettingTitle>
          <SettingDivider />
          <StatusCard>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Space align="center">
                {getAuthStatusIcon()}
                <Text strong={isAuthenticated}>
                  {isLoading ? 'Checking...' : isAuthenticated ? 'Connected' : 'Not Connected'}
                </Text>
              </Space>
              {isAuthenticated && user && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Logged in as: {user.display_name || user.email}
                </Text>
              )}
              {!isAuthenticated && (
                <Alert
                  message="Not authenticated"
                  description="Click your avatar in the sidebar to sign in and enable auto-configuration."
                  type="warning"
                  showIcon
                  size="small"
                />
              )}
            </Space>
          </StatusCard>
        </SettingGroup>

        {/* Base URL Configuration */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <Link size={18} style={{ marginRight: 8 }} />
            Server Configuration
          </SettingTitle>
          <SettingDivider />
          <SettingRow>
            <SettingRowTitle>Base URL</SettingRowTitle>
            <Space.Compact style={{ width: 300 }}>
              <Input
                value={localBaseUrl}
                onChange={(e) => setLocalBaseUrl(e.target.value)}
                placeholder="http://localhost:4500"
                style={{ width: 240 }}
              />
              <Button
                type="primary"
                onClick={handleSaveBaseUrl}
                loading={isSaving}
                disabled={localBaseUrl === symbioteBaseUrl}
              >
                Save
              </Button>
            </Space.Compact>
          </SettingRow>
          <SettingRow>
            <div style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                This URL is used for both authentication and API calls.
                Changes require a restart to take full effect.
              </Text>
            </div>
          </SettingRow>
        </SettingGroup>

        {/* Agent Configuration Status */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <Bot size={18} style={{ marginRight: 8 }} />
            Auto-Configuration Status
          </SettingTitle>
          <SettingDivider />
          <StatusGrid>
            <StatusCard>
              <Space align="center" style={{ marginBottom: 8 }}>
                {getStatusIcon(symbioteAgentConfigured)}
                <Text strong>Symbiote Agent</Text>
                {symbioteAgent && (
                  <Button
                    type="text"
                    size="small"
                    icon={<Eye size={14} />}
                    onClick={() => setShowAgentJson(true)}
                    style={{ marginLeft: 'auto' }}
                  >
                    View JSON
                  </Button>
                )}
              </Space>
              {symbioteAgent ? (
                <Space direction="vertical" size="small">
                  <Text style={{ fontSize: 12 }}>
                    <strong>Name:</strong> {symbioteAgent.name}
                  </Text>
                  <Text style={{ fontSize: 12 }}>
                    <strong>Type:</strong> {symbioteAgent.type || 'Custom'}
                  </Text>
                  <Text style={{ fontSize: 12 }}>
                    <strong>Emoji:</strong> {symbioteAgent.emoji}
                  </Text>
                </Space>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Not configured
                </Text>
              )}
            </StatusCard>

            <StatusCard>
              <Space align="center" style={{ marginBottom: 8 }}>
                {getStatusIcon(symbioteAssistantConfigured)}
                <Text strong>Symbiote Assistant</Text>
                {symbioteAssistant && (
                  <Button
                    type="text"
                    size="small"
                    icon={<Eye size={14} />}
                    onClick={() => setShowAssistantJson(true)}
                    style={{ marginLeft: 'auto' }}
                  >
                    View JSON
                  </Button>
                )}
              </Space>
              {symbioteAssistant ? (
                <Space direction="vertical" size="small">
                  <Text style={{ fontSize: 12 }}>
                    <strong>Name:</strong> {symbioteAssistant.name}
                  </Text>
                  <Text style={{ fontSize: 12 }}>
                    <strong>Model:</strong> {symbioteAssistant.modelId || 'Default'}
                  </Text>
                  <Text style={{ fontSize: 12 }}>
                    <strong>MCP Servers:</strong> {symbioteAssistant.mcpServers?.length || 0}
                  </Text>
                </Space>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Not configured
                </Text>
              )}
            </StatusCard>
          </StatusGrid>

          <SettingRow>
            <SettingRowTitle>Last Update</SettingRowTitle>
            <Text style={{ fontSize: 12 }}>
              {formatTimestamp(lastSymbioteConfigUpdate)}
            </Text>
          </SettingRow>

          {(!symbioteAgentConfigured || !symbioteAssistantConfigured) && isAuthenticated && (
            <Alert
              message="Auto-configuration incomplete"
              description="Some components are not configured. This will be attempted automatically when you sign in or can be triggered by restarting the application."
              type="info"
              showIcon
              size="small"
            />
          )}
        </SettingGroup>

        {/* Help & Information */}
        <SettingGroup theme={theme}>
          <SettingTitle>
            <Settings2 size={18} style={{ marginRight: 8 }} />
            Information
          </SettingTitle>
          <SettingDivider />
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <Text style={{ fontSize: 12 }}>
              <strong>Auto-configuration:</strong> When authenticated, the system automatically
              fetches and configures a Symbiote agent and assistant based on your server settings.
            </Text>
            <Text style={{ fontSize: 12 }}>
              <strong>Base URL:</strong> This should point to your Symbiote Labs server instance.
              Both authentication and API calls use this URL.
            </Text>
            <Text style={{ fontSize: 12 }}>
              <strong>MCP Integration:</strong> The auto-configured assistant includes all
              available MCP servers for enhanced functionality.
            </Text>
          </Space>
        </SettingGroup>
      </SettingContainer>

      {/* Agent JSON Modal */}
      <Modal
        title="Symbiote Agent Configuration"
        open={showAgentJson}
        onCancel={() => setShowAgentJson(false)}
        footer={[
          <Button
            key="copy"
            type="primary"
            icon={<Copy size={14} />}
            onClick={() => symbioteAgent && handleCopyJson(formatJson(symbioteAgent))}
          >
            Copy JSON
          </Button>,
          <Button key="close" onClick={() => setShowAgentJson(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            This is the complete configuration for the auto-configured Symbiote agent.
            You can copy this JSON to use elsewhere or for debugging purposes.
          </Text>
        </div>
        <TextArea
          value={symbioteAgent ? formatJson(symbioteAgent) : ''}
          readOnly
          rows={20}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>

      {/* Assistant JSON Modal */}
      <Modal
        title="Symbiote Assistant Configuration"
        open={showAssistantJson}
        onCancel={() => setShowAssistantJson(false)}
        footer={[
          <Button
            key="copy"
            type="primary"
            icon={<Copy size={14} />}
            onClick={() => symbioteAssistant && handleCopyJson(formatJson(symbioteAssistant))}
          >
            Copy JSON
          </Button>,
          <Button key="close" onClick={() => setShowAssistantJson(false)}>
            Close
          </Button>
        ]}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            This is the complete configuration for the auto-configured Symbiote assistant.
            You can copy this JSON to use elsewhere or for debugging purposes.
          </Text>
        </div>
        <TextArea
          value={symbioteAssistant ? formatJson(symbioteAssistant) : ''}
          readOnly
          rows={20}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </Modal>
    </Container>
  )
}

const Container = styled.div`
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
`

const StatusGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
`

const StatusCard = styled.div`
  padding: 16px;
  background: var(--color-background-soft);
  border: 1px solid var(--color-border);
  border-radius: 8px;
`

export default SymbioteSettings