import { InfoCircleOutlined } from '@ant-design/icons'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  clearCurrentRecommendations,
  saveMemoryData,
  setAutoRecommendMemories,
  setContextualRecommendationEnabled,
  setRecommendationThreshold
} from '@renderer/store/memory'
import { Button, InputNumber, Slider, Switch, Tooltip } from 'antd'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingDivider, SettingGroup, SettingHelpText, SettingRow, SettingRowTitle, SettingTitle } from '..'

const SliderContainer = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 300px;
  margin-right: 16px;
`

const ContextualRecommendationSettings: FC = () => {
  const { t } = useTranslation()
  const dispatch = useAppDispatch()

  // 获取相关状态
  const contextualRecommendationEnabled = useAppSelector((state) => state.memory.contextualRecommendationEnabled)
  const autoRecommendMemories = useAppSelector((state) => state.memory.autoRecommendMemories)
  const recommendationThreshold = useAppSelector((state) => state.memory.recommendationThreshold)

  // 处理开关状态变化
  const handleContextualRecommendationToggle = async (checked: boolean) => {
    dispatch(setContextualRecommendationEnabled(checked))

    // 保存设置
    try {
      await dispatch(saveMemoryData({ contextualRecommendationEnabled: checked })).unwrap()
      console.log('[ContextualRecommendationSettings] Contextual recommendation enabled setting saved:', checked)
    } catch (error) {
      console.error(
        '[ContextualRecommendationSettings] Failed to save contextual recommendation enabled setting:',
        error
      )
    }
  }

  const handleAutoRecommendToggle = async (checked: boolean) => {
    dispatch(setAutoRecommendMemories(checked))

    // 保存设置
    try {
      await dispatch(saveMemoryData({ autoRecommendMemories: checked })).unwrap()
      console.log('[ContextualRecommendationSettings] Auto recommend memories setting saved:', checked)
    } catch (error) {
      console.error('[ContextualRecommendationSettings] Failed to save auto recommend memories setting:', error)
    }
  }

  // 处理推荐阈值变化
  const handleThresholdChange = async (value: number | null) => {
    if (value !== null) {
      dispatch(setRecommendationThreshold(value))

      // 保存设置
      try {
        await dispatch(saveMemoryData({ recommendationThreshold: value })).unwrap()
        console.log('[ContextualRecommendationSettings] Recommendation threshold setting saved:', value)
      } catch (error) {
        console.error('[ContextualRecommendationSettings] Failed to save recommendation threshold setting:', error)
      }
    }
  }

  // 清除当前推荐
  const handleClearRecommendations = () => {
    dispatch(clearCurrentRecommendations())
  }

  return (
    <SettingGroup>
      <SettingTitle>{t('settings.memory.contextualRecommendation.title') || '上下文感知记忆推荐'}</SettingTitle>
      <SettingHelpText>
        {t('settings.memory.contextualRecommendation.description') ||
          '根据当前对话上下文智能推荐相关记忆，提高AI回复的相关性和连贯性。'}
      </SettingHelpText>

      <SettingRow>
        <SettingRowTitle>
          {t('settings.memory.contextualRecommendation.enable') || '启用上下文感知记忆推荐'}
          <Tooltip
            title={
              t('settings.memory.contextualRecommendation.enableTip') ||
              '启用后，系统将根据当前对话上下文自动推荐相关记忆'
            }>
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </SettingRowTitle>
        <Switch checked={contextualRecommendationEnabled} onChange={handleContextualRecommendationToggle} />
      </SettingRow>

      <SettingDivider />

      <SettingRow>
        <SettingRowTitle>
          {t('settings.memory.contextualRecommendation.autoRecommend') || '自动推荐记忆'}
          <Tooltip
            title={
              t('settings.memory.contextualRecommendation.autoRecommendTip') ||
              '启用后，系统将定期自动分析当前对话并推荐相关记忆'
            }>
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </SettingRowTitle>
        <Switch
          checked={autoRecommendMemories}
          onChange={handleAutoRecommendToggle}
          disabled={!contextualRecommendationEnabled}
        />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>
          {t('settings.memory.contextualRecommendation.threshold') || '推荐阈值'}
          <Tooltip
            title={
              t('settings.memory.contextualRecommendation.thresholdTip') || '设置记忆推荐的相似度阈值，值越高要求越严格'
            }>
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </SettingRowTitle>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <SliderContainer>
            <Slider
              min={0.1}
              max={0.9}
              step={0.05}
              value={recommendationThreshold}
              onChange={handleThresholdChange}
              disabled={!contextualRecommendationEnabled}
              style={{ flex: 1 }}
            />
          </SliderContainer>
          <InputNumber
            min={0.1}
            max={0.9}
            step={0.05}
            value={recommendationThreshold}
            onChange={handleThresholdChange}
            disabled={!contextualRecommendationEnabled}
            style={{ width: 70 }}
          />
        </div>
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>
          {t('settings.memory.contextualRecommendation.clearRecommendations') || '清除当前推荐'}
          <Tooltip
            title={t('settings.memory.contextualRecommendation.clearRecommendationsTip') || '清除当前的记忆推荐列表'}>
            <InfoCircleOutlined style={{ marginLeft: 8 }} />
          </Tooltip>
        </SettingRowTitle>
        <Button onClick={handleClearRecommendations} disabled={!contextualRecommendationEnabled}>
          {t('settings.memory.contextualRecommendation.clear') || '清除'}
        </Button>
      </SettingRow>
    </SettingGroup>
  )
}

export default ContextualRecommendationSettings
