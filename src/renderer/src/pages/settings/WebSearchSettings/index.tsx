import { useTheme } from '@renderer/context/ThemeProvider'
import { useDefaultWebSearchProvider, useWebSearchProviders } from '@renderer/hooks/useWebSearchProviders'
import { WebSearchProvider } from '@renderer/types'
import { hasObjectKey } from '@renderer/utils'
import { Select, Spin } from 'antd'
import React, { FC, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'
import BasicSettings from './BasicSettings'
import BlacklistSettings from './BlacklistSettings'
import DeepResearchSettings from './DeepResearchSettings'
import DeepSearchSettings from './DeepSearchSettings'
import WebSearchProviderSetting from './WebSearchProviderSetting'

// 导入Jina搜索设置组件
const JinaSearchSettings = React.lazy(() => import('./JinaSearchSettings'))

const WebSearchSettings: FC = () => {
  const { providers } = useWebSearchProviders()
  const { provider: defaultProvider, setDefaultProvider } = useDefaultWebSearchProvider()
  const { t } = useTranslation()
  const [selectedProvider, setSelectedProvider] = useState<WebSearchProvider | undefined>(defaultProvider)
  const { theme: themeMode } = useTheme()

  const isLocalProvider = selectedProvider?.id.startsWith('local')

  function updateSelectedWebSearchProvider(providerId: string) {
    const provider = providers.find((p) => p.id === providerId)
    if (!provider) {
      return
    }
    setSelectedProvider(provider)
    setDefaultProvider(provider)
  }

  return (
    <SettingContainer theme={themeMode}>
      <SettingGroup theme={themeMode}>
        <SettingTitle>{t('settings.websearch.title')}</SettingTitle>
        <SettingDivider />
        <SettingRow>
          <SettingRowTitle>{t('settings.websearch.search_provider')}</SettingRowTitle>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Select
              value={selectedProvider?.id}
              style={{ width: '200px' }}
              onChange={(value: string) => updateSelectedWebSearchProvider(value)}
              placeholder={t('settings.websearch.search_provider_placeholder')}
              options={providers.map((p) => ({
                value: p.id,
                label: `${p.name} (${hasObjectKey(p, 'apiKey') ? t('settings.websearch.apikey') : t('settings.websearch.free')})`
              }))}
            />
          </div>
        </SettingRow>
      </SettingGroup>
      {!isLocalProvider && (
        <SettingGroup theme={themeMode}>
          {selectedProvider && <WebSearchProviderSetting provider={selectedProvider} />}
        </SettingGroup>
      )}
      {/* 根据选择的提供商显示特定设置 */}
      {selectedProvider?.id === 'jina' && (
        <SettingGroup theme={themeMode}>
          <Suspense fallback={<Spin />}>
            <JinaSearchSettings providerId="jina" />
          </Suspense>
        </SettingGroup>
      )}

      <BasicSettings />
      <BlacklistSettings />
      {selectedProvider?.id !== 'deep-search' && <DeepSearchSettings />}
      <DeepResearchSettings />
    </SettingContainer>
  )
}
export default WebSearchSettings
