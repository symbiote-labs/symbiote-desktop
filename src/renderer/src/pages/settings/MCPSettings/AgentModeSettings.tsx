import { InfoCircleOutlined } from '@ant-design/icons'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { useAppDispatch } from '@renderer/store'
import { setAgentModeMaxApiRequests, setEnableAgentMode } from '@renderer/store/settings'
import { InputNumber, Switch, Tooltip } from 'antd'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

const AgentModeSettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { enableAgentMode, agentModeMaxApiRequests } = useSettings()

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>{t('settings.mcp.agent_mode.title', 'Agent模式设置')}</SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>
            {t('settings.mcp.agent_mode.enable', '启用Agent模式')}
            <Tooltip
              title={t(
                'settings.mcp.agent_mode.enable_tooltip',
                '启用后，AI可以连续使用多个工具来完成任务，而不是一次只能使用一个工具。'
              )}
              placement="right">
              <InfoCircleOutlined style={{ marginLeft: 8, color: 'var(--color-text-3)' }} />
            </Tooltip>
          </SettingRowTitle>
          <Switch checked={enableAgentMode} onChange={(checked) => dispatch(setEnableAgentMode(checked))} />
        </SettingRow>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>
            {t('settings.mcp.agent_mode.max_api_requests', '最大API请求次数')}
            <Tooltip
              title={t(
                'settings.mcp.agent_mode.max_api_requests_tooltip',
                '设置Agent模式下最大API请求次数，防止无限循环。'
              )}
              placement="right">
              <InfoCircleOutlined style={{ marginLeft: 8, color: 'var(--color-text-3)' }} />
            </Tooltip>
          </SettingRowTitle>
          <InputNumber
            min={1}
            max={50}
            value={agentModeMaxApiRequests}
            onChange={(value) => dispatch(setAgentModeMaxApiRequests(value || 20))}
            disabled={!enableAgentMode}
          />
        </SettingRow>
        <SettingDivider />
        <Description>
          {t(
            'settings.mcp.agent_mode.description',
            'Agent模式允许AI连续使用多个工具来完成任务，类似于自动化助手。\n启用此功能后，AI将能够根据任务需要自动选择和调用工具，直到任务完成或达到最大API请求次数。'
          )}
        </Description>
      </SettingGroup>
    </SettingContainer>
  )
}

const Description = styled.div`
  color: var(--color-text-3);
  font-size: 14px;
  line-height: 1.5;
  margin-top: 8px;
  white-space: pre-line;
`

export default AgentModeSettings
