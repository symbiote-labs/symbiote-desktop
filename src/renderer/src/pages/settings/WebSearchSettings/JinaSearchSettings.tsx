import './JinaSearchSettings.css'

import { useWebSearchProvider } from '@renderer/hooks/useWebSearchProviders'
import { Checkbox, Input, InputNumber, Select, Space } from 'antd'
import { FC, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SettingDivider, SettingRow, SettingRowTitle, SettingSubtitle } from '..'

interface Props {
  providerId: string
}

const JinaSearchSettings: FC<Props> = ({ providerId }) => {
  const { provider, updateProvider } = useWebSearchProvider(providerId)
  const { t } = useTranslation()

  // 初始化Jina搜索配置
  const [jinaConfig, setJinaConfig] = useState({
    apiEndpoint: provider.apiEndpoint || 'search',
    topK: provider.topK || 10,
    includeMetadata: provider.includeMetadata !== false, // 默认为true
    searchType: provider.searchType || 'hybrid',
    useReranker: provider.useReranker !== false, // 默认为true
    locale: provider.locale || 'zh-CN',
    country: provider.country || 'CN',
    timeout: provider.timeout || 30,
    noCache: provider.noCache || false,
    withFavicon: provider.withFavicon || false,
    withLinks: provider.withLinks || false,
    withImages: provider.withImages || false,
    returnFormat: provider.returnFormat || 'markdown',
    engine: provider.engine || 'browser',
    site: provider.site || '',
    // SERP特定参数
    jsonResponse: provider.jsonResponse !== false, // 默认为true
    fetchFavicons: provider.fetchFavicons || false,
    location: provider.location || '',
    page: provider.page || 0,
    num: provider.num || 0,
    // Reader特定参数
    removeSelectors: provider.removeSelectors || '',
    targetSelectors: provider.targetSelectors || '',
    waitForSelectors: provider.waitForSelectors || '',
    withGeneratedAlt: provider.withGeneratedAlt || false,
    withIframe: provider.withIframe || false,
    tokenBudget: provider.tokenBudget || 0,
    retainImages: provider.retainImages || 'all',
    respondWith: provider.respondWith || '',
    proxy: provider.proxy || '',
    // 新增 Reader API 参数
    dnt: provider.dnt || false,
    noGfm: provider.noGfm || false,
    robotsTxt: provider.robotsTxt || '',
    withShadowDom: provider.withShadowDom || false,
    base: provider.base || '',
    mdHeadingStyle: provider.mdHeadingStyle || '',
    mdHr: provider.mdHr || '',
    mdBulletListMarker: provider.mdBulletListMarker || '',
    mdEmDelimiter: provider.mdEmDelimiter || '',
    mdStrongDelimiter: provider.mdStrongDelimiter || '',
    mdLinkStyle: provider.mdLinkStyle || '',
    mdLinkReferenceStyle: provider.mdLinkReferenceStyle || '',
    setCookie: provider.setCookie || '',
    proxyUrl: provider.proxyUrl || '',
    viewport: provider.viewport || undefined,
    injectPageScript: provider.injectPageScript || ''
  })

  // 当provider变化时更新本地状态
  useEffect(() => {
    setJinaConfig({
      apiEndpoint: provider.apiEndpoint || 'search',
      topK: provider.topK || 10,
      includeMetadata: provider.includeMetadata !== false,
      searchType: provider.searchType || 'hybrid',
      useReranker: provider.useReranker !== false,
      locale: provider.locale || 'zh-CN',
      country: provider.country || 'CN',
      timeout: provider.timeout || 30,
      noCache: provider.noCache || false,
      withFavicon: provider.withFavicon || false,
      withLinks: provider.withLinks || false,
      withImages: provider.withImages || false,
      returnFormat: provider.returnFormat || 'markdown',
      engine: provider.engine || 'browser',
      site: provider.site || '',
      // SERP特定参数
      jsonResponse: provider.jsonResponse !== false, // 默认为true
      fetchFavicons: provider.fetchFavicons || false,
      location: provider.location || '',
      page: provider.page || 0,
      num: provider.num || 0,
      // Reader特定参数
      removeSelectors: provider.removeSelectors || '',
      targetSelectors: provider.targetSelectors || '',
      waitForSelectors: provider.waitForSelectors || '',
      withGeneratedAlt: provider.withGeneratedAlt || false,
      withIframe: provider.withIframe || false,
      tokenBudget: provider.tokenBudget || 0,
      retainImages: provider.retainImages || 'all',
      respondWith: provider.respondWith || '',
      proxy: provider.proxy || '',
      // 新增 Reader API 参数
      dnt: provider.dnt || false,
      noGfm: provider.noGfm || false,
      robotsTxt: provider.robotsTxt || '',
      withShadowDom: provider.withShadowDom || false,
      base: provider.base || '',
      mdHeadingStyle: provider.mdHeadingStyle || '',
      mdHr: provider.mdHr || '',
      mdBulletListMarker: provider.mdBulletListMarker || '',
      mdEmDelimiter: provider.mdEmDelimiter || '',
      mdStrongDelimiter: provider.mdStrongDelimiter || '',
      mdLinkStyle: provider.mdLinkStyle || '',
      mdLinkReferenceStyle: provider.mdLinkReferenceStyle || '',
      setCookie: provider.setCookie || '',
      proxyUrl: provider.proxyUrl || '',
      viewport: provider.viewport || undefined,
      injectPageScript: provider.injectPageScript || ''
    })
  }, [provider])

  // 更新配置
  const updateConfig = (config: any) => {
    const newConfig = { ...jinaConfig, ...config }
    setJinaConfig(newConfig)
    updateProvider({
      ...provider,
      ...newConfig
    })
  }

  return (
    <>
      <SettingSubtitle>{t('settings.websearch.jina.title')}</SettingSubtitle>
      <SettingDivider />

      <SettingRow>
        <SettingRowTitle>API 端点</SettingRowTitle>
        <Select
          value={jinaConfig.apiEndpoint}
          onChange={(value) => updateConfig({ apiEndpoint: value })}
          className="jina-settings-input-width-200"
          options={[
            { value: 'search', label: 's.jina.ai - 搜索网络并获取SERP' },
            { value: 'reader', label: 'r.jina.ai - 获取URL并解析内容' }
          ]}
        />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>{t('settings.websearch.jina.top_k')}</SettingRowTitle>
        <InputNumber
          min={1}
          max={100}
          value={jinaConfig.topK}
          onChange={(value) => updateConfig({ topK: value })}
          className="jina-settings-input-number-width-100"
        />
      </SettingRow>

      {jinaConfig.apiEndpoint === 'search' && (
        <>
          <SettingRow>
            <SettingRowTitle>{t('settings.websearch.jina.search_type')}</SettingRowTitle>
            <Select
              value={jinaConfig.searchType}
              onChange={(value) => updateConfig({ searchType: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: 'hybrid', label: t('settings.websearch.jina.search_type_hybrid') },
                { value: 'sparse', label: t('settings.websearch.jina.search_type_sparse') },
                { value: 'dense', label: t('settings.websearch.jina.search_type_dense') }
              ]}
            />
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>{t('settings.websearch.jina.include_metadata')}</SettingRowTitle>
            <Checkbox
              checked={jinaConfig.includeMetadata}
              onChange={(e) => updateConfig({ includeMetadata: e.target.checked })}
            />
          </SettingRow>
        </>
      )}

      <SettingRow>
        <SettingRowTitle>{t('settings.websearch.jina.use_reranker')}</SettingRowTitle>
        <Checkbox checked={jinaConfig.useReranker} onChange={(e) => updateConfig({ useReranker: e.target.checked })} />
      </SettingRow>

      <SettingDivider />
      <SettingSubtitle>通用设置</SettingSubtitle>
      <SettingDivider />

      <SettingRow>
        <SettingRowTitle>国家/地区</SettingRowTitle>
        <Select
          value={jinaConfig.country}
          onChange={(value) => updateConfig({ country: value })}
          className="jina-settings-input-width-200"
          options={[
            { value: 'CN', label: '中国' },
            { value: 'US', label: '美国' },
            { value: 'JP', label: '日本' },
            { value: 'GB', label: '英国' },
            { value: 'DE', label: '德国' },
            { value: 'FR', label: '法国' }
          ]}
        />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>语言</SettingRowTitle>
        <Select
          value={jinaConfig.locale}
          onChange={(value) => updateConfig({ locale: value })}
          className="jina-settings-input-width-200"
          options={[
            { value: 'zh-CN', label: '简体中文' },
            { value: 'en-US', label: '英语' },
            { value: 'ja-JP', label: '日语' },
            { value: 'de-DE', label: '德语' },
            { value: 'fr-FR', label: '法语' }
          ]}
        />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>超时时间 (秒)</SettingRowTitle>
        <InputNumber
          min={5}
          max={120}
          value={jinaConfig.timeout}
          onChange={(value) => updateConfig({ timeout: value })}
          className="jina-settings-input-number-width-100"
        />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>返回格式</SettingRowTitle>
        <Select
          value={jinaConfig.returnFormat}
          onChange={(value) => updateConfig({ returnFormat: value })}
          className="jina-settings-input-width-200"
          options={[
            { value: 'markdown', label: 'Markdown' },
            { value: 'html', label: 'HTML' },
            { value: 'text', label: '纯文本' }
          ]}
        />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>引擎</SettingRowTitle>
        <Select
          value={jinaConfig.engine}
          onChange={(value) => updateConfig({ engine: value })}
          className="jina-settings-input-width-200"
          options={[
            { value: 'browser', label: '浏览器 (高质量)' },
            { value: 'direct', label: '直接 (高速)' },
            { value: 'cf-browser-rendering', label: 'CF 浏览器渲染 (实验性)' }
          ]}
        />
      </SettingRow>

      <SettingDivider />

      <SettingRow>
        <SettingRowTitle>禁用缓存</SettingRowTitle>
        <Checkbox checked={jinaConfig.noCache} onChange={(e) => updateConfig({ noCache: e.target.checked })} />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>包含链接摘要</SettingRowTitle>
        <Checkbox checked={jinaConfig.withLinks} onChange={(e) => updateConfig({ withLinks: e.target.checked })} />
      </SettingRow>

      <SettingRow>
        <SettingRowTitle>包含图片摘要</SettingRowTitle>
        <Checkbox checked={jinaConfig.withImages} onChange={(e) => updateConfig({ withImages: e.target.checked })} />
      </SettingRow>

      {/* 搜索API特定设置 */}
      {jinaConfig.apiEndpoint === 'search' && (
        <>
          <SettingDivider />
          <SettingSubtitle>搜索API特定设置 (s.jina.ai)</SettingSubtitle>
          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>站内搜索</SettingRowTitle>
            <Input
              value={jinaConfig.site}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ site: e.target.value })}
              placeholder="例如: example.com"
              className="jina-settings-input-width-200"
            />
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>JSON响应</SettingRowTitle>
            <Checkbox
              checked={jinaConfig.jsonResponse}
              onChange={(e) => updateConfig({ jsonResponse: e.target.checked })}
            />
            <div className="jina-settings-description">响应按照JSON格式，包含URL、标题、内容和问题。</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>获取网站图标</SettingRowTitle>
            <Checkbox
              checked={jinaConfig.fetchFavicons}
              onChange={(e) => updateConfig({ fetchFavicons: e.target.checked })}
            />
            <div className="jina-settings-description">
              获取SERP中每个URL的图标并在响应中包含它们作为图像URI，用于UI渲染。
            </div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>搜索地点</SettingRowTitle>
            <Input
              value={jinaConfig.location}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ location: e.target.value })}
              placeholder="例如: New York City"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">指定搜索查询的来源地，建议精确到城市级别。</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>页码</SettingRowTitle>
            <InputNumber
              min={0}
              value={jinaConfig.page}
              onChange={(value) => updateConfig({ page: value })}
              className="jina-settings-input-number-width-100"
            />
            <div className="jina-settings-description">结果偏移量，用于分页。</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>返回结果数量</SettingRowTitle>
            <InputNumber
              min={1}
              value={jinaConfig.num}
              onChange={(value) => updateConfig({ num: value })}
              className="jina-settings-input-number-width-100"
            />
            <div className="jina-settings-description">设置返回的最大结果数。</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>生成图片替代文本</SettingRowTitle>
            <Checkbox
              checked={jinaConfig.withGeneratedAlt}
              onChange={(e) => updateConfig({ withGeneratedAlt: e.target.checked })}
            />
            <div className="jina-settings-description">为缺少说明的图片添加替代文本。</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>响应处理</SettingRowTitle>
            <Input
              value={jinaConfig.respondWith}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ respondWith: e.target.value })}
              placeholder="例如: no-content"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">控制响应中是否包含页面内容。</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>Set Cookie</SettingRowTitle>
            <Input
              value={jinaConfig.setCookie}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ setCookie: e.target.value })}
              placeholder="例如: name=value"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">用于在访问 URL 时转发自定义 cookie。</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>Proxy URL</SettingRowTitle>
            <Input
              value={jinaConfig.proxyUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ proxyUrl: e.target.value })}
              placeholder="例如: http://your-proxy.com"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">用于通过指定的代理 URL 访问。</div>
          </SettingRow>
        </>
      )}

      {/* Reader API特定设置 */}
      {jinaConfig.apiEndpoint === 'reader' && (
        <>
          <SettingDivider />
          <SettingSubtitle>Reader API特定设置 (r.jina.ai)</SettingSubtitle>
          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>移除选择器</SettingRowTitle>
            <Input
              value={jinaConfig.removeSelectors}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ removeSelectors: e.target.value })}
              placeholder="例如: header,.class,#id"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">CSS选择器，用于排除页面的某些部分（例如，页眉，页脚）</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>目标选择器</SettingRowTitle>
            <Input
              value={jinaConfig.targetSelectors}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ targetSelectors: e.target.value })}
              placeholder="例如: body,.class,#id"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">CSS选择器，用于聚焦页面内的特定元素</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>等待选择器</SettingRowTitle>
            <Input
              value={jinaConfig.waitForSelectors}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ waitForSelectors: e.target.value })}
              placeholder="例如: body,.class,#id"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">CSS选择器，在返回之前等待特定元素</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>生成图片替代文本</SettingRowTitle>
            <Checkbox
              checked={jinaConfig.withGeneratedAlt}
              onChange={(e) => updateConfig({ withGeneratedAlt: e.target.checked })}
            />
            <div className="jina-settings-description">为缺少说明的图片添加替代文本</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>包含iframe内容</SettingRowTitle>
            <Checkbox
              checked={jinaConfig.withIframe}
              onChange={(e) => updateConfig({ withIframe: e.target.checked })}
            />
            <div className="jina-settings-description">在响应中包含iframe内容</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Markdown 链接引用样式</SettingRowTitle>
            <Select
              value={jinaConfig.mdLinkReferenceStyle}
              onChange={(value) => updateConfig({ mdLinkReferenceStyle: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: '', label: '默认' },
                { value: 'collapse', label: '折叠' },
                { value: 'shortcut', label: '快捷方式' }
              ]}
            />
            <div className="jina-settings-description">Markdown 链接引用样式</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Set Cookie</SettingRowTitle>
            <Input
              value={jinaConfig.setCookie}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ setCookie: e.target.value })}
              placeholder="例如: name=value"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">用于在访问 URL 时转发自定义 cookie</div>
          </SettingRow>

          <SettingDivider />

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>响应处理</SettingRowTitle>
            <Input
              value={jinaConfig.respondWith}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ respondWith: e.target.value })}
              placeholder="例如: readerlm-v2"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">使用专门的语言模型处理HTML到Markdown的转换</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>代理</SettingRowTitle>
            <Input
              value={jinaConfig.proxy}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ proxy: e.target.value })}
              placeholder="例如: auto 或 none"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">
              设置基于位置的代理服务器的国家代码。使用'auto'进行最佳选择或'none'禁用
            </div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>生成图片替代文本</SettingRowTitle>
            <Checkbox
              checked={jinaConfig.withGeneratedAlt}
              onChange={(e) => updateConfig({ withGeneratedAlt: e.target.checked })}
            />
            <div className="jina-settings-description">为缺少说明的图片添加替代文本</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>包含iframe内容</SettingRowTitle>
            <Checkbox
              checked={jinaConfig.withIframe}
              onChange={(e) => updateConfig({ withIframe: e.target.checked })}
            />
            <div className="jina-settings-description">在响应中包含iframe内容</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>Token预算</SettingRowTitle>
            <InputNumber
              min={0}
              max={10000}
              value={jinaConfig.tokenBudget}
              onChange={(value) => updateConfig({ tokenBudget: value })}
              className="jina-settings-input-number-width-100"
            />
            <div className="jina-settings-description">请求使用的最大token数（0表示不限制）</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>保留图片</SettingRowTitle>
            <Select
              value={jinaConfig.retainImages}
              onChange={(value) => updateConfig({ retainImages: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: 'all', label: '全部' },
                { value: 'none', label: '无' }
              ]}
            />
            <div className="jina-settings-description">从响应中保留或移除图片</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>响应处理</SettingRowTitle>
            <Input
              value={jinaConfig.respondWith}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ respondWith: e.target.value })}
              placeholder="例如: readerlm-v2"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">使用专门的语言模型处理HTML到Markdown的转换</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>代理</SettingRowTitle>
            <Input
              value={jinaConfig.proxy}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ proxy: e.target.value })}
              placeholder="例如: auto 或 none"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">
              设置基于位置的代理服务器的国家代码。使用'auto'进行最佳选择或'none'禁用
            </div>
          </SettingRow>

          <SettingDivider />

          {/* 新增 Reader API 参数 */}
          <SettingRow>
            <SettingRowTitle>DNT</SettingRowTitle>
            <Checkbox checked={jinaConfig.dnt} onChange={(e) => updateConfig({ dnt: e.target.checked })} />
            <div className="jina-settings-description">控制是否在服务器上缓存和跟踪请求的 URL</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>禁用 GFM</SettingRowTitle>
            <Checkbox checked={jinaConfig.noGfm} onChange={(e) => updateConfig({ noGfm: e.target.checked })} />
            <div className="jina-settings-description">控制是否禁用 GFM (Github Flavored Markdown) 特性</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Robots Txt User-Agent</SettingRowTitle>
            <Input
              value={jinaConfig.robotsTxt}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ robotsTxt: e.target.value })}
              placeholder="例如: Googlebot"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">定义检查 robots.txt 的 bot User-Agent</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>包含 Shadow DOM</SettingRowTitle>
            <Checkbox
              checked={jinaConfig.withShadowDom}
              onChange={(e) => updateConfig({ withShadowDom: e.target.checked })}
            />
            <div className="jina-settings-description">控制是否提取 Shadow DOM 内容</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Base URL 处理</SettingRowTitle>
            <Select
              value={jinaConfig.base}
              onChange={(value) => updateConfig({ base: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: '', label: '默认' },
                { value: 'final', label: '跟随重定向链' }
              ]}
            />
            <div className="jina-settings-description">控制如何处理重定向链</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Markdown 标题样式</SettingRowTitle>
            <Select
              value={jinaConfig.mdHeadingStyle}
              onChange={(value) => updateConfig({ mdHeadingStyle: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: '', label: '默认' },
                { value: 'atx', label: 'ATX 风格 (#)' }
              ]}
            />
            <div className="jina-settings-description">Markdown 标题样式</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>Markdown 水平线样式</SettingRowTitle>
            <Input
              value={jinaConfig.mdHr}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ mdHr: e.target.value })}
              placeholder="例如: ***"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">Markdown 水平线样式</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Markdown 无序列表标记</SettingRowTitle>
            <Select
              value={jinaConfig.mdBulletListMarker}
              onChange={(value) => updateConfig({ mdBulletListMarker: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: '', label: '默认' },
                { value: '*', label: '*' },
                { value: '-', label: '-' },
                { value: '+', label: '+' }
              ]}
            />
            <div className="jina-settings-description">Markdown 无序列表标记</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Markdown 强调分隔符</SettingRowTitle>
            <Select
              value={jinaConfig.mdEmDelimiter}
              onChange={(value) => updateConfig({ mdEmDelimiter: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: '', label: '默认' },
                { value: '_', label: '_' },
                { value: '*', label: '*' }
              ]}
            />
            <div className="jina-settings-description">Markdown 强调分隔符</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Markdown 强强调分隔符</SettingRowTitle>
            <Select
              value={jinaConfig.mdStrongDelimiter}
              onChange={(value) => updateConfig({ mdStrongDelimiter: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: '', label: '默认' },
                { value: '__', label: '__' },
                { value: '**', label: '**' }
              ]}
            />
            <div className="jina-settings-description">Markdown 强强调分隔符</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Markdown 链接样式</SettingRowTitle>
            <Select
              value={jinaConfig.mdLinkStyle}
              onChange={(value) => updateConfig({ mdLinkStyle: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: '', label: '默认 (内嵌)' },
                { value: 'referenced', label: '引用式' },
                { value: 'discarded', label: '丢弃式' }
              ]}
            />
            <div className="jina-settings-description">Markdown 链接样式</div>
          </SettingRow>

          <SettingRow>
            <SettingRowTitle>Markdown 链接引用样式</SettingRowTitle>
            <Select
              value={jinaConfig.mdLinkReferenceStyle}
              onChange={(value) => updateConfig({ mdLinkReferenceStyle: value })}
              className="jina-settings-input-width-200"
              options={[
                { value: '', label: '默认' },
                { value: 'collapse', label: '折叠' },
                { value: 'shortcut', label: '快捷方式' }
              ]}
            />
            <div className="jina-settings-description">Markdown 链接引用样式</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Set Cookie</SettingRowTitle>
            <Input
              value={jinaConfig.setCookie}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ setCookie: e.target.value })}
              placeholder="例如: name=value"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">用于在访问 URL 时转发自定义 cookie</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Proxy URL</SettingRowTitle>
            <Input
              value={jinaConfig.proxyUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ proxyUrl: e.target.value })}
              placeholder="例如: http://your-proxy.com"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">用于通过指定的代理 URL 访问</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Proxy URL</SettingRowTitle>
            <Input
              value={jinaConfig.proxyUrl}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig({ proxyUrl: e.target.value })}
              placeholder="例如: http://your-proxy.com"
              className="jina-settings-input-width-200"
            />
            <div className="jina-settings-description">用于通过指定的代理 URL 访问</div>
          </SettingRow>

          <SettingDivider />

          {/* 请求体参数 */}
          <SettingRow>
            <SettingRowTitle>Viewport</SettingRowTitle>
            <Space>
              <InputNumber
                min={1}
                placeholder="Width"
                value={jinaConfig.viewport?.width}
                onChange={(value) => updateConfig({ viewport: { ...jinaConfig.viewport, width: value } })}
                className="jina-settings-input-number-width-100"
              />
              x
              <InputNumber
                min={1}
                placeholder="Height"
                value={jinaConfig.viewport?.height}
                onChange={(value) => updateConfig({ viewport: { ...jinaConfig.viewport, height: value } })}
                className="jina-settings-input-number-width-100"
              />
            </Space>
            <div className="jina-settings-description">设置浏览器视口尺寸以进行响应式渲染</div>
          </SettingRow>

          <SettingDivider />

          <SettingRow>
            <SettingRowTitle>Inject Page Script</SettingRowTitle>
            <Input.TextArea
              value={jinaConfig.injectPageScript}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                updateConfig({ injectPageScript: e.target.value })
              }
              placeholder="例如: document.querySelector('button').click()"
              className="jina-settings-textarea-width-400"
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
            <div className="jina-settings-description">执行预处理 JavaScript 代码 (inline string or remote URL)</div>
          </SettingRow>
        </>
      )}

      <Space direction="vertical" className="jina-settings-description-container">
        <div className="jina-settings-description">{t('settings.websearch.jina.description')}</div>
      </Space>
    </>
  )
}

export default JinaSearchSettings
