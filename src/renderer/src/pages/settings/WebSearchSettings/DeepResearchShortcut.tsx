import { useTheme } from '@renderer/context/ThemeProvider'
import { modelGenerating } from '@renderer/hooks/useRuntime'
import { Button, message } from 'antd'
import { Microscope } from 'lucide-react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

const DeepResearchShortcut: FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { theme: themeMode } = useTheme()

  const handleOpenDeepResearch = async () => {
    try {
      await modelGenerating()
      navigate('/deepresearch')
      message.success(t('deepresearch.open_success', '正在打开深度研究页面'))
    } catch (error) {
      console.error('打开深度研究页面失败:', error)
      message.error(t('deepresearch.open_error', '打开深度研究页面失败'))
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
        <Button type="primary" onClick={handleOpenDeepResearch}>
          {t('deepresearch.open', '打开深度研究')}
        </Button>
      </SettingRow>
    </SettingGroup>
  )
}

const IconWrapper = styled.span`
  margin-right: 8px;
  display: inline-flex;
  align-items: center;
`

export default DeepResearchShortcut
