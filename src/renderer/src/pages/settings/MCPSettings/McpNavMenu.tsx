import {
  CodeOutlined,
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
  RobotOutlined,
  SearchOutlined,
  ToolOutlined
} from '@ant-design/icons'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import EditMcpJsonPopup from './EditMcpJsonPopup'
import ImportMcpServerPopup from './ImportMcpServerPopup'

interface McpNavMenuProps {
  onNavigate?: (path: string) => void
}

const McpNavMenu: FC<McpNavMenuProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const handleNavigation = (path: string) => {
    if (onNavigate) {
      onNavigate(path)
    } else {
      navigate(path)
    }
  }

  const isActive = (path: string) => {
    return location.pathname.includes(path)
  }

  const openMcpWebsite = () => window.open('https://mcp.so/', '_blank')

  return (
    <Container>
      <MenuTitle>{t('settings.title')}</MenuTitle>
      <MenuList>
        <MenuItem
          $active={
            isActive('/settings/mcp') &&
            !isActive('/settings/mcp/tool-calling') &&
            !isActive('/settings/mcp/npx-search')
          }
          onClick={() => handleNavigation('/settings/mcp')}>
          <MenuIcon>
            <CodeOutlined />
          </MenuIcon>
          <MenuText>{t('settings.mcp.title')}</MenuText>
        </MenuItem>
        <MenuItem
          $active={isActive('/settings/mcp/tool-calling')}
          onClick={() => handleNavigation('/settings/mcp/tool-calling')}>
          <MenuIcon>
            <ToolOutlined />
          </MenuIcon>
          <MenuText>{t('settings.mcp.tool_calling.title', '工具调用设置')}</MenuText>
        </MenuItem>
        <MenuItem
          $active={isActive('/settings/mcp/agent-mode')}
          onClick={() => handleNavigation('/settings/mcp/agent-mode')}>
          <MenuIcon>
            <RobotOutlined />
          </MenuIcon>
          <MenuText>{t('settings.mcp.agent_mode.title', 'Agent模式设置')}</MenuText>
        </MenuItem>
        <MenuDivider />
        <MenuTitle>{t('settings.mcp.actions')}</MenuTitle>
        <MenuItem $active={false} onClick={() => handleNavigation('/settings/mcp/npx-search')}>
          <MenuIcon>
            <SearchOutlined />
          </MenuIcon>
          <MenuText>{t('settings.mcp.searchNpx')}</MenuText>
        </MenuItem>
        <MenuItem $active={false} onClick={() => ImportMcpServerPopup.show()}>
          <MenuIcon>
            <ImportOutlined />
          </MenuIcon>
          <MenuText>{t('settings.mcp.importServer')}</MenuText>
        </MenuItem>
        <MenuItem $active={false} onClick={() => EditMcpJsonPopup.show()}>
          <MenuIcon>
            <EditOutlined />
          </MenuIcon>
          <MenuText>{t('settings.mcp.editMcpJson')}</MenuText>
        </MenuItem>
        <MenuItem $active={false} onClick={openMcpWebsite}>
          <MenuIcon>
            <ExportOutlined />
          </MenuIcon>
          <MenuText>{t('settings.mcp.findMore')}</MenuText>
        </MenuItem>
      </MenuList>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 0;
`

const MenuTitle = styled.h2`
  margin: 0;
  padding: 0 16px 16px;
  font-size: 16px;
  font-weight: 500;
  border-bottom: 1px solid var(--color-border);
`

const MenuList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 16px 8px;
`

const MenuItem = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  background-color: ${(props) => (props.$active ? 'var(--color-bg-2)' : 'transparent')};
  color: ${(props) => (props.$active ? 'var(--color-primary)' : 'var(--color-text-1)')};

  &:hover {
    background-color: var(--color-bg-2);
  }
`

const MenuIcon = styled.div`
  font-size: 16px;
  margin-right: 12px;
`

const MenuText = styled.div`
  font-size: 14px;
`

const MenuDivider = styled.div`
  height: 1px;
  background-color: var(--color-border);
  margin: 16px 8px;
`

export default McpNavMenu
