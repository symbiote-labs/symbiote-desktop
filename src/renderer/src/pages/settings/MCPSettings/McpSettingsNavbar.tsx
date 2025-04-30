import { EditOutlined, ImportOutlined, SyncOutlined } from '@ant-design/icons'
import { NavbarRight } from '@renderer/components/app/Navbar'
import { HStack } from '@renderer/components/Layout'
import { isWindows } from '@renderer/config/constant'
import { useMCPServers } from '@renderer/hooks/useMCPServers'
import { Button } from 'antd'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import EditMcpJsonPopup from './EditMcpJsonPopup'
import ImportMcpServerPopup from './ImportMcpServerPopup'
import InstallNpxUv from './InstallNpxUv'
import SyncServersPopup from './SyncServersPopup'

export const McpSettingsNavbar = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { mcpServers, updateMcpServers } = useMCPServers()

  return (
    <NavbarRight style={{ paddingRight: isWindows ? 150 : 12 }}>
      <HStack alignItems="center" gap={5}>
        <Button
          size="small"
          type="text"
          onClick={() => navigate('/settings/mcp/npx-search')}
          icon={<Search size={14} />}
          className="nodrag"
          style={{ fontSize: 13, height: 28, borderRadius: 20 }}>
          {t('settings.mcp.searchNpx')}
        </Button>
        <Button
          size="small"
          type="text"
          onClick={() => SyncServersPopup.show(mcpServers, updateMcpServers)}
          icon={<SyncOutlined />}
          className="nodrag"
          style={{ fontSize: 13, height: 28, borderRadius: 20 }}>
          {t('settings.mcp.sync.title')}
        </Button>
        <Button
          size="small"
          type="text"
          onClick={() => ImportMcpServerPopup.show()}
          icon={<ImportOutlined />}
          className="nodrag"
          style={{ fontSize: 13, height: 28, borderRadius: 20 }}>
          {t('settings.mcp.importServer')}
        </Button>
        <Button
          size="small"
          type="text"
          onClick={() => EditMcpJsonPopup.show()}
          icon={<EditOutlined />}
          className="nodrag"
          style={{ fontSize: 13, height: 28, borderRadius: 20 }}>
          {t('settings.mcp.editMcpJson')}
        </Button>
        <InstallNpxUv mini />
      </HStack>
    </NavbarRight>
  )
}
