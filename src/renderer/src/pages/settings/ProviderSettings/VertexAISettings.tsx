import { InfoCircleOutlined } from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import { useProvider } from '@renderer/hooks/useProvider'
import { useVertexAISettings } from '@renderer/hooks/useVertexAI'
import { Provider, VertexAIMode } from '@renderer/types'
import { Alert, Input, Select, Space } from 'antd'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingHelpText, SettingHelpTextRow, SettingSubtitle } from '..'

interface VertexAISettingsProps {
  provider: Provider
}

const VertexAISettings: FC<VertexAISettingsProps> = ({ provider }) => {
  const { t } = useTranslation()
  const { projectId, location, mode, setProjectId, setLocation, setMode } = useVertexAISettings()
  const { provider: _provider, updateProvider } = useProvider(provider.id)
  const [apiKey, setApiKey] = useState(provider.apiKey)
  const [apiHost, setApiHost] = useState(provider.apiHost)

  const handleModeChange = (newMode: VertexAIMode) => {
    setMode(newMode)
  }

  const handleProjectIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProjectId(e.target.value)
  }

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newLocation = e.target.value
    setLocation(newLocation)
  }

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newApiKey = e.target.value
    updateProvider({ ..._provider, apiKey: newApiKey })
  }

  const handleApiKeyBlur = () => {
    updateProvider({ ..._provider, apiKey: localApiKey })
  }

  const handleApiHostChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newApiHost = e.target.value
    setLocalApiHost(newApiHost)
  }

  const handleApiHostBlur = () => {
    setApiHost(localApiHost)
  }

  const modeOptions = [
    {
      value: 'express',
      label: t('settings.provider.vertex_ai.mode.express'),
      description: t('settings.provider.vertex_ai.mode.express_desc')
    },
    {
      value: 'full',
      label: t('settings.provider.vertex_ai.mode.full'),
      description: t('settings.provider.vertex_ai.mode.full_desc')
    }
  ]

  return (
    <Container>
      <SettingSubtitle style={{ marginBottom: 10 }}>
        <HStack alignItems="center" gap={8}>
          {t('settings.provider.vertex_ai.mode.title')}
          <InfoCircleOutlined style={{ color: 'var(--color-text-3)', fontSize: 12 }} />
        </HStack>
      </SettingSubtitle>

      <Select
        value={mode}
        onChange={handleModeChange}
        style={{ width: '100%', marginTop: 5 }}
        placeholder={t('settings.provider.vertex_ai.mode.title')}>
        {modeOptions.map((option) => (
          <Select.Option key={option.value} value={option.value}>
            <Space direction="vertical" size={0}>
              <strong>{option.label}</strong>
              <span style={{ fontSize: 12, color: 'var(--color-text-3)' }}>{option.description}</span>
            </Space>
          </Select.Option>
        ))}
      </Select>

      {mode === 'express' && (
        <>
          <Alert
            type="info"
            style={{ marginTop: 15 }}
            message={t('settings.provider.vertex_ai.express.title')}
            description={t('settings.provider.vertex_ai.express.description')}
            showIcon
          />

          <SettingSubtitle style={{ marginTop: 20, marginBottom: 5 }}>{t('settings.provider.api_key')}</SettingSubtitle>
          <Input.Password
            value={localApiKey}
            placeholder={t('settings.provider.api_key')}
            onChange={handleApiKeyChange}
            onBlur={handleApiKeyBlur}
            style={{ marginTop: 5 }}
            spellCheck={false}
          />
          <SettingHelpTextRow>
            <SettingHelpText>
              {t('settings.provider.get_api_key')}:{' '}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                Google Cloud Console
              </a>
            </SettingHelpText>
          </SettingHelpTextRow>

          <SettingSubtitle style={{ marginTop: 15, marginBottom: 5 }}>
            {t('settings.provider.api_host')}
          </SettingSubtitle>
          <Input
            value={localApiHost}
            placeholder="https://generativelanguage.googleapis.com"
            onChange={handleApiHostChange}
            onBlur={handleApiHostBlur}
            style={{ marginTop: 5 }}
          />
        </>
      )}

      {mode === 'full' && (
        <>
          <Alert
            type="warning"
            style={{ marginTop: 15 }}
            message={t('settings.provider.vertex_ai.full.title')}
            description={t('settings.provider.vertex_ai.full.description')}
            showIcon
          />

          <SettingSubtitle style={{ marginTop: 20, marginBottom: 5 }}>
            {t('settings.provider.vertex_ai.project_id')}
          </SettingSubtitle>
          <Input
            value={projectId}
            placeholder={t('settings.provider.vertex_ai.project_id_placeholder')}
            onChange={handleProjectIdChange}
            style={{ marginTop: 5 }}
          />
          <SettingHelpTextRow>
            <SettingHelpText>{t('settings.provider.vertex_ai.project_id_help')}</SettingHelpText>
          </SettingHelpTextRow>

          <SettingSubtitle style={{ marginTop: 15, marginBottom: 5 }}>
            {t('settings.provider.vertex_ai.location')}
          </SettingSubtitle>
          <Input value={location} placeholder="us-central1" onChange={handleLocationChange} style={{ marginTop: 5 }} />
          <SettingHelpTextRow>
            <SettingHelpText>{t('settings.provider.vertex_ai.location_help')}</SettingHelpText>
          </SettingHelpTextRow>

          <SettingSubtitle style={{ marginTop: 15, marginBottom: 5 }}>
            {t('settings.provider.api_host')}
          </SettingSubtitle>
          <Input
            value={localApiHost}
            placeholder={`https://${location}-aiplatform.googleapis.com`}
            onChange={handleApiHostChange}
            onBlur={handleApiHostBlur}
            style={{ marginTop: 5 }}
            disabled
          />
          <SettingHelpTextRow>
            <SettingHelpText>API Host 会根据所选地区自动生成</SettingHelpText>
          </SettingHelpTextRow>
        </>
      )}

      <SettingHelpTextRow style={{ marginTop: 20 }}>
        <SettingHelpText>
          {t('settings.provider.vertex_ai.documentation')}
          <a
            href="https://cloud.google.com/vertex-ai/generative-ai/docs/sdks/overview"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 4 }}>
            {t('settings.provider.vertex_ai.learn_more')}
          </a>
        </SettingHelpText>
      </SettingHelpTextRow>
    </Container>
  )
}

const Container = styled.div`
  margin-top: 15px;
`

export default VertexAISettings
