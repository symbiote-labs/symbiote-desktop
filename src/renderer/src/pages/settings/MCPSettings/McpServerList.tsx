import { CodeOutlined, PlusOutlined } from '@ant-design/icons'
import IndicatorLight from '@renderer/components/IndicatorLight'
import { useMCPServers } from '@renderer/hooks/useMCPServers'
import { MCPServer } from '@renderer/types'
import { Tag } from 'antd'
import { RefreshCw } from 'lucide-react'
import { FC, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import SyncServersPopup from './SyncServersPopup'

interface McpServerListProps {
  selectedServerId: string | null
  onSelectServer: (server: MCPServer) => void
  onAddServer: () => void
}

const McpServerList: FC<McpServerListProps> = ({ selectedServerId, onSelectServer, onAddServer }) => {
  const { t } = useTranslation()
  const { mcpServers, updateMcpServers } = useMCPServers()

  const onSyncServers = useCallback(() => {
    SyncServersPopup.show(mcpServers, updateMcpServers)
  }, [mcpServers, updateMcpServers])

  return (
    <Container>
      <Header>
        <Title>{t('settings.mcp.title')}</Title>
        <ButtonGroup>
          <AddButton onClick={onAddServer}>
            <PlusOutlined style={{ fontSize: 16 }} />
            <ButtonText>{t('settings.mcp.addServer')}</ButtonText>
          </AddButton>
          <SyncButton onClick={onSyncServers}>
            <RefreshCw size={16} />
            <ButtonText>{t('settings.mcp.sync.title')}</ButtonText>
          </SyncButton>
        </ButtonGroup>
      </Header>
      <ServerList>
        <AddServerItem onClick={onAddServer}>
          <PlusOutlined style={{ fontSize: 16 }} />
          <AddServerText>{t('settings.mcp.addServer')}</AddServerText>
        </AddServerItem>
        {mcpServers.map((server) => (
          <ServerCard key={server.id} $active={server.id === selectedServerId} onClick={() => onSelectServer(server)}>
            <ServerHeader>
              {server.logoUrl ? (
                <ServerLogo src={server.logoUrl} alt={server.name} />
              ) : (
                <ServerIcon>
                  <CodeOutlined style={{ color: server.isActive ? 'var(--color-primary)' : 'var(--color-text-3)' }} />
                </ServerIcon>
              )}
              <ServerName>
                <ServerNameText>{server.name}</ServerNameText>
                <StatusIndicator>
                  <IndicatorLight
                    size={6}
                    color={server.isActive ? 'green' : 'var(--color-text-3)'}
                    animation={server.isActive}
                    shadow={false}
                  />
                </StatusIndicator>
              </ServerName>
            </ServerHeader>
            <ServerDescription>{server.description}</ServerDescription>
            <ServerFooter>
              <Tag color="processing" style={{ borderRadius: 20, margin: 0, fontWeight: 500 }}>
                {t(`settings.mcp.${server.type || 'stdio'}`)}
              </Tag>
              {server.provider && (
                <Tag color="success" style={{ borderRadius: 20, margin: 0, fontWeight: 500 }}>
                  {server.provider}
                </Tag>
              )}
              {server.tags &&
                server.tags.map((tag) => (
                  <Tag key={tag} color="default" style={{ borderRadius: 20, margin: 0 }}>
                    {tag}
                  </Tag>
                ))}
            </ServerFooter>
          </ServerCard>
        ))}
      </ServerList>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`

const Header = styled.div`
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
`

const Title = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 500;
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
`

const AddButton = styled.button`
  display: flex;
  align-items: center;
  padding: 6px 12px;
  border-radius: 6px;
  background-color: var(--color-bg-1);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background-color: var(--color-bg-2);
  }
`

const SyncButton = styled(AddButton)`
  color: var(--color-text-1);
  display: flex;
  align-items: center;
  justify-content: center;
`

const ButtonText = styled.span`
  margin-left: 8px;
  font-size: 14px;
`

const ServerList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`

const ServerCard = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  cursor: pointer;
  margin-bottom: 8px;
  border-radius: 8px;
  background-color: ${(props) => (props.$active ? 'var(--color-bg-2)' : 'var(--color-bg-1)')};
  border-left: 3px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};

  &:hover {
    background-color: var(--color-bg-2);
  }
`

const AddServerItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 16px;
  cursor: pointer;
  margin-bottom: 4px;
  background-color: transparent;
  position: relative;

  &:hover {
    background-color: var(--color-bg-2);
  }

  &:after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 16px;
    right: 16px;
    height: 1px;
    background-color: var(--color-border);
  }
`

const ServerLogo = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
  margin-right: 8px;
`

const ServerHeader = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
`

const ServerIcon = styled.div`
  font-size: 16px;
  color: var(--color-primary);
  margin-right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const ServerName = styled.div`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: 4px;
`

const ServerNameText = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ServerDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  margin-bottom: 8px;
  white-space: pre-wrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`

const ServerFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-start;
  margin-top: 10px;
`

const StatusIndicator = styled.div`
  margin-left: 4px;
`

const AddServerText = styled.span`
  margin-left: 8px;
`

// 未使用的样式组件，保留以备后用
// const ExpandIcon = styled.div`
//   color: var(--color-text-3);
//   margin-left: 4px;
//   font-size: 16px;
// `

export default McpServerList
