import type { MenuProps } from 'antd'
import { Button, Dropdown, Input, Space } from 'antd'
import { ChevronDown, Search } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// MCP资源列表
const mcpResources = [
  {
    name: 'Model Context Protocol Servers',
    url: 'https://github.com/modelcontextprotocol/servers',
    logo: 'https://avatars.githubusercontent.com/u/182288589'
  },
  {
    name: 'Awesome MCP Servers',
    url: 'https://github.com/punkpeye/awesome-mcp-servers',
    logo: 'https://github.githubassets.com/assets/github-logo-55c5b9a1fe52.png'
  },
  {
    name: 'mcp.so',
    url: 'https://mcp.so/',
    logo: 'https://mcp.so/favicon.ico'
  },
  {
    name: 'modelscope.cn',
    url: 'https://www.modelscope.cn/mcp',
    logo: 'https://g.alicdn.com/sail-web/maas/2.7.35/favicon/128.ico'
  },
  {
    name: 'mcp.higress.ai',
    url: 'https://mcp.higress.ai/',
    logo: 'https://framerusercontent.com/images/FD5yBobiBj4Evn0qf11X7iQ9csk.png'
  },
  {
    name: 'smithery.ai',
    url: 'https://smithery.ai/',
    logo: 'https://smithery.ai/logo.svg'
  },
  {
    name: 'glama.ai',
    url: 'https://glama.ai/mcp/servers',
    logo: 'https://glama.ai/favicon.ico'
  },
  {
    name: 'pulsemcp.com',
    url: 'https://www.pulsemcp.com',
    logo: 'https://www.pulsemcp.com/favicon.svg'
  },
  {
    name: 'mcp.composio.dev',
    url: 'https://mcp.composio.dev/',
    logo: 'https://composio.dev/wp-content/uploads/2025/02/Fevicon-composio.png'
  }
]

const TopMcpSearch: React.FC = () => {
  const { t } = useTranslation()

  // 构建下拉菜单项
  const items: MenuProps['items'] = mcpResources.map(({ name, url, logo }) => ({
    key: name,
    label: (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center' }}>
        <img src={logo} alt={name} style={{ width: 16, height: 16, borderRadius: 3, marginRight: 8 }} />
        {name}
      </a>
    )
  }))

  // 处理搜索
  const handleSearch = (value: string) => {
    console.log('Search MCP:', value)
    // 实现搜索功能
  }

  return (
    <Container>
      <SearchContainer>
        <Search size={16} />
        <StyledInput
          placeholder={t('搜索 MCP')}
          onPressEnter={(e) => handleSearch((e.target as HTMLInputElement).value)}
          bordered={false}
        />
      </SearchContainer>

      <Dropdown menu={{ items }} placement="bottomRight">
        <Button type="text" className="nodrag" style={{ display: 'flex', alignItems: 'center', height: 28 }}>
          <Space>
            {t('更多 MCP')}
            <ChevronDown size={14} />
          </Space>
        </Button>
      </Dropdown>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--color-bg-1);
  border-bottom: 1px solid var(--color-border);
  padding: 0 12px;
  height: 32px;
  width: 100%;
`

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  background-color: var(--color-bg-2);
  border-radius: 4px;
  padding: 0 8px;
  flex: 1;
  max-width: 300px;
  margin-right: 12px;
  height: 24px;
`

const StyledInput = styled(Input)`
  background-color: transparent;
  border: none;
  box-shadow: none;
  padding: 0 0 0 4px;
  height: 24px;

  &:focus {
    box-shadow: none;
  }
`

export default TopMcpSearch
