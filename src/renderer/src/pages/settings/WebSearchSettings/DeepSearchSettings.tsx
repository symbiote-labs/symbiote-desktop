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
  const [enabledEngines, setEnabledEngines] = useState(
    () =>
      deepSearchConfig?.enabledEngines || {
        // 中文搜索引擎
        baidu: true,
        sogou: true,
        '360': false,
        yisou: false,
        toutiao: false,
        zhihu: false,

        // 国际搜索引擎
        bing: true,
        google: true,
        duckduckgo: true,
        brave: false,
        qwant: false,
        yahoo: false,

        // 元搜索引擎
        searx: true,
        ecosia: false,
        startpage: false,
        mojeek: false,
        yandex: false,
        presearch: false,

        // 学术搜索引擎
        scholar: true,
        semantic: false,
        base: false,
        cnki: false,
        pubmed: false,
        sciencedirect: false,
        researchgate: false,
        jstor: false,

        // 技术搜索引擎
        github: true,
        stackoverflow: true,
        devdocs: false,
        mdn: false,
        npm: false,
        pypi: false,

        // 新闻搜索引擎
        googlenews: false,
        reuters: false,
        bbc: false,
        xinhua: false,
        cctv: false,

        // 专业领域搜索引擎
        arxiv: false,
        uspto: false,
        wolframalpha: false,
        coursera: false,
        khan: false
      }
  )

  // 当 deepSearchConfig.enabledEngines 的引用发生变化时更新本地状态
  useEffect(() => {
    if (deepSearchConfig?.enabledEngines) {
      // 比较当前状态和新状态，只有当它们不同时才更新
      const currentKeys = Object.keys(enabledEngines)
      const newKeys = Object.keys(deepSearchConfig.enabledEngines)

      // 检查键是否相同
      if (currentKeys.length !== newKeys.length || !currentKeys.every((key) => newKeys.includes(key))) {
        setEnabledEngines(deepSearchConfig.enabledEngines)
        return
      }

      // 检查值是否相同
      let needsUpdate = false
      for (const key of currentKeys) {
        if (enabledEngines[key] !== deepSearchConfig.enabledEngines[key]) {
          needsUpdate = true
          break
        }
      }

      if (needsUpdate) {
        setEnabledEngines(deepSearchConfig.enabledEngines)
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
            {t(
              'settings.websearch.deepsearch.subdescription',
              '选择的搜索引擎将在 DeepSearch 中并行使用，不会影响 DeepResearch'
            )}
          </SubDescription>
        </SettingRowTitle>
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '20px' }}>
          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>中文搜索引擎</div>
            <Checkbox checked={enabledEngines.baidu} onChange={(e) => handleEngineChange('baidu', e.target.checked)}>
              百度 (Baidu)
            </Checkbox>
            <Checkbox checked={enabledEngines.sogou} onChange={(e) => handleEngineChange('sogou', e.target.checked)}>
              搜狗 (Sogou)
            </Checkbox>
            <Checkbox checked={enabledEngines['360']} onChange={(e) => handleEngineChange('360', e.target.checked)}>
              360搜索
            </Checkbox>
            <Checkbox checked={enabledEngines.yisou} onChange={(e) => handleEngineChange('yisou', e.target.checked)}>
              一搜 (Yisou)
            </Checkbox>
            <Checkbox
              checked={enabledEngines.toutiao}
              onChange={(e) => handleEngineChange('toutiao', e.target.checked)}>
              头条搜索 (Toutiao)
            </Checkbox>
            <Checkbox checked={enabledEngines.zhihu} onChange={(e) => handleEngineChange('zhihu', e.target.checked)}>
              知乎 (Zhihu)
            </Checkbox>
          </Space>

          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>国际搜索引擎</div>
            <Checkbox checked={enabledEngines.bing} onChange={(e) => handleEngineChange('bing', e.target.checked)}>
              必应 (Bing)
            </Checkbox>
            <Checkbox checked={enabledEngines.google} onChange={(e) => handleEngineChange('google', e.target.checked)}>
              谷歌 (Google)
            </Checkbox>
            <Checkbox
              checked={enabledEngines.duckduckgo}
              onChange={(e) => handleEngineChange('duckduckgo', e.target.checked)}>
              DuckDuckGo
            </Checkbox>
            <Checkbox checked={enabledEngines.brave} onChange={(e) => handleEngineChange('brave', e.target.checked)}>
              Brave Search
            </Checkbox>
            <Checkbox checked={enabledEngines.qwant} onChange={(e) => handleEngineChange('qwant', e.target.checked)}>
              Qwant
            </Checkbox>
            <Checkbox checked={enabledEngines.yahoo} onChange={(e) => handleEngineChange('yahoo', e.target.checked)}>
              雅虎 (Yahoo)
            </Checkbox>
          </Space>

          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>元搜索引擎</div>
            <Checkbox checked={enabledEngines.searx} onChange={(e) => handleEngineChange('searx', e.target.checked)}>
              SearX
            </Checkbox>
            <Checkbox checked={enabledEngines.ecosia} onChange={(e) => handleEngineChange('ecosia', e.target.checked)}>
              Ecosia
            </Checkbox>
            <Checkbox
              checked={enabledEngines.startpage}
              onChange={(e) => handleEngineChange('startpage', e.target.checked)}>
              Startpage
            </Checkbox>
            <Checkbox checked={enabledEngines.mojeek} onChange={(e) => handleEngineChange('mojeek', e.target.checked)}>
              Mojeek
            </Checkbox>
            <Checkbox checked={enabledEngines.yandex} onChange={(e) => handleEngineChange('yandex', e.target.checked)}>
              Yandex
            </Checkbox>
            <Checkbox
              checked={enabledEngines.presearch}
              onChange={(e) => handleEngineChange('presearch', e.target.checked)}>
              Presearch
            </Checkbox>
          </Space>

          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>学术搜索引擎</div>
            <Checkbox
              checked={enabledEngines.scholar}
              onChange={(e) => handleEngineChange('scholar', e.target.checked)}>
              Google Scholar
            </Checkbox>
            <Checkbox
              checked={enabledEngines.semantic}
              onChange={(e) => handleEngineChange('semantic', e.target.checked)}>
              Semantic Scholar
            </Checkbox>
            <Checkbox checked={enabledEngines.base} onChange={(e) => handleEngineChange('base', e.target.checked)}>
              BASE
            </Checkbox>

            <Checkbox checked={enabledEngines.pubmed} onChange={(e) => handleEngineChange('pubmed', e.target.checked)}>
              PubMed
            </Checkbox>
            <Checkbox
              checked={enabledEngines.sciencedirect}
              onChange={(e) => handleEngineChange('sciencedirect', e.target.checked)}>
              ScienceDirect
            </Checkbox>
            <Checkbox
              checked={enabledEngines.researchgate}
              onChange={(e) => handleEngineChange('researchgate', e.target.checked)}>
              ResearchGate
            </Checkbox>
            <Checkbox checked={enabledEngines.jstor} onChange={(e) => handleEngineChange('jstor', e.target.checked)}>
              JSTOR
            </Checkbox>
          </Space>

          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>技术搜索引擎</div>
            <Checkbox checked={enabledEngines.github} onChange={(e) => handleEngineChange('github', e.target.checked)}>
              GitHub
            </Checkbox>
            <Checkbox
              checked={enabledEngines.stackoverflow}
              onChange={(e) => handleEngineChange('stackoverflow', e.target.checked)}>
              Stack Overflow
            </Checkbox>
            <Checkbox
              checked={enabledEngines.devdocs}
              onChange={(e) => handleEngineChange('devdocs', e.target.checked)}>
              DevDocs
            </Checkbox>
            <Checkbox checked={enabledEngines.mdn} onChange={(e) => handleEngineChange('mdn', e.target.checked)}>
              MDN Web Docs
            </Checkbox>
            <Checkbox checked={enabledEngines.npm} onChange={(e) => handleEngineChange('npm', e.target.checked)}>
              NPM
            </Checkbox>
            <Checkbox checked={enabledEngines.pypi} onChange={(e) => handleEngineChange('pypi', e.target.checked)}>
              PyPI
            </Checkbox>
          </Space>

          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>新闻搜索引擎</div>
            <Checkbox
              checked={enabledEngines.googlenews}
              onChange={(e) => handleEngineChange('googlenews', e.target.checked)}>
              Google News
            </Checkbox>
            <Checkbox
              checked={enabledEngines.reuters}
              onChange={(e) => handleEngineChange('reuters', e.target.checked)}>
              Reuters
            </Checkbox>
            <Checkbox checked={enabledEngines.bbc} onChange={(e) => handleEngineChange('bbc', e.target.checked)}>
              BBC
            </Checkbox>
            <Checkbox checked={enabledEngines.xinhua} onChange={(e) => handleEngineChange('xinhua', e.target.checked)}>
              新华网 (Xinhua)
            </Checkbox>
            <Checkbox checked={enabledEngines.cctv} onChange={(e) => handleEngineChange('cctv', e.target.checked)}>
              央视网 (CCTV)
            </Checkbox>
          </Space>

          <Space direction="vertical">
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>专业领域搜索引擎</div>
            <Checkbox checked={enabledEngines.arxiv} onChange={(e) => handleEngineChange('arxiv', e.target.checked)}>
              arXiv
            </Checkbox>
            <Checkbox checked={enabledEngines.uspto} onChange={(e) => handleEngineChange('uspto', e.target.checked)}>
              USPTO 专利
            </Checkbox>
            <Checkbox
              checked={enabledEngines.wolframalpha}
              onChange={(e) => handleEngineChange('wolframalpha', e.target.checked)}>
              Wolfram Alpha
            </Checkbox>
            <Checkbox
              checked={enabledEngines.coursera}
              onChange={(e) => handleEngineChange('coursera', e.target.checked)}>
              Coursera
            </Checkbox>
            <Checkbox checked={enabledEngines.khan} onChange={(e) => handleEngineChange('khan', e.target.checked)}>
              Khan Academy
            </Checkbox>
          </Space>
        </div>
      </SettingRow>
    </SettingGroup>
  )
}

export default DeepSearchSettings
