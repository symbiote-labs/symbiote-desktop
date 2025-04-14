import { InfoCircleOutlined } from '@ant-design/icons'
import SelectModelPopup from '@renderer/components/Popups/SelectModelPopup'
import { useProviders } from '@renderer/hooks/useProvider'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { saveMemoryData, setHistoricalContextAnalyzeModel } from '@renderer/store/memory'
import { setEnableHistoricalContext } from '@renderer/store/settings'
import { Button, Switch, Tooltip } from 'antd'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingGroup, SettingHelpText, SettingRow, SettingRowTitle, SettingTitle } from '..'

const HistoricalContextSettings: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()
  const { providers } = useProviders()

  // 获取相关状态
  const enableHistoricalContext = useAppSelector((state) => state.settings.enableHistoricalContext)
  const historicalContextAnalyzeModel = useAppSelector((state) => state.memory.historicalContextAnalyzeModel)

  // 处理开关状态变化
  const handleHistoricalContextToggle = (checked: boolean) => {
    dispatch(setEnableHistoricalContext(checked))
  }

  // 处理模型选择变化
  const handleModelChange = async (modelId: string) => {
    dispatch(setHistoricalContextAnalyzeModel(modelId))
    console.log('[HistoricalContextSettings] Historical context analyze model set:', modelId)

    // 使用Redux Thunk保存到JSON文件
    try {
      await dispatch(saveMemoryData({ historicalContextAnalyzeModel: modelId })).unwrap()
      console.log('[HistoricalContextSettings] Historical context analyze model saved to file successfully:', modelId)
    } catch (error) {
      console.error('[HistoricalContextSettings] Failed to save historical context analyze model to file:', error)
    }
  }

  // 获取当前选中模型的名称
  const getSelectedModelName = () => {
    if (!historicalContextAnalyzeModel) return ''

    // 遍历所有服务商的模型找到匹配的模型
    for (const provider of Object.values(providers)) {
      const model = provider.models.find((m) => m.id === historicalContextAnalyzeModel)
      if (model) {
        return `${model.name} | ${provider.name}`
      }
    }

    return historicalContextAnalyzeModel
  }

  return (
    <SettingGroup>
      <SettingTitle>{t('settings.memory.historicalContext.title') || '历史对话上下文'}</SettingTitle>
      <SettingHelpText>
        {t('settings.memory.historicalContext.description') || '允许AI在需要时自动引用历史对话，以提供更连贯的回答。'}
      </SettingHelpText>

      <SettingRow>
        <SettingRowTitle>
          {t('settings.memory.historicalContext.enable') || '启用历史对话上下文'}
          <Tooltip
            title={
              t('settings.memory.historicalContext.enableTip') ||
              '启用后，AI会在需要时自动分析并引用历史对话，以提供更连贯的回答'
            }>
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </SettingRowTitle>
        <Switch checked={enableHistoricalContext} onChange={handleHistoricalContextToggle} />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>
          {t('settings.memory.analyzeModel') || '分析模型'}
          <Tooltip
            title={
              t('settings.memory.historicalContext.analyzeModelTip') ||
              '选择用于历史对话上下文分析的模型，建议选择响应较快的模型'
            }>
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </SettingRowTitle>
        <Button
          onClick={async () => {
            // 找到当前选中的模型对象
            let currentModel: { id: string; provider: string; name: string; group: string } | undefined
            if (historicalContextAnalyzeModel) {
              for (const provider of Object.values(providers)) {
                const model = provider.models.find((m) => m.id === historicalContextAnalyzeModel)
                if (model) {
                  currentModel = model
                  break
                }
              }
            }

            const selectedModel = await SelectModelPopup.show({ model: currentModel })
            if (selectedModel) {
              handleModelChange(selectedModel.id)
            }
          }}
          style={{ width: 300 }}>
          {historicalContextAnalyzeModel ? getSelectedModelName() : t('settings.memory.selectModel') || '选择模型'}
        </Button>
      </SettingRow>
    </SettingGroup>
  )
}

export default HistoricalContextSettings
