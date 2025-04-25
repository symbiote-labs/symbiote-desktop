import { CodeOutlined, PlusOutlined } from '@ant-design/icons'
import IndicatorLight from '@renderer/components/IndicatorLight'
import { useMCPServers } from '@renderer/hooks/useMCPServers'
import { MCPServer } from '@renderer/types'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface McpServerListProps {
  selectedServerId: string | null
  onSelectServer: (server: MCPServer) => void
  onAddServer: () => void
}

const McpServerList: FC<McpServerListProps> = ({ selectedServerId, onSelectServer, onAddServer }) => {
  const { t } = useTranslation()
  const { mcpServers } = useMCPServers()

  return (
    <Container>
      <Header>
        <Title>{t('settings.mcp.title')}</Title>
      </Header>
      <ServerList>
        <AddServerItem onClick={onAddServer}>
          <PlusOutlined style={{ fontSize: 16 }} />
          <AddServerText>{t('settings.mcp.addServer')}</AddServerText>
        </AddServerItem>
        {mcpServers.map((server) => (
          <ServerItem key={server.id} $active={server.id === selectedServerId} onClick={() => onSelectServer(server)}>
            <ServerIcon>
              <CodeOutlined />
            </ServerIcon>
            <ServerInfo>
              <ServerName>{server.name}</ServerName>
              <ServerDescription>
                {server.description &&
                  server.description.substring(0, 80) + (server.description.length > 80 ? '...' : '')}
              </ServerDescription>
            </ServerInfo>
            <StatusIndicator>
              <IndicatorLight
                size={6}
                color={server.isActive ? 'green' : 'var(--color-text-3)'}
                animation={server.isActive}
                shadow={false}
              />
            </StatusIndicator>
          </ServerItem>
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
`

const Title = styled.h2`
  margin: 0;
  font-size: 16px;
  font-weight: 500;
`

const ServerList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`

const ServerItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  margin-bottom: 4px;
  background-color: ${(props) => (props.$active ? 'var(--color-bg-2)' : 'transparent')};
  border-left: 3px solid ${(props) => (props.$active ? 'var(--color-primary)' : 'transparent')};
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

const ServerIcon = styled.div`
  font-size: 16px;
  color: var(--color-primary);
  margin-right: 12px;
`

const ServerInfo = styled.div`
  flex: 1;
  overflow: hidden;
`

const ServerName = styled.div`
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`

const ServerDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
`

const StatusIndicator = styled.div`
  margin-left: 8px;
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
