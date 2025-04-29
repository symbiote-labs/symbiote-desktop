import { InfoCircleOutlined } from '@ant-design/icons'
import { Model } from '@renderer/types'
import { Col, InputNumber, Radio, Row, Slider, Space, Tooltip } from 'antd'
import { useEffect, useState } from 'react'

import { isSupportedThinkingTokenGeminiModel } from '../../config/models'

interface ThinkingSliderProps {
  model: Model
  value: number | null
  min: number
  max: number
  onChange: (value: number | null) => void
}

export default function ThinkingSlider({ model, value, min, max, onChange }: ThinkingSliderProps) {
  // 使用null表示"Default"模式，使用数字表示"Custom"模式
  const [mode, setMode] = useState<'default' | 'custom'>(value === null ? 'default' : 'custom')
  const [customValue, setCustomValue] = useState<number>(value === null ? 0 : value)

  // 当外部value变化时更新内部状态
  useEffect(() => {
    if (value === null) {
      setMode('default')
    } else {
      setMode('custom')
      setCustomValue(value)
    }
  }, [value])

  // 处理模式切换
  const handleModeChange = (e: any) => {
    const newMode = e.target.value
    setMode(newMode)
    if (newMode === 'default') {
      onChange(null) // 传递null表示使用默认行为
    } else {
      onChange(customValue) // 传递当前自定义值
    }
  }

  // 处理自定义值变化
  const handleCustomValueChange = (newValue: number | null) => {
    if (newValue !== null) {
      setCustomValue(newValue)
      onChange(newValue)
    }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {isSupportedThinkingTokenGeminiModel(model) && (
        <Radio.Group value={mode} onChange={handleModeChange}>
          <Radio.Button value="default">Default (Model's default behavior)</Radio.Button>
          <Radio.Button value="custom">Custom</Radio.Button>
        </Radio.Group>
      )}

      {mode === 'custom' && (
        <Row align="middle">
          <Col span={12}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Slider
                min={min}
                max={max}
                onChange={handleCustomValueChange}
                value={customValue}
                marks={{
                  0: { label: '0' },
                  [max]: { label: `${max.toLocaleString()}` }
                }}
              />
              <Tooltip title="Set the number of thinking tokens to use. Set to 0 to explicitly use no thinking tokens.">
                <InfoCircleOutlined style={{ marginLeft: 8, color: 'var(--color-text-secondary)' }} />
              </Tooltip>
            </div>
          </Col>
          <Col span={4}>
            <InputNumber
              min={min}
              max={max}
              style={{ margin: '0 16px' }}
              value={customValue}
              onChange={handleCustomValueChange}
              addonAfter="tokens"
            />
          </Col>
        </Row>
      )}
    </Space>
  )
}
