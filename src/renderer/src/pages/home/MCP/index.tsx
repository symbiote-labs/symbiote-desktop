import { AppstoreOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Button, Card, Empty, Flex, Input, Radio, Tag, Typography } from 'antd'
import { isEmpty } from 'lodash'
import { Search, SquareTerminal } from 'lucide-react'
import React, { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Navbar, NavbarCenter } from '../../../components/app/Navbar'
import { Center } from '../../../components/Layout'
import { useMCPServers } from '../../../hooks/useMCPServers'
import { MCPTool } from '../../../types'

// 视图模式类型
export type MCPViewMode = 'list' | 'detail'

const MCPPage: FC = () => {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const { mcpServers } = useMCPServers()
  const [tools, setTools] = useState<MCPTool[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<MCPViewMode>('list')

  // 获取所有可用工具
  const fetchTools = async () => {
    setLoading(true)
    const allTools: MCPTool[] = []
    for (const server of mcpServers.filter((s) => s.isActive)) {
      try {
        // @ts-ignore - window.api is defined in preload
        const serverTools = await window.api.mcp.listTools(server)
        allTools.push(...serverTools)
      } catch (error) {
        console.error(`Error fetching tools for server ${server.name}:`, error)
      }
    }
    setTools(allTools)
    setLoading(false)
  }

  // 重置工具列表
  const resetToolsList = async () => {
    setLoading(true)
    const allTools: MCPTool[] = []
    for (const server of mcpServers.filter((s) => s.isActive)) {
      try {
        // @ts-ignore - window.api is defined in preload
        const serverTools = await window.api.mcp.resetToolsList(server)
        allTools.push(...serverTools)
      } catch (error) {
        console.error(`Error resetting tools for server ${server.name}:`, error)
      }
    }
    setTools(allTools)
    setLoading(false)
  }

  useEffect(() => {
    if (mcpServers.length > 0) {
      fetchTools()
    } else {
      setTools([])
    }
  }, [mcpServers])

  const filteredTools = search
    ? tools.filter(
        (tool) =>
          tool.name.toLowerCase().includes(search.toLowerCase()) ||
          tool.description?.toLowerCase().includes(search.toLowerCase()) ||
          tool.serverName.toLowerCase().includes(search.toLowerCase())
      )
    : tools

  return (
    <Container>
      <Navbar>
        <StyledNavbarCenter>
          {t('settings.mcp.title')}
          <Flex align="center" gap={16}>
            <ViewModeToggle>
              <Radio.Group
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                buttonStyle="solid"
                size="small">
                <Radio.Button value="list">
                  <UnorderedListOutlined /> {t('settings.mcp.listView')}
                </Radio.Button>
                <Radio.Button value="detail">
                  <AppstoreOutlined /> {t('settings.mcp.detailView')}
                </Radio.Button>
              </Radio.Group>
            </ViewModeToggle>
            <SearchInput
              placeholder={t('common.search')}
              className="nodrag"
              size="small"
              variant="filled"
              suffix={<Search size={18} />}
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            />
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              size="small"
              onClick={resetToolsList}
              loading={loading}
              style={{ marginLeft: 8 }}>
              {t('settings.mcp.tools.resetToolsList') || '重置工具列表'}
            </Button>
          </Flex>
          <Spacer />
        </StyledNavbarCenter>
      </Navbar>
      <ContentContainer id="content-container">
        {loading ? (
          <Center>
            <div>{t('common.loading')}</div>
          </Center>
        ) : isEmpty(filteredTools) ? (
          <Center>
            <Empty description={t('settings.mcp.tools.noToolsAvailable')} />
          </Center>
        ) : viewMode === 'list' ? (
          <ToolsList>
            {filteredTools.map((tool) => (
              <ToolItem key={tool.id}>
                <ToolIcon>
                  <SquareTerminal size={16} />
                </ToolIcon>
                <ToolInfo>
                  <ToolName>{tool.name}</ToolName>
                  {tool.description && <ToolDescription>{tool.description}</ToolDescription>}
                </ToolInfo>
                <ToolServer>{tool.serverName}</ToolServer>
              </ToolItem>
            ))}
          </ToolsList>
        ) : (
          <ToolsGrid>
            {filteredTools.map((tool) => (
              <Card key={tool.id} size="small" title={<Typography.Text strong>{tool.name}</Typography.Text>}>
                {tool.description && (
                  <Typography.Paragraph ellipsis={{ rows: 2 }}>{tool.description}</Typography.Paragraph>
                )}
                <Tag color="blue">{tool.serverName}</Tag>
              </Card>
            ))}
          </ToolsGrid>
        )}
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`

const ContentContainer = styled.div`
  flex: 1;
  overflow: auto;
  padding: 16px;
`

const ViewModeToggle = styled.div`
  display: flex;
  align-items: center;
`

const ToolsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const ToolItem = styled.div`
  display: flex;
  align-items: center;
  padding: 12px;
  border-radius: 8px;
  background-color: var(--color-background-soft);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--color-background-mute);
  }
`

const ToolIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--color-background-mute);
  margin-right: 12px;
  color: var(--color-primary);
`

const ToolInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
`

const ToolName = styled.div`
  font-weight: 500;
  color: var(--color-text);
`

const ToolDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
`

const ToolServer = styled.div`
  font-size: 12px;
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: 4px;
  background-color: var(--color-background-mute);
`

const ToolsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
`

const Spacer = styled.div`
  width: 80px;
`

const StyledNavbarCenter = styled(NavbarCenter)`
  border-right: none;
  justify-content: space-between;
`

const SearchInput = styled(Input)`
  width: 200px;
  height: 28px;
  border-radius: 15px;
`

export default MCPPage
