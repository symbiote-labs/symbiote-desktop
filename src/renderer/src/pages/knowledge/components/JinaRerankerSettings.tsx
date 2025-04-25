import { InputNumber, Select, Space } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface Props {
  rerankModel: string
  onUpdateRerankModel: (model: string) => void
  topN: number
  onUpdateTopN: (topN: number) => void
}

const JinaRerankerSettings: FC<Props> = ({ rerankModel, onUpdateRerankModel, topN, onUpdateTopN }) => {
  const { t } = useTranslation()
  const [localTopN, setLocalTopN] = useState(topN)

  useEffect(() => {
    setLocalTopN(topN)
  }, [topN])

  const handleTopNChange = (value: number | null) => {
    if (value !== null) {
      setLocalTopN(value)
      onUpdateTopN(value)
    }
  }

  return (
    <SettingsContainer>
      <SettingItem>
        <SettingLabel>{t('knowledge.reranker.model')}</SettingLabel>
        <Select
          value={rerankModel}
          onChange={onUpdateRerankModel}
          style={{ width: 250 }}
          options={[
            { value: 'jina-reranker-v2', label: 'Jina Reranker V2 (通用)' },
            { value: 'jina-reranker-v2-code', label: 'Jina Reranker V2 Code (代码)' },
            { value: 'jina-reranker-v2-zh', label: 'Jina Reranker V2 中文' },
            { value: 'jina-reranker-v2-es', label: 'Jina Reranker V2 西班牙语' },
            { value: 'jina-reranker-v2-de', label: 'Jina Reranker V2 德语' },
            { value: 'jina-reranker-v2-fr', label: 'Jina Reranker V2 法语' },
            { value: 'jina-reranker-v2-ja', label: 'Jina Reranker V2 日语' },
            { value: 'jina-reranker-v2-ko', label: 'Jina Reranker V2 韩语' },
            { value: 'jina-reranker-v2-ru', label: 'Jina Reranker V2 俄语' },
            { value: 'jina-reranker-v2-pt', label: 'Jina Reranker V2 葡萄牙语' },
            { value: 'jina-reranker-v2-it', label: 'Jina Reranker V2 意大利语' },
            { value: 'jina-reranker-v2-nl', label: 'Jina Reranker V2 荷兰语' },
            { value: 'jina-reranker-v2-pl', label: 'Jina Reranker V2 波兰语' },
            { value: 'jina-reranker-v2-tr', label: 'Jina Reranker V2 土耳其语' },
            { value: 'jina-reranker-v2-ar', label: 'Jina Reranker V2 阿拉伯语' },
            { value: 'jina-reranker-v2-hi', label: 'Jina Reranker V2 印地语' },
            { value: 'jina-reranker-v2-th', label: 'Jina Reranker V2 泰语' },
            { value: 'jina-reranker-v2-vi', label: 'Jina Reranker V2 越南语' },
            { value: 'jina-reranker-v2-id', label: 'Jina Reranker V2 印尼语' },
            { value: 'jina-reranker-v2-table', label: 'Jina Reranker V2 表格数据' }
          ]}
        />
      </SettingItem>

      <SettingItem>
        <SettingLabel>{t('knowledge.reranker.top_n')}</SettingLabel>
        <InputNumber min={1} max={100} value={localTopN} onChange={handleTopNChange} style={{ width: 100 }} />
      </SettingItem>

      <Space direction="vertical" style={{ marginTop: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{t('knowledge.reranker.description')}</div>
      </Space>
    </SettingsContainer>
  )
}

const SettingsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
`

const SettingItem = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`

const SettingLabel = styled.div`
  width: 120px;
  font-weight: 500;
`

export default JinaRerankerSettings
