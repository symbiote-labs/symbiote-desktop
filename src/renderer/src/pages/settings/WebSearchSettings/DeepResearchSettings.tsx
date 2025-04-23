import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import SelectModelPopup from '@renderer/components/Popups/SelectModelPopup'
import { useTheme } from '@renderer/context/ThemeProvider'
import { getModelUniqId } from '@renderer/services/ModelService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setDeepResearchConfig } from '@renderer/store/websearch'
import { Model } from '@renderer/types'
import { Button, InputNumber, Space, Switch } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import { SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

const SubDescription = styled.div`
  font-size: 12px;
  color: #888;
  margin-top: 4px;
`

const DeepResearchSettings: FC = () => {
  const { t } = useTranslation()
  const { theme: themeMode } = useTheme()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const providers = useAppSelector((state) => state.llm.providers)
  const deepResearchConfig = useAppSelector((state) => state.websearch.deepResearchConfig) || {
    maxIterations: 3,
    maxResultsPerQuery: 20,
    autoSummary: true,
    enableQueryOptimization: true
  }

  // 当前选择的模型
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)

  // 初始化时，如果有保存的模型ID，则加载对应的模型
  useEffect(() => {
    if (deepResearchConfig.modelId) {
      const allModels = providers.flatMap((p) => p.models)
      const model = allModels.find((m) => getModelUniqId(m) === deepResearchConfig.modelId)
      if (model) {
        setSelectedModel(model)
      }
    }
  }, [deepResearchConfig.modelId, providers])

  const handleMaxIterationsChange = (value: number | null) => {
    if (value !== null) {
      dispatch(
        setDeepResearchConfig({
          ...deepResearchConfig,
          maxIterations: value
        })
      )
    }
  }

  const handleMaxResultsPerQueryChange = (value: number | null) => {
    if (value !== null) {
      dispatch(
        setDeepResearchConfig({
          ...deepResearchConfig,
          maxResultsPerQuery: value
        })
      )
    }
  }

  const handleAutoSummaryChange = (checked: boolean) => {
    dispatch(
      setDeepResearchConfig({
        ...deepResearchConfig,
        autoSummary: checked
      })
    )
  }

  const handleQueryOptimizationChange = (checked: boolean) => {
    dispatch(
      setDeepResearchConfig({
        ...deepResearchConfig,
        enableQueryOptimization: checked
      })
    )
  }

  const handleOpenDeepResearch = () => {
    navigate('/deepresearch')
  }

  const handleSelectModel = async () => {
    const model = await SelectModelPopup.show({ model: selectedModel || undefined })
    if (model) {
      setSelectedModel(model)
      dispatch(
        setDeepResearchConfig({
          ...deepResearchConfig,
          modelId: getModelUniqId(model)
        })
      )
    }
  }

  return (
    <SettingGroup theme={themeMode}>
      <SettingTitle>{t('settings.websearch.deep_research.title')}</SettingTitle>
      <SettingDivider />

      <SettingRow>
        <SettingRowTitle>
          {t('deepresearch.description', '通过多轮搜索、分析和总结，提供全面的研究报告')}
          <SubDescription>
            {t('deepresearch.engine_rotation', '每次迭代使用不同类别的搜索引擎：中文、国际、元搜索和学术搜索')}
          </SubDescription>
        </SettingRowTitle>
        <Button type="primary" onClick={handleOpenDeepResearch}>
          {t('deepresearch.open', '打开深度研究')}
        </Button>
      </SettingRow>

      <SettingDivider />

      <SettingRow>
        <SettingRowTitle>{t('settings.model.select', '选择模型')}</SettingRowTitle>
        <Button onClick={handleSelectModel}>
          {selectedModel ? (
            <Space>
              <ModelAvatar model={selectedModel} size={20} />
              <span>{selectedModel.name}</span>
            </Space>
          ) : (
            t('settings.model.select_model', '选择模型')
          )}
        </Button>
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>{t('settings.websearch.deep_research.max_iterations')}</SettingRowTitle>
        <InputNumber min={1} max={10} value={deepResearchConfig.maxIterations} onChange={handleMaxIterationsChange} />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>{t('settings.websearch.deep_research.max_results_per_query')}</SettingRowTitle>
        <InputNumber
          min={1}
          max={50}
          value={deepResearchConfig.maxResultsPerQuery}
          onChange={handleMaxResultsPerQueryChange}
        />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>{t('settings.websearch.deep_research.auto_summary')}</SettingRowTitle>
        <Switch checked={deepResearchConfig.autoSummary} onChange={handleAutoSummaryChange} />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>
          {t('settings.websearch.deep_research.enable_query_optimization', '启用查询优化')}
          <SubDescription>
            {t(
              'settings.websearch.deep_research.query_optimization_desc',
              '使用 AI 分析您的问题并生成更有效的搜索查询'
            )}
          </SubDescription>
        </SettingRowTitle>
        <Switch checked={deepResearchConfig.enableQueryOptimization} onChange={handleQueryOptimizationChange} />
      </SettingRow>
    </SettingGroup>
  )
}

export default DeepResearchSettings
