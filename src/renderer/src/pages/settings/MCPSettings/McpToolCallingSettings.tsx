import { InfoCircleOutlined } from '@ant-design/icons'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { useAppDispatch } from '@renderer/store'
import { setUsePromptForToolCalling } from '@renderer/store/settings'
import { Switch, Tooltip } from 'antd'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

const McpToolCallingSettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const dispatch = useAppDispatch()
  const { usePromptForToolCalling } = useSettings()

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>{t('settings.mcp.tool_calling.title', '工具调用设置')}</SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>
            {t('settings.mcp.tool_calling.use_prompt', '使用提示词调用工具')}
            <Tooltip
              title={t(
                'settings.mcp.tool_calling.use_prompt_tooltip',
                '启用后，将使用提示词而非函数调用来调用MCP工具。适用于所有模型，但可能不如函数调用精确。'
              )}
              placement="right">
              <InfoCircleOutlined style={{ marginLeft: 8, color: 'var(--color-text-3)' }} />
            </Tooltip>
          </SettingRowTitle>
          <Switch
            checked={usePromptForToolCalling}
            onChange={(checked) => dispatch(setUsePromptForToolCalling(checked))}
          />
        </SettingRow>
        <SettingDivider />
        <Description>
          {t(
            'settings.mcp.tool_calling.description',
            '提示词调用工具：适用于所有模型，但可能不如函数调用精确。\n函数调用工具：仅适用于支持函数调用的模型，但调用更精确。'
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

export default McpToolCallingSettings
