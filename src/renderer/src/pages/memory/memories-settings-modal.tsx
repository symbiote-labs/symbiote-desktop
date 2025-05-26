import { isEmbeddingModel, isRerankModel } from '@renderer/config/models'
import { useProviders } from '@renderer/hooks/useProvider'
import { getModelUniqId } from '@renderer/services/ModelService'
import { Form, Modal, Select } from 'antd'
import { t } from 'i18next'
import { sortBy } from 'lodash'
import { FC } from 'react'

interface MemoriesSettingsModalProps {
  visible: boolean
  onSubmit: (values: any) => void
  onCancel: () => void
  form: any
}

const MemoriesSettingsModal: FC<MemoriesSettingsModalProps> = ({ visible, onSubmit, onCancel, form }) => {
  const { providers } = useProviders()

  const llmSelectOptions = providers
    .filter((p) => p.models.length > 0)
    .map((p) => ({
      label: p.isSystem ? t(`provider.${p.id}`) : p.name,
      title: p.name,
      options: sortBy(p.models, 'name')
        .filter((model) => !isEmbeddingModel(model) && p.type === 'openai')
        .map((m) => ({
          label: m.name,
          value: getModelUniqId(m)
        }))
    }))
    .filter((group) => group.options.length > 0)

  const embeddingSelectOptions = providers
    .filter((p) => p.models.length > 0)
    .map((p) => ({
      label: p.isSystem ? t(`provider.${p.id}`) : p.name,
      title: p.name,
      options: sortBy(p.models, 'name')
        .filter((model) => isEmbeddingModel(model) && !isRerankModel(model))
        .map((m) => ({
          label: m.name,
          value: getModelUniqId(m)
        }))
    }))
    .filter((group) => group.options.length > 0)

  return (
    <Modal title="Memory Settings" open={visible} onOk={form.submit} onCancel={onCancel} width={500}>
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          label="LLM Model"
          name="llmModel"
          rules={[{ required: true, message: 'Please select an LLM model' }]}>
          <Select placeholder="Select LLM Model" options={llmSelectOptions} />
        </Form.Item>
        <Form.Item
          label="Embedding Model"
          name="embeddingModel"
          rules={[{ required: true, message: 'Please select an embedding model' }]}>
          <Select placeholder="Select Embedding Model" options={embeddingSelectOptions} />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default MemoriesSettingsModal
