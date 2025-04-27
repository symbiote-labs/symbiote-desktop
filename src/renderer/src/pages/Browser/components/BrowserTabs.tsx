import { CloseOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Tabs } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { TabsContainer } from '../styles/BrowserStyles'
import { FaviconImage } from '../styles/BrowserStyles'
import { Tab } from '../types'

interface BrowserTabsProps {
  tabs: Tab[]
  activeTabId: string
  onTabChange: (tabId: string) => void
  onAddTab: () => void
  onCloseTab: (tabId: string, e: React.MouseEvent<HTMLElement>) => void
}

const BrowserTabs: React.FC<BrowserTabsProps> = ({ tabs, activeTabId, onTabChange, onAddTab, onCloseTab }) => {
  const { t } = useTranslation()

  return (
    <TabsContainer>
      <Tabs
        type="card"
        activeKey={activeTabId}
        onChange={onTabChange}
        tabBarExtraContent={{
          right: (
            <Button
              className="add-tab-button"
              icon={<PlusOutlined />}
              onClick={onAddTab}
              title={t('browser.new_tab')}
            />
          )
        }}
        items={tabs.map((tab) => ({
          key: tab.id,
          label: (
            <span>
              {tab.favicon && <FaviconImage src={tab.favicon} alt="" />}
              {tab.title || tab.url}
              <CloseOutlined onClick={(e) => onCloseTab(tab.id, e)} />
            </span>
          )
        }))}
      />
    </TabsContainer>
  )
}

export default BrowserTabs
