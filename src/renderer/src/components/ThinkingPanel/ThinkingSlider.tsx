import { InfoCircleOutlined } from '@ant-design/icons'
import { Model } from '@renderer/types'
import { Button, InputNumber, Slider, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { isSupportedThinkingTokenGeminiModel } from '../../config/models'

interface ThinkingSliderProps {
  model: Model
  value: number | null
  min: number
  max: number
  onChange: (value: number | null) => void
}

export default function ThinkingSlider({ model, value, min, max, onChange }: ThinkingSliderProps) {
  const [mode, setMode] = useState<'default' | 'custom'>(value === null ? 'default' : 'custom')
  const [customValue, setCustomValue] = useState<number>(value === null ? 0 : value)
  const { t } = useTranslation()
  useEffect(() => {
    if (value === null) {
      setMode('default')
    } else {
      setMode('custom')
      setCustomValue(value)
    }
  }, [value])

  const handleModeChange = (newMode: 'default' | 'custom') => {
    setMode(newMode)
    if (newMode === 'default') {
      onChange(null)
    } else {
      onChange(customValue)
    }
  }

  const handleCustomValueChange = (newValue: number | null) => {
    if (newValue !== null) {
      setCustomValue(newValue)
      onChange(newValue)
    }
  }

  return (
    <Container>
      {isSupportedThinkingTokenGeminiModel(model) && (
        <ButtonGroup>
          <Tooltip title={t('chat.input.thinking.mode.default.tip')}>
            <ModeButton type={mode === 'default' ? 'primary' : 'text'} onClick={() => handleModeChange('default')}>
              {t('chat.input.thinking.mode.default')}
            </ModeButton>
          </Tooltip>
          <Tooltip title={t('chat.input.thinking.mode.custom.tip')}>
            <ModeButton type={mode === 'custom' ? 'primary' : 'text'} onClick={() => handleModeChange('custom')}>
              {t('chat.input.thinking.mode.custom')}
            </ModeButton>
          </Tooltip>
        </ButtonGroup>
      )}

      {mode === 'custom' && (
        <CustomControls>
          <SliderContainer>
            <Slider
              min={min}
              max={max}
              value={customValue}
              onChange={handleCustomValueChange}
              tooltip={{ formatter: null }}
            />
            <SliderMarks>
              <span>0</span>
              <span>{max.toLocaleString()}</span>
            </SliderMarks>
          </SliderContainer>

          <InputContainer>
            <StyledInputNumber
              min={min}
              max={max}
              value={customValue}
              onChange={(value) => handleCustomValueChange(Number(value))}
              controls={false}
            />
            <Tooltip title={t('chat.input.thinking.mode.tokens.tip')}>
              <InfoCircleOutlined style={{ color: 'var(--color-text-2)' }} />
            </Tooltip>
          </InputContainer>
        </CustomControls>
      )}
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  min-width: 320px;
  padding: 4px;
`

const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 4px;
`

const ModeButton = styled(Button)`
  min-width: 90px;
  height: 28px;
  border-radius: 14px;
  padding: 0 16px;
  font-size: 13px;

  &:hover {
    background-color: var(--color-background-soft);
  }

  &.ant-btn-primary {
    background-color: var(--color-primary);
    border-color: var(--color-primary);

    &:hover {
      background-color: var(--color-primary);
      opacity: 0.9;
    }
  }
`

const CustomControls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const SliderContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 180px;
`

const SliderMarks = styled.div`
  display: flex;
  justify-content: space-between;
  color: var(--color-text-2);
  font-size: 12px;
`

const InputContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const StyledInputNumber = styled(InputNumber)`
  width: 70px;

  .ant-input-number-input {
    height: 28px;
    text-align: center;
    font-size: 13px;
    padding: 0 8px;
  }
`
