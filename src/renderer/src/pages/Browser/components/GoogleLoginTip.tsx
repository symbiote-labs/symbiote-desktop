import { DeleteOutlined } from '@ant-design/icons'
import { Button, Space } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { GoogleLoginTip as StyledGoogleLoginTip } from '../styles/BrowserStyles'

interface GoogleLoginTipProps {
  onClose: () => void
  onUseGoogleMobile: () => void
  onClearData: () => void
}

const GoogleLoginTip: React.FC<GoogleLoginTipProps> = ({ onClose, onUseGoogleMobile, onClearData }) => {
  const { t } = useTranslation()

  return (
    <StyledGoogleLoginTip>
      <button type="button" className="close-button" onClick={onClose}>
        ×
      </button>
      <div className="tip-content">
        <p>{t('browser.google_login_tip') || '检测到Google登录页面，建议使用移动版登录页面以获得更好的体验。'}</p>
        <Space size="small">
          <Button size="small" type="primary" onClick={onUseGoogleMobile}>
            使用移动版
          </Button>
          <Button size="small" icon={<DeleteOutlined />} onClick={onClearData}>
            清除数据
          </Button>
        </Space>
      </div>
    </StyledGoogleLoginTip>
  )
}

export default GoogleLoginTip
