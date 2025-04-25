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

  // 当前选择的主模型
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  // 当前选择的链接相关性评估模型
  const [linkRelevanceModel, setLinkRelevanceModel] = useState<Model | null>(null)

  // 初始化时，如果有保存的模型ID，则加载对应的模型
  useEffect(() => {
    const allModels = providers.flatMap((p) => p.models)

    // 加载主模型
    if (deepResearchConfig?.modelId) {
      const model = allModels.find((m) => getModelUniqId(m) === deepResearchConfig.modelId)
      if (model) {
        setSelectedModel(model)
      }
    }

    // 加载链接相关性评估模型
    if (deepResearchConfig?.linkRelevanceModelId) {
      const model = allModels.find((m) => getModelUniqId(m) === deepResearchConfig.linkRelevanceModelId)
      if (model) {
        setLinkRelevanceModel(model)
      }
    }
  }, [deepResearchConfig?.modelId, deepResearchConfig?.linkRelevanceModelId, providers])

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

  const handleMaxReportLinksChange = (value: number | null) => {
    if (value !== null) {
      dispatch(
        setDeepResearchConfig({
          ...deepResearchConfig,
          maxReportLinks: value
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

  const handleLinkRelevanceFilterChange = (checked: boolean) => {
    dispatch(
      setDeepResearchConfig({
        ...deepResearchConfig,
        enableLinkRelevanceFilter: checked
      })
    )
  }

  const handleLinkRelevanceThresholdChange = (value: number | null) => {
    if (value !== null) {
      dispatch(
        setDeepResearchConfig({
          ...deepResearchConfig,
          linkRelevanceThreshold: value
        })
      )
    }
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

  const handleSelectLinkRelevanceModel = async () => {
    const model = await SelectModelPopup.show({ model: linkRelevanceModel || undefined })
    if (model) {
      setLinkRelevanceModel(model)
      dispatch(
        setDeepResearchConfig({
          ...deepResearchConfig,
          linkRelevanceModelId: getModelUniqId(model)
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

      {/* 新增：最终报告最大链接数 */}
      <SettingRow>
        <SettingRowTitle>
          {t('settings.websearch.deep_research.max_report_links', '最终报告最大链接数')}
        </SettingRowTitle>
        <InputNumber
          min={1}
          max={50} // 可以根据需要调整最大值
          value={deepResearchConfig.maxReportLinks}
          onChange={handleMaxReportLinksChange}
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

      <SettingDivider />

      <SettingRow>
        <SettingRowTitle>
          {t('settings.websearch.deep_research.enable_link_relevance_filter', '启用链接相关性过滤')}
          <SubDescription>
            {t(
              'settings.websearch.deep_research.link_relevance_filter_desc',
              '使用 AI 评估链接与研究问题的相关性，过滤掉不相关的链接'
            )}
          </SubDescription>
        </SettingRowTitle>
        <Switch checked={deepResearchConfig.enableLinkRelevanceFilter} onChange={handleLinkRelevanceFilterChange} />
      </SettingRow>

      {deepResearchConfig.enableLinkRelevanceFilter && (
        <SettingRow>
          <SettingRowTitle>
            {t('settings.websearch.deep_research.link_relevance_threshold', '链接相关性阈值')}
            <SubDescription>
              {t(
                'settings.websearch.deep_research.link_relevance_threshold_desc',
                '相关性评分低于此值的链接将被过滤掉 (0-1)'
              )}
            </SubDescription>
          </SettingRowTitle>
          <InputNumber
            min={0}
            max={1}
            step={0.1}
            value={deepResearchConfig.linkRelevanceThreshold}
            onChange={handleLinkRelevanceThresholdChange}
          />
        </SettingRow>
      )}

      <SettingRow>
        <SettingRowTitle>
          {t('settings.websearch.deep_research.link_relevance_model', '链接相关性评估模型')}
          <SubDescription>
            {t(
              'settings.websearch.deep_research.link_relevance_model_desc',
              '用于评估链接相关性的模型，如未选择则使用主模型'
            )}
          </SubDescription>
        </SettingRowTitle>
        <Button onClick={handleSelectLinkRelevanceModel}>
          {linkRelevanceModel ? (
            <Space>
              <ModelAvatar model={linkRelevanceModel} size={20} />
              <span>{linkRelevanceModel.name}</span>
            </Space>
          ) : (
            t('settings.model.select_model', '选择模型')
          )}
        </Button>
      </SettingRow>
    </SettingGroup>
  )
}

export default DeepResearchSettings
