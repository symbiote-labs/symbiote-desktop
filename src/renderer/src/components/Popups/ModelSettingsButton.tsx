import { SettingOutlined } from '@ant-design/icons'
import { useProvider } from '@renderer/hooks/useProvider'
import { Model } from '@renderer/types'
import { Button, Tooltip } from 'antd'
import { FC, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import ModelEditPopup from './ModelEditPopup'

interface ModelSettingsButtonProps {
  model: Model
  size?: number
  className?: string
}

const ModelSettingsButton: FC<ModelSettingsButtonProps> = ({ model, size = 16, className }) => {
  const { t } = useTranslation()
  const { updateModel } = useProvider(model.provider)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()

      if (isProcessing) return

      try {
        setIsProcessing(true)

        ModelEditPopup.hide()

        await new Promise((resolve) => setTimeout(resolve, 50))

        const updatedModel = await ModelEditPopup.show(model)

        if (updatedModel) {
          updateModel(updatedModel)
          console.log('模型更新成功:', updatedModel.name)
        }
      } catch (error) {
        console.error('模型设置更新失败:', error)
      } finally {
        setIsProcessing(false)
      }
    },
    [model, updateModel, isProcessing]
  )

  return (
    <Tooltip title={t('models.edit')} placement="top">
      <StyledButton
        type="text"
        icon={<SettingOutlined style={{ fontSize: size }} />}
        onClick={handleClick}
        className={className}
        onMouseDown={(e) => {
          e.stopPropagation()
          e.preventDefault()
        }}
        disabled={isProcessing}
      />
    </Tooltip>
  )
}

const StyledButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  margin: 0;
  height: auto;
  width: auto;
  min-width: auto;
  background: transparent;
  border: none;
  opacity: 0.5;
  transition: opacity 0.2s;
  z-index: 100;
  position: relative;

  &:hover {
    opacity: 1;
    background: transparent;
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`

export default ModelSettingsButton
