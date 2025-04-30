import { DownOutlined, UpOutlined } from '@ant-design/icons'
import CopyIcon from '@renderer/components/Icons/CopyIcon'
import { TopView } from '@renderer/components/TopView'
import {
  isEmbeddingModel,
  isFunctionCallingModel,
  isReasoningModel,
  isVisionModel,
  isWebSearchModel
} from '@renderer/config/models'
import { useProvider } from '@renderer/hooks/useProvider'
import { Model, ModelType } from '@renderer/types'
import { getDefaultGroupName } from '@renderer/utils'
import { Button, Card, Checkbox, Flex, Form, Input, message, Modal, Space, Tooltip } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface ModelEditPopupProps {
  model: Model
  resolve: (updatedModel?: Model) => void
}

const PopupContainer: FC<ModelEditPopupProps> = ({ model, resolve }) => {
  const [open, setOpen] = useState(true)
  const [form] = Form.useForm()
  const { t } = useTranslation()
  const [showModelTypes, setShowModelTypes] = useState(false)
  const { updateModel } = useProvider(model.provider)
  const [currentModel, setCurrentModel] = useState<Model>({ ...model })

  useEffect(() => {
    form.setFieldsValue({
      id: currentModel.id,
      name: currentModel.name,
      group: currentModel.group
    })
  }, [currentModel, form])

  const onFinish = (values: any) => {
    const updatedModel = {
      ...currentModel,
      id: values.id || currentModel.id,
      name: values.name || currentModel.name,
      group: values.group || currentModel.group
    }

    updateModel(updatedModel)

    setShowModelTypes(false)
    setOpen(false)
    resolve(updatedModel)
  }

  const handleClose = () => {
    setShowModelTypes(false)
    setOpen(false)
    resolve()
  }

  const onUpdateModel = (updatedModel: Model) => {
    setCurrentModel(updatedModel)
    updateModel(updatedModel)
  }

  return (
    <Modal
      title={t('models.edit')}
      open={open}
      onCancel={handleClose}
      footer={null}
      maskClosable={false}
      centered
      width={550}
      styles={{
        content: {
          padding: '24px',
          borderRadius: '12px'
        }
      }}
      afterOpenChange={(visible) => {
        if (visible) {
          form.getFieldInstance('id')?.focus()
        } else {
          setShowModelTypes(false)
        }
      }}>
      <Form
        form={form}
        layout="vertical"
        colon={false}
        style={{ marginTop: 15 }}
        size="middle"
        initialValues={{
          id: currentModel.id,
          name: currentModel.name,
          group: currentModel.group
        }}
        onFinish={onFinish}>
        <SectionTitle>基本信息</SectionTitle>

        <Form.Item
          name="id"
          label={t('settings.models.add.model_id')}
          tooltip={t('settings.models.add.model_id.tooltip')}
          rules={[{ required: true }]}>
          <Flex justify="space-between" gap={5}>
            <Input
              placeholder={t('settings.models.add.model_id.placeholder')}
              spellCheck={false}
              maxLength={200}
              disabled={true}
              value={currentModel.id}
              onChange={(e) => {
                const value = e.target.value
                form.setFieldValue('name', value)
                form.setFieldValue('group', getDefaultGroupName(value))
              }}
            />
            <Tooltip title={t('common.copy')}>
              <Button
                type="text"
                icon={<CopyIcon />}
                onClick={() => {
                  navigator.clipboard.writeText(currentModel.id)
                  message.success(t('message.copy.success'))
                }}
              />
            </Tooltip>
          </Flex>
        </Form.Item>
        <Form.Item
          name="name"
          label={t('settings.models.add.model_name')}
          tooltip={t('settings.models.add.model_name.tooltip')}
          rules={[{ required: true }]}>
          <Input placeholder={t('settings.models.add.model_name.placeholder')} spellCheck={false} maxLength={200} />
        </Form.Item>
        <Form.Item
          name="group"
          label={t('settings.models.add.model_group')}
          tooltip={t('settings.models.add.model_group.tooltip')}>
          <Input placeholder={t('settings.models.add.model_group.placeholder')} spellCheck={false} maxLength={200} />
        </Form.Item>

        <MoreSettingsToggle onClick={() => setShowModelTypes(!showModelTypes)}>
          {t('settings.moresetting')}
          <ExpandIcon>{showModelTypes ? <UpOutlined /> : <DownOutlined />}</ExpandIcon>
        </MoreSettingsToggle>

        {showModelTypes && (
          <Card
            bordered={false}
            style={{
              marginTop: 16,
              background: 'var(--color-background-soft)',
              borderRadius: '8px'
            }}>
            <TypeTitle>选择模型类型:</TypeTitle>
            {(() => {
              const modelTypes = currentModel.type || []

              const defaultTypes = [
                ...(isVisionModel(currentModel) ? ['vision'] : []),
                ...(isEmbeddingModel(currentModel) ? ['embedding'] : []),
                ...(isReasoningModel(currentModel) ? ['reasoning'] : []),
                ...(isFunctionCallingModel(currentModel) ? ['function_calling'] : []),
                ...(isWebSearchModel(currentModel) ? ['web_search'] : [])
              ] as ModelType[]

              const selectedTypes = [...new Set([...modelTypes, ...defaultTypes])]

              const showTypeConfirmModal = (type: string) => {
                window.modal.confirm({
                  title: t('settings.moresetting.warn'),
                  content: t('settings.moresetting.check.warn'),
                  okText: t('settings.moresetting.check.confirm'),
                  cancelText: t('common.cancel'),
                  okButtonProps: { danger: true },
                  cancelButtonProps: { type: 'primary' },
                  onOk: () => {
                    const updatedModel = {
                      ...currentModel,
                      type: [...selectedTypes, type] as ModelType[]
                    }
                    onUpdateModel(updatedModel)
                  },
                  onCancel: () => {},
                  centered: true
                })
              }

              const handleTypeChange = (types: string[]) => {
                const newType = types.find((type) => !selectedTypes.includes(type as ModelType))

                if (newType) {
                  showTypeConfirmModal(newType)
                } else {
                  const updatedModel = { ...currentModel, type: types as ModelType[] }
                  onUpdateModel(updatedModel)
                }
              }

              return (
                <Checkbox.Group
                  value={selectedTypes}
                  onChange={handleTypeChange}
                  style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                  <StyledCheckbox value="vision">{t('models.type.vision')}</StyledCheckbox>
                  <StyledCheckbox value="web_search">{t('models.type.websearch')}</StyledCheckbox>
                  <StyledCheckbox value="reasoning">{t('models.type.reasoning')}</StyledCheckbox>
                  <StyledCheckbox value="function_calling">{t('models.type.function_calling')}</StyledCheckbox>
                  <StyledCheckbox value="embedding">{t('models.type.embedding')}</StyledCheckbox>
                  <StyledCheckbox value="rerank">{t('models.type.rerank')}</StyledCheckbox>
                </Checkbox.Group>
              )
            })()}
          </Card>
        )}

        <Form.Item style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            <Button onClick={handleClose}>{t('common.cancel')}</Button>
            <Button type="primary" htmlType="submit">
              {t('common.save')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  )
}

const SectionTitle = styled.h3`
  font-size: 15px;
  font-weight: 500;
  margin: 0 0 16px 0;
  color: var(--color-text-primary);
`

const MoreSettingsToggle = styled.div`
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: var(--color-background-soft);
  color: var(--color-text-secondary);
  font-size: 14px;
  transition: all 0.2s;

  &:hover {
    color: var(--color-text-primary);
    background-color: var(--color-background-mute);
  }
`

const ExpandIcon = styled.span`
  display: inline-flex;
  align-items: center;
`

const TypeTitle = styled.h4`
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 16px 0;
  color: var(--color-text-primary);
`

const StyledCheckbox = styled(Checkbox)`
  &.ant-checkbox-wrapper {
    margin-right: 0;
    margin-left: 8px;
  }
`

export default class ModelEditPopup {
  // 标记是否正在显示弹窗
  private static isVisible = false

  static hide() {
    // 清理TopView状态
    TopView.hide('ModelEditPopup')
    this.isVisible = false
  }

  static show(model: Model) {
    // 如果已经在显示，先关闭
    if (this.isVisible) {
      TopView.hide('ModelEditPopup')

      // 确保DOM已完全更新后再显示新弹窗
      return new Promise<Model | undefined>((resolve) => {
        setTimeout(() => {
          this.isVisible = true
          TopView.show(
            <PopupContainer
              model={model}
              resolve={(value) => {
                this.isVisible = false
                resolve(value)
              }}
            />,
            'ModelEditPopup'
          )
        }, 50)
      })
    }

    // 正常显示弹窗
    this.isVisible = true
    return new Promise<Model | undefined>((resolve) => {
      TopView.show(
        <PopupContainer
          model={model}
          resolve={(value) => {
            this.isVisible = false
            resolve(value)
          }}
        />,
        'ModelEditPopup'
      )
    })
  }
}
