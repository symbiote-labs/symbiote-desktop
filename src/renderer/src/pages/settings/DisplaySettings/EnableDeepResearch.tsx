import { useTheme } from '@renderer/context/ThemeProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { useAppDispatch } from '@renderer/store'
import { setSidebarIcons, SidebarIcon } from '@renderer/store/settings'
import { Button, message } from 'antd'
import { Microscope } from 'lucide-react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

const EnableDeepResearch: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { sidebarIcons } = useSettings()
  const { theme: themeMode } = useTheme()

  const isDeepResearchEnabled = sidebarIcons.visible.includes('deepresearch')

  const handleEnableDeepResearch = () => {
    if (!isDeepResearchEnabled) {
      const newVisibleIcons: SidebarIcon[] = [...sidebarIcons.visible, 'deepresearch' as SidebarIcon]
      dispatch(setSidebarIcons({ visible: newVisibleIcons }))
      message.success(t('deepresearch.enable_success', '深度研究功能已启用，请查看侧边栏'))
    }
  }

  return (
    <SettingGroup theme={themeMode}>
      <SettingTitle>
        <IconWrapper>
          <Microscope size={18} />
        </IconWrapper>
        {t('deepresearch.title', '深度研究')}
      </SettingTitle>
      <SettingDivider />
      <SettingRow>
        <SettingRowTitle>
          {t('deepresearch.description', '通过多轮搜索、分析和总结，提供全面的研究报告')}
        </SettingRowTitle>
        {!isDeepResearchEnabled ? (
          <Button type="primary" onClick={handleEnableDeepResearch}>
            {t('deepresearch.enable', '启用深度研究')}
          </Button>
        ) : (
          <EnabledText>{t('deepresearch.already_enabled', '已启用')}</EnabledText>
        )}
      </SettingRow>
    </SettingGroup>
  )
}

const IconWrapper = styled.span`
  margin-right: 8px;
  display: inline-flex;
  align-items: center;
`

const EnabledText = styled.span`
  color: var(--color-success);
  font-weight: 500;
`

export default EnableDeepResearch
