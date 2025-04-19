import { useSettings } from '@renderer/hooks/useSettings'
import {
  SettingContainer,
  SettingDivider,
  SettingGroup,
  SettingRow,
  SettingRowTitle,
  SettingTitle
} from '@renderer/pages/settings/styles'
import { setPdfSettings } from '@renderer/store/settings'
import { Input, Switch } from 'antd'
import { FC, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import styled from 'styled-components'

const PDFSettings: FC = () => {
  const { t } = useTranslation()
  const { theme, pdfSettings } = useSettings()
  const dispatch = useDispatch()

  // 初始化默认值，防止pdfSettings为undefined
  const defaultPdfSettings = useMemo(
    () => ({
      enablePdfSplitting: true,
      defaultPageRangePrompt: '输入页码范围，例如：1-5,8,10-15'
    }),
    []
  )

  // 在组件加载时初始化PDF设置
  useEffect(() => {
    console.log('[PDFSettings] Component mounted, initializing PDF settings')
    // 如果pdfSettings为undefined或缺少enablePdfSplitting属性，则使用默认值初始化
    if (!pdfSettings || pdfSettings.enablePdfSplitting === undefined) {
      console.log('[PDFSettings] pdfSettings is incomplete, initializing with defaults:', defaultPdfSettings)
      // 如果pdfSettings存在，则合并现有设置和默认设置
      const mergedSettings = {
        ...defaultPdfSettings,
        ...pdfSettings,
        // 确保 enablePdfSplitting 存在且为 true
        enablePdfSplitting: true
      }
      console.log('[PDFSettings] Merged settings:', mergedSettings)
      dispatch(setPdfSettings(mergedSettings))
    } else {
      console.log('[PDFSettings] Current pdfSettings:', pdfSettings)
    }
  }, [pdfSettings, defaultPdfSettings, dispatch])

  const handleEnablePdfSplittingChange = (checked: boolean) => {
    dispatch(setPdfSettings({ enablePdfSplitting: checked }))
  }

  const handleDefaultPageRangePromptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setPdfSettings({ defaultPageRangePrompt: e.target.value }))
  }

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>{t('settings.pdf.title')}</SettingTitle>
        <SettingDivider />

        <SettingRow>
          <SettingRowTitle>{t('settings.pdf.enable_splitting')}</SettingRowTitle>
          <Switch
            checked={pdfSettings?.enablePdfSplitting ?? defaultPdfSettings.enablePdfSplitting}
            onChange={handleEnablePdfSplittingChange}
          />
        </SettingRow>

        <SettingDivider />

        <SettingRow>
          <SettingRowTitle>{t('settings.pdf.default_page_range_prompt')}</SettingRowTitle>
          <Input
            value={pdfSettings?.defaultPageRangePrompt ?? defaultPdfSettings.defaultPageRangePrompt}
            onChange={handleDefaultPageRangePromptChange}
            placeholder={t('settings.pdf.default_page_range_prompt_placeholder')}
            style={{ width: 300 }}
          />
        </SettingRow>

        <Description>{t('settings.pdf.description')}</Description>
      </SettingGroup>
    </SettingContainer>
  )
}

const Description = styled.div`
  margin-top: 20px;
  color: var(--color-text-2);
  font-size: 14px;
  line-height: 1.5;
`

export default PDFSettings
