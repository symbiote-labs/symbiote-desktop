import { useTheme } from '@renderer/context/ThemeProvider'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { setDeepSearchConfig } from '@renderer/store/websearch'
import { Checkbox, Space } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

const SubDescription = styled.div`
  font-size: 12px;
  color: #888;
  margin-top: 4px;
`

const DeepSearchSettings: FC = () => {
  const { t } = useTranslation()
  const { theme: themeMode } = useTheme()
  const dispatch = useAppDispatch()

  // 从 store 获取 DeepSearch 配置
  const deepSearchConfig = useAppSelector((state) => state.websearch.deepSearchConfig)

  // 本地状态 - 使用 deepSearchConfig?.enabledEngines 作为初始值，如果不存在则使用默认值
  const [enabledEngines, setEnabledEngines] = useState(() => deepSearchConfig?.enabledEngines || {
    // 中文搜索引擎
    baidu: true,
    sogou: true,
    '360': false,
    yisou: false,

    // 国际搜索引擎
    bing: true,
    duckduckgo: true,
    brave: false,
    qwant: false,

    // 元搜索引擎
    searx: true,
    ecosia: false,
    startpage: false,
    mojeek: false,

    // 学术搜索引擎
    scholar: true,
    semantic: false,
    base: false,
    cnki: false
  })

  // 当 deepSearchConfig.enabledEngines 的引用发生变化时更新本地状态
  useEffect(() => {
    if (deepSearchConfig?.enabledEngines) {
      // 比较当前状态和新状态，只有当它们不同时才更新
      const currentKeys = Object.keys(enabledEngines);
      const newKeys = Object.keys(deepSearchConfig.enabledEngines);

      // 检查键是否相同
      if (currentKeys.length !== newKeys.length ||
          !currentKeys.every(key => newKeys.includes(key))) {
        setEnabledEngines(deepSearchConfig.enabledEngines);
        return;
      }

      // 检查值是否相同
      let needsUpdate = false;
      for (const key of currentKeys) {
        if (enabledEngines[key] !== deepSearchConfig.enabledEngines[key]) {
          needsUpdate = true;
          break;
        }
      }

      if (needsUpdate) {
        setEnabledEngines(deepSearchConfig.enabledEngines);
      }
    }
  }, [deepSearchConfig?.enabledEngines])

  // 处理搜索引擎选择变化
  const handleEngineChange = (engine: string, checked: boolean) => {
    const newEnabledEngines = {
      ...enabledEngines,
      [engine]: checked
    }

    setEnabledEngines(newEnabledEngines)

    // 更新 store
    dispatch(
      setDeepSearchConfig({
        enabledEngines: newEnabledEngines
      })
    )
  }

  return (
    <SettingGroup theme={themeMode}>
      <SettingTitle>{t('settings.websearch.deepsearch.title', 'DeepSearch 设置')}</SettingTitle>
      <SettingDivider />

      <SettingRow>
        <SettingRowTitle>
          {t('settings.websearch.deepsearch.description', '选择要在 DeepSearch 中使用的搜索引擎')}
          <SubDescription>
            {t('settings.websearch.deepsearch.subdescription', '选择的搜索引擎将在 DeepSearch 中并行使用，不会影响 DeepResearch')}
          </SubDescription>
        </SettingRowTitle>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>中文搜索引擎</div>
            <Checkbox
              checked={enabledEngines.baidu}
              onChange={(e) => handleEngineChange('baidu', e.target.checked)}
            >
              百度 (Baidu)
            </Checkbox>
            <Checkbox
              checked={enabledEngines.sogou}
              onChange={(e) => handleEngineChange('sogou', e.target.checked)}
            >
              搜狗 (Sogou)
            </Checkbox>
            <Checkbox
              checked={enabledEngines['360']}
              onChange={(e) => handleEngineChange('360', e.target.checked)}
            >
              360搜索
            </Checkbox>
            <Checkbox
              checked={enabledEngines.yisou}
              onChange={(e) => handleEngineChange('yisou', e.target.checked)}
            >
              一搜 (Yisou)
            </Checkbox>
          </Space>

          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>国际搜索引擎</div>
            <Checkbox
              checked={enabledEngines.bing}
              onChange={(e) => handleEngineChange('bing', e.target.checked)}
            >
              必应 (Bing)
            </Checkbox>
            <Checkbox
              checked={enabledEngines.duckduckgo}
              onChange={(e) => handleEngineChange('duckduckgo', e.target.checked)}
            >
              DuckDuckGo
            </Checkbox>
            <Checkbox
              checked={enabledEngines.brave}
              onChange={(e) => handleEngineChange('brave', e.target.checked)}
            >
              Brave Search
            </Checkbox>
            <Checkbox
              checked={enabledEngines.qwant}
              onChange={(e) => handleEngineChange('qwant', e.target.checked)}
            >
              Qwant
            </Checkbox>
          </Space>

          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>元搜索引擎</div>
            <Checkbox
              checked={enabledEngines.searx}
              onChange={(e) => handleEngineChange('searx', e.target.checked)}
            >
              SearX
            </Checkbox>
            <Checkbox
              checked={enabledEngines.ecosia}
              onChange={(e) => handleEngineChange('ecosia', e.target.checked)}
            >
              Ecosia
            </Checkbox>
            <Checkbox
              checked={enabledEngines.startpage}
              onChange={(e) => handleEngineChange('startpage', e.target.checked)}
            >
              Startpage
            </Checkbox>
            <Checkbox
              checked={enabledEngines.mojeek}
              onChange={(e) => handleEngineChange('mojeek', e.target.checked)}
            >
              Mojeek
            </Checkbox>
          </Space>

          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>学术搜索引擎</div>
            <Checkbox
              checked={enabledEngines.scholar}
              onChange={(e) => handleEngineChange('scholar', e.target.checked)}
            >
              Google Scholar
            </Checkbox>
            <Checkbox
              checked={enabledEngines.semantic}
              onChange={(e) => handleEngineChange('semantic', e.target.checked)}
            >
              Semantic Scholar
            </Checkbox>
            <Checkbox
              checked={enabledEngines.base}
              onChange={(e) => handleEngineChange('base', e.target.checked)}
            >
              BASE
            </Checkbox>
            <Checkbox
              checked={enabledEngines.cnki}
              onChange={(e) => handleEngineChange('cnki', e.target.checked)}
            >
              CNKI 知网
            </Checkbox>
          </Space>
        </div>
      </SettingRow>
    </SettingGroup>
  )
}

export default DeepSearchSettings
