import { ApiOutlined, InfoCircleOutlined, PlusOutlined } from '@ant-design/icons'
import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import { HStack, VStack } from '@renderer/components/Layout'
import SelectModelPopup from '@renderer/components/Popups/SelectModelPopup'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useProviders } from '@renderer/hooks/useProvider'
import { Model } from '@renderer/types'
// 不再需要 useAppDispatch
import { createAllDeepClaudeProviders } from '@renderer/utils/createDeepClaudeProvider'
import { Button, Divider, Form, Input, message, Switch, Tooltip } from 'antd'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

interface ModelCombination {
  id: string
  name: string
  reasonerModel: string
  targetModel: string
  enabled: boolean
}

const DeepClaudeSettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const { providers } = useProviders()

  // 本地状态
  const [combinations, setCombinations] = useState<ModelCombination[]>([])
  const [newCombination, setNewCombination] = useState<{
    name: string
    reasonerModel: string
    targetModel: string
  }>({
    name: '',
    reasonerModel: '',
    targetModel: ''
  })

  // 编辑状态
  const [editingCombination, setEditingCombination] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    name: string
    reasonerModel: string
    targetModel: string
  }>({
    name: '',
    reasonerModel: '',
    targetModel: ''
  })

  // 获取所有可用的模型
  const allModels = providers.flatMap((provider) =>
    provider.models.map((model) => ({
      ...model,
      providerName: provider.name,
      providerId: provider.id
    }))
  )

  // 推荐的推理模型
  const recommendedReasonerModels = allModels.filter((model) => {
    // 推荐 DeepSeek 模型作为推理模型
    return (
      model.name.toLowerCase().includes('deepseek') ||
      model.name.toLowerCase().includes('deep-seek') ||
      model.name.toLowerCase().includes('yi') ||
      model.name.toLowerCase().includes('qwen') ||
      model.name.toLowerCase().includes('glm')
    )
  })

  // 推荐的目标模型
  const recommendedTargetModels = allModels.filter((model) => {
    // 推荐 Claude 和 Gemini 模型作为目标模型
    return (
      model.name.toLowerCase().includes('claude') ||
      model.name.toLowerCase().includes('gemini') ||
      model.name.toLowerCase().includes('gpt')
    )
  })

  // 创建提供商
  const createProvider = () => {
    try {
      // 使用新的方式创建提供商
      message.info(t('settings.deepclaude.provider_created_info'))
    } catch (error) {
      console.error('创建DeepClaude提供商失败:', error)
      message.error(t('settings.deepclaude.provider_create_failed'))
    }
  }

  // 创建所有提供商
  const createAllProviders = () => {
    try {
      const providers = createAllDeepClaudeProviders()
      if (providers.length > 0) {
        message.success(t('settings.deepclaude.all_providers_created', { count: providers.length }))
      } else {
        message.info(t('settings.deepclaude.no_combinations'))
      }
    } catch (error) {
      console.error('创建所有DeepClaude提供商失败:', error)
      message.error(t('settings.deepclaude.all_providers_create_failed'))
    }
  }

  // 添加新组合
  const addCombination = () => {
    if (!newCombination.name || !newCombination.reasonerModel || !newCombination.targetModel) {
      return
    }

    const newCombinations = [
      ...combinations,
      {
        id: `deepclaude-${Date.now()}`,
        name: newCombination.name,
        reasonerModel: newCombination.reasonerModel,
        targetModel: newCombination.targetModel,
        enabled: true
      }
    ]

    setCombinations(newCombinations)

    // 重置表单
    setNewCombination({
      name: '',
      reasonerModel: '',
      targetModel: ''
    })
  }

  // 开始编辑组合
  const startEditCombination = (id: string) => {
    const combination = combinations.find((c) => c.id === id)
    if (!combination) return

    setEditingCombination(id)
    setEditForm({
      name: combination.name,
      reasonerModel: combination.reasonerModel,
      targetModel: combination.targetModel
    })
  }

  // 保存编辑
  const saveEditCombination = () => {
    if (!editingCombination || !editForm.name || !editForm.reasonerModel || !editForm.targetModel) {
      return
    }

    const newCombinations = combinations.map((c) =>
      c.id === editingCombination
        ? {
            ...c,
            name: editForm.name,
            reasonerModel: editForm.reasonerModel,
            targetModel: editForm.targetModel
          }
        : c
    )

    setCombinations(newCombinations)

    // 退出编辑模式
    cancelEdit()
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingCombination(null)
    setEditForm({
      name: '',
      reasonerModel: '',
      targetModel: ''
    })
  }

  // 删除组合
  const deleteCombination = (id: string) => {
    const newCombinations = combinations.filter((c) => c.id !== id)
    setCombinations(newCombinations)
  }

  // 更新组合状态
  const updateCombinationStatus = (id: string, enabled: boolean) => {
    const newCombinations = combinations.map((c) => (c.id === id ? { ...c, enabled } : c))
    setCombinations(newCombinations)
  }

  // 获取模型名称
  const getModelFullName = (modelId: string) => {
    const model = allModels.find((m) => m.id === modelId)
    if (!model) return modelId
    return `${model.name} (${model.providerName})`
  }

  // 获取模型对象
  const getModelById = (modelId: string): Model | undefined => {
    return allModels.find((m) => m.id === modelId)
  }

  // 选择推理模型
  const selectReasonerModel = async () => {
    try {
      const currentModel = getModelById(newCombination.reasonerModel)
      const selectedModel = await SelectModelPopup.show({ model: currentModel })
      if (selectedModel) {
        // 保存模型 ID 和提供商信息
        setNewCombination({
          ...newCombination,
          reasonerModel: selectedModel.id
        })
        console.log('选择推理模型:', selectedModel.name, '提供商:', selectedModel.provider)
      }
      // 确保弹窗关闭
      SelectModelPopup.hide()
    } catch (error) {
      console.error('选择推理模型出错:', error)
      SelectModelPopup.hide()
    }
  }

  // 选择目标模型
  const selectTargetModel = async () => {
    try {
      const currentModel = getModelById(newCombination.targetModel)
      const selectedModel = await SelectModelPopup.show({ model: currentModel })
      if (selectedModel) {
        // 保存模型 ID 和提供商信息
        setNewCombination({
          ...newCombination,
          targetModel: selectedModel.id
        })
        console.log('选择目标模型:', selectedModel.name, '提供商:', selectedModel.provider)
      }
      // 确保弹窗关闭
      SelectModelPopup.hide()
    } catch (error) {
      console.error('选择目标模型出错:', error)
      SelectModelPopup.hide()
    }
  }

  // 编辑时选择推理模型
  const selectEditReasonerModel = async () => {
    try {
      const currentModel = getModelById(editForm.reasonerModel)
      const selectedModel = await SelectModelPopup.show({ model: currentModel })
      if (selectedModel) {
        // 保存模型 ID 和提供商信息
        setEditForm({
          ...editForm,
          reasonerModel: selectedModel.id
        })
        console.log('编辑时选择推理模型:', selectedModel.name, '提供商:', selectedModel.provider)
      }
      // 确保弹窗关闭
      SelectModelPopup.hide()
    } catch (error) {
      console.error('编辑时选择推理模型出错:', error)
      SelectModelPopup.hide()
    }
  }

  // 编辑时选择目标模型
  const selectEditTargetModel = async () => {
    try {
      const currentModel = getModelById(editForm.targetModel)
      const selectedModel = await SelectModelPopup.show({ model: currentModel })
      if (selectedModel) {
        // 保存模型 ID 和提供商信息
        setEditForm({
          ...editForm,
          targetModel: selectedModel.id
        })
        console.log('编辑时选择目标模型:', selectedModel.name, '提供商:', selectedModel.provider)
      }
      // 确保弹窗关闭
      SelectModelPopup.hide()
    } catch (error) {
      console.error('编辑时选择目标模型出错:', error)
      SelectModelPopup.hide()
    }
  }

  return (
    <SettingContainer theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>
          <HStack alignItems="center" gap={10}>
            {t('settings.deepclaude.title')}
            <Tooltip title={t('settings.deepclaude.tooltip')}>
              <InfoCircleOutlined />
            </Tooltip>
          </HStack>
        </SettingTitle>
        <SettingDivider />

        {/* 现有组合列表 */}
        {combinations.length > 0 && (
          <>
            <SettingRow>
              <SettingRowTitle>{t('settings.deepclaude.combinations')}</SettingRowTitle>
            </SettingRow>

            {combinations.map((combination) => (
              <CombinationItem key={combination.id}>
                <VStack gap={10}>
                  <HStack justifyContent="space-between" alignItems="center">
                    <strong>{combination.name}</strong>
                    <Switch
                      checked={combination.enabled}
                      onChange={(enabled) => updateCombinationStatus(combination.id, enabled)}
                    />
                  </HStack>
                  <HStack gap={10}>
                    <ModelInfo>
                      <ModelLabel>{t('settings.deepclaude.reasoner')}:</ModelLabel>
                      <ModelValue>{getModelFullName(combination.reasonerModel)}</ModelValue>
                    </ModelInfo>
                    <ModelInfo>
                      <ModelLabel>{t('settings.deepclaude.target')}:</ModelLabel>
                      <ModelValue>{getModelFullName(combination.targetModel)}</ModelValue>
                    </ModelInfo>
                  </HStack>
                  <HStack justifyContent="flex-end" gap={8}>
                    <Button type="primary" size="small" icon={<ApiOutlined />} onClick={() => createProvider()}>
                      {t('settings.deepclaude.create_provider')}
                    </Button>
                    <Button type="default" size="small" onClick={() => startEditCombination(combination.id)}>
                      {t('common.edit')}
                    </Button>
                    <Button danger size="small" onClick={() => deleteCombination(combination.id)}>
                      {t('common.delete')}
                    </Button>
                  </HStack>
                </VStack>
              </CombinationItem>
            ))}

            <Divider style={{ margin: '20px 0' }} />
          </>
        )}

        {combinations.length > 0 && (
          <HStack justifyContent="flex-end" style={{ marginBottom: '20px' }}>
            <Button type="primary" icon={<ApiOutlined />} onClick={createAllProviders}>
              {t('settings.deepclaude.create_all_providers')}
            </Button>
          </HStack>
        )}

        {/* 编辑组合表单 */}
        {editingCombination && (
          <>
            <SettingRow>
              <SettingRowTitle>{t('settings.deepclaude.edit_combination')}</SettingRowTitle>
            </SettingRow>

            <Form layout="vertical">
              <Form.Item label={t('settings.deepclaude.combination_name')}>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder={t('settings.deepclaude.combination_name_placeholder')}
                />
              </Form.Item>

              <Form.Item label={t('settings.deepclaude.select_reasoner')}>
                <ModelSelectButton
                  model={getModelById(editForm.reasonerModel)}
                  onClick={selectEditReasonerModel}
                  placeholder={t('settings.deepclaude.select_reasoner_placeholder')}
                  recommended={recommendedReasonerModels.some((m) => m.id === editForm.reasonerModel) ? '★' : ''}
                />
              </Form.Item>
              <ModelTip>{t('settings.deepclaude.reasoner_tip')}</ModelTip>

              <Form.Item label={t('settings.deepclaude.select_target')}>
                <ModelSelectButton
                  model={getModelById(editForm.targetModel)}
                  onClick={selectEditTargetModel}
                  placeholder={t('settings.deepclaude.select_target_placeholder')}
                  recommended={recommendedTargetModels.some((m) => m.id === editForm.targetModel) ? '★' : ''}
                />
              </Form.Item>
              <ModelTip>{t('settings.deepclaude.target_tip')}</ModelTip>

              <Form.Item>
                <HStack gap={8}>
                  <Button
                    type="primary"
                    onClick={saveEditCombination}
                    disabled={!editForm.name || !editForm.reasonerModel || !editForm.targetModel}>
                    {t('common.save')}
                  </Button>
                  <Button onClick={cancelEdit}>{t('common.cancel')}</Button>
                </HStack>
              </Form.Item>
            </Form>

            <Divider style={{ margin: '20px 0' }} />
          </>
        )}

        {/* 添加新组合表单 */}
        {!editingCombination && (
          <>
            <SettingRow>
              <SettingRowTitle>{t('settings.deepclaude.add_combination')}</SettingRowTitle>
            </SettingRow>

            <Form layout="vertical">
              <Form.Item label={t('settings.deepclaude.combination_name')}>
                <Input
                  value={newCombination.name}
                  onChange={(e) => setNewCombination({ ...newCombination, name: e.target.value })}
                  placeholder={t('settings.deepclaude.combination_name_placeholder')}
                />
              </Form.Item>

              <Form.Item label={t('settings.deepclaude.select_reasoner')}>
                <ModelSelectButton
                  model={getModelById(newCombination.reasonerModel)}
                  onClick={selectReasonerModel}
                  placeholder={t('settings.deepclaude.select_reasoner_placeholder')}
                  recommended={recommendedReasonerModels.some((m) => m.id === newCombination.reasonerModel) ? '★' : ''}
                />
              </Form.Item>
              <ModelTip>{t('settings.deepclaude.reasoner_tip')}</ModelTip>

              <Form.Item label={t('settings.deepclaude.select_target')}>
                <ModelSelectButton
                  model={getModelById(newCombination.targetModel)}
                  onClick={selectTargetModel}
                  placeholder={t('settings.deepclaude.select_target_placeholder')}
                  recommended={recommendedTargetModels.some((m) => m.id === newCombination.targetModel) ? '★' : ''}
                />
              </Form.Item>
              <ModelTip>{t('settings.deepclaude.target_tip')}</ModelTip>

              <Form.Item>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={addCombination}
                  disabled={!newCombination.name || !newCombination.reasonerModel || !newCombination.targetModel}>
                  {t('settings.deepclaude.add')}
                </Button>
              </Form.Item>
            </Form>
          </>
        )}
      </SettingGroup>
    </SettingContainer>
  )
}

const CombinationItem = styled.div`
  padding: 15px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 10px;
`

const ModelInfo = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`

const ModelLabel = styled.span`
  font-size: 12px;
  color: var(--color-text-secondary);
`

const ModelValue = styled.span`
  font-size: 14px;
  color: var(--color-text);
`

const ModelTip = styled.div`
  margin-top: -15px;
  margin-bottom: 15px;
  color: var(--color-text-secondary);
`

interface ModelSelectButtonProps {
  model?: Model
  onClick: () => void
  placeholder: string
  recommended?: string
}

const ModelSelectButton: FC<ModelSelectButtonProps> = ({ model, onClick, placeholder, recommended }) => {
  return (
    <ModelSelectButtonWrapper onClick={onClick}>
      {model ? (
        <>
          <ModelAvatar model={model} size={20} />
          <ModelName>
            {model.name} ({model.provider}) {recommended}
          </ModelName>
        </>
      ) : (
        <ModelName>{placeholder}</ModelName>
      )}
    </ModelSelectButtonWrapper>
  )
}

const ModelSelectButtonWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    border-color: var(--color-primary);
  }
`

const ModelName = styled.span`
  font-size: 14px;
  color: var(--color-text);
`

export default DeepClaudeSettings
