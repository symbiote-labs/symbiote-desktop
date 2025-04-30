import { nanoid } from '@reduxjs/toolkit'
import { VStack } from '@renderer/components/Layout'
import TopMcpSearch from '@renderer/components/TopMcpSearch'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useMCPServers } from '@renderer/hooks/useMCPServers'
import { MCPServer } from '@renderer/types'
import { FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import styled from 'styled-components'

import { SettingContainer } from '..'
import AgentModeSettings from './AgentModeSettings'
import InstallNpxUv from './InstallNpxUv'
import McpNavMenu from './McpNavMenu'
import McpServerList from './McpServerList'
import McpSettings from './McpSettings'
import McpToolCallingSettings from './McpToolCallingSettings'
import NpxSearch from './NpxSearch'
import ThreeColumnLayout from './ThreeColumnLayout'

const MCPSettings: FC = () => {
  const { t } = useTranslation()
  const { mcpServers, addMCPServer } = useMCPServers()
  const [selectedMcpServer, setSelectedMcpServer] = useState<MCPServer | null>(null)
  const { theme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const pathname = location.pathname

  const onAddMcpServer = useCallback(async () => {
    const newServer = {
      id: nanoid(),
      name: t('settings.mcp.newServer'),
      description: '',
      baseUrl: '',
      command: '',
      args: [],
      env: {},
      isActive: false
    }
    addMCPServer(newServer)
    window.message.success({ content: t('settings.mcp.addSuccess'), key: 'mcp-list' })
    setSelectedMcpServer(newServer)
    navigate(`/settings/mcp/server/${newServer.id}`)
  }, [addMCPServer, t, navigate])

  useEffect(() => {
    // 如果没有选中的服务器，默认选择第一个
    if (!selectedMcpServer && mcpServers.length > 0) {
      setSelectedMcpServer(mcpServers[0])
    } else if (selectedMcpServer) {
      // 如果有选中的服务器，确保它仍然存在于列表中
      const serverExists = mcpServers.some((server) => server.id === selectedMcpServer.id)
      if (!serverExists) {
        setSelectedMcpServer(mcpServers.length > 0 ? mcpServers[0] : null)
      } else {
        // 更新选中的服务器信息
        const updatedServer = mcpServers.find((server) => server.id === selectedMcpServer.id)
        if (updatedServer) {
          setSelectedMcpServer(updatedServer)
        }
      }
    }
  }, [mcpServers, selectedMcpServer])

  const handleSelectServer = useCallback(
    (server: MCPServer) => {
      setSelectedMcpServer(server)
      navigate(`/settings/mcp/server/${server.id}`)
    },
    [navigate]
  )

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path)
    },
    [navigate]
  )

  // 渲染左侧导航菜单
  const renderNavMenu = useCallback(() => {
    return <McpNavMenu onNavigate={handleNavigate} />
  }, [handleNavigate])

  // 渲染中间的服务器列表
  const renderServerList = useCallback(() => {
    return (
      <McpServerList
        selectedServerId={selectedMcpServer?.id || null}
        onSelectServer={handleSelectServer}
        onAddServer={onAddMcpServer}
      />
    )
  }, [selectedMcpServer, handleSelectServer, onAddMcpServer])

  // 渲染右侧内容
  const renderContent = useCallback(() => {
    if (pathname.includes('/settings/mcp/tool-calling')) {
      return <McpToolCallingSettings />
    } else if (pathname.includes('/settings/mcp/agent-mode')) {
      return <AgentModeSettings />
    } else if (pathname.includes('/settings/mcp/npx-search')) {
      return (
        <SettingContainer theme={theme}>
          <NpxSearch setSelectedMcpServer={setSelectedMcpServer} />
        </SettingContainer>
      )
    } else if (pathname.includes('/settings/mcp/mcp-install')) {
      return (
        <SettingContainer theme={theme}>
          <InstallNpxUv />
        </SettingContainer>
      )
    } else if (pathname.includes('/settings/mcp/server/') && selectedMcpServer) {
      return <McpSettings server={selectedMcpServer} />
    } else {
      // 默认显示欢迎页或空白页
      return (
        <EmptyContent>
          <EmptyText>{t('settings.mcp.selectServerOrCreate')}</EmptyText>
        </EmptyContent>
      )
    }
  }, [pathname, theme, selectedMcpServer, setSelectedMcpServer, t])

  return (
    <Container>
      <TopMcpSearch />
      <ThreeColumnLayout leftColumn={renderServerList()} middleColumn={renderContent()} rightColumn={renderNavMenu()} />
    </Container>
  )
}

const Container = styled(VStack)`
  flex: 1;
`

const EmptyContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
`

const EmptyText = styled.div`
  font-size: 16px;
  color: var(--color-text-2);
  text-align: center;
`

export default MCPSettings
