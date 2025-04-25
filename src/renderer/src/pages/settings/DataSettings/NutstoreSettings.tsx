import { CheckOutlined, FolderOutlined, LoadingOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons'
import { HStack } from '@renderer/components/Layout'
import NutstorePathPopup from '@renderer/components/Popups/NutsorePathPopup'
import { WebdavBackupManager } from '@renderer/components/WebdavBackupManager'
import { useWebdavBackupModal, WebdavBackupModal } from '@renderer/components/WebdavModals'
import { useTheme } from '@renderer/context/ThemeProvider'
import { useNutstoreSSO } from '@renderer/hooks/useNutstoreSSO'
import {
  backupToNutstore,
  checkConnection,
  createDirectory,
  getNutstoreAutoSyncStatus,
  restoreFromNutstore,
  startNutstoreAutoSync,
  stopNutstoreAutoSync
} from '@renderer/services/NutstoreService'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import {
  setNutstoreAutoSync,
  setNutstorePath,
  setNutstoreSyncInterval,
  setNutstoreToken
} from '@renderer/store/nutstore'
import { modalConfirm } from '@renderer/utils'
import { NUTSTORE_HOST } from '@shared/config/nutstore'
import { Button, Input, Select, Tooltip, Typography } from 'antd'
import dayjs from 'dayjs'
import { FC, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type FileStat } from 'webdav'

import { SettingDivider, SettingGroup, SettingRow, SettingRowTitle, SettingTitle } from '..'

const NutstoreSettings: FC = () => {
  const { theme } = useTheme()
  const { t } = useTranslation()
  const { nutstoreToken, nutstorePath, nutstoreSyncInterval, nutstoreAutoSync, nutstoreSyncState } = useAppSelector(
    (state) => state.nutstore
  )

  const dispatch = useAppDispatch()

  const [nutstoreUsername, setNutstoreUsername] = useState<string | undefined>(undefined)
  const [nutstorePass, setNutstorePass] = useState<string | undefined>(undefined)
  const [storagePath, setStoragePath] = useState<string | undefined>(nutstorePath)

  const [checkConnectionLoading, setCheckConnectionLoading] = useState(false)
  const [nsConnected, setNsConnected] = useState<boolean>(false)

  const [syncInterval, setSyncInterval] = useState<number>(nutstoreSyncInterval)

  const nutstoreSSOHandler = useNutstoreSSO()

  const [backupManagerVisible, setBackupManagerVisible] = useState(false)
  // 移除未使用的状态变量
  // const [showDebugInfo, setShowDebugInfo] = useState(false)

  const handleClickNutstoreSSO = useCallback(async () => {
    const ssoUrl = await window.api.nutstore.getSSOUrl()
    window.open(ssoUrl, '_blank')
    const nutstoreToken = await nutstoreSSOHandler()

    dispatch(setNutstoreToken(nutstoreToken))
  }, [dispatch, nutstoreSSOHandler])

  useEffect(() => {
    async function decryptTokenEffect() {
      if (nutstoreToken) {
        const decrypted = await window.api.nutstore.decryptToken(nutstoreToken)

        if (decrypted) {
          setNutstoreUsername(decrypted.username)
          setNutstorePass(decrypted.access_token)
          if (!nutstorePath) {
            dispatch(setNutstorePath('/cherry-studio'))
            setStoragePath('/cherry-studio')
          }
        }
      }
    }
    decryptTokenEffect()
  }, [nutstoreToken, dispatch, nutstorePath])

  const handleLayout = useCallback(async () => {
    const confirmedLogout = await modalConfirm({
      title: t('settings.data.nutstore.logout.title'),
      content: t('settings.data.nutstore.logout.content')
    })
    if (confirmedLogout) {
      dispatch(setNutstoreToken(''))
      dispatch(setNutstorePath(''))
      setNutstoreUsername('')
      setStoragePath(undefined)
    }
  }, [dispatch, t])

  const handleCheckConnection = async () => {
    if (!nutstoreToken) return
    setCheckConnectionLoading(true)
    const isConnectedToNutstore = await checkConnection()

    window.message[isConnectedToNutstore ? 'success' : 'error']({
      key: 'api-check',
      style: { marginTop: '3vh' },
      duration: 2,
      content: isConnectedToNutstore
        ? t('settings.data.nutstore.checkConnection.success')
        : t('settings.data.nutstore.checkConnection.fail')
    })

    setNsConnected(isConnectedToNutstore)
    setCheckConnectionLoading(false)

    setTimeout(() => setNsConnected(false), 3000)
  }

  const { isModalVisible, handleBackup, handleCancel, backuping, customFileName, setCustomFileName, showBackupModal } =
    useWebdavBackupModal({
      backupMethod: backupToNutstore
    })

  const onSyncIntervalChange = (value: number) => {
    setSyncInterval(value)
    dispatch(setNutstoreSyncInterval(value))

    if (value === 0) {
      // 彻底停止自动备份
      dispatch(setNutstoreAutoSync(false))
      stopNutstoreAutoSync()

      // 显示提示消息，确认已停止
      window.message.success({
        content: t('settings.data.nutstore.autoSync.disabled'),
        key: 'nutstore-sync'
      })

      console.log('[NutstoreSettings] Auto sync disabled by user')
    } else {
      // 启动自动备份
      dispatch(setNutstoreAutoSync(true))
      startNutstoreAutoSync()

      // 显示提示消息，确认已启动
      window.message.success({
        content: t('settings.data.nutstore.autoSync.enabled', { minutes: value }),
        key: 'nutstore-sync'
      })

      console.log(`[NutstoreSettings] Auto sync enabled with interval: ${value} minutes`)
    }
  }

  const handleClickPathChange = async () => {
    if (!nutstoreToken) {
      return
    }

    const result = await window.api.nutstore.decryptToken(nutstoreToken)

    if (!result) {
      return
    }

    const targetPath = await NutstorePathPopup.show({
      ls: async (target: string) => {
        const { username, access_token } = result
        const token = window.btoa(`${username}:${access_token}`)
        const items = await window.api.nutstore.getDirectoryContents(token, target)
        return items.map(fileStatToStatModel)
      },
      mkdirs: async (path) => {
        await createDirectory(path)
      }
    })

    if (!targetPath) {
      return
    }

    setStoragePath(targetPath)
    dispatch(setNutstorePath(targetPath))
  }

  const renderSyncStatus = () => {
    if (!nutstoreToken) return null

    if (!nutstoreSyncState.lastSyncTime && !nutstoreSyncState.syncing && !nutstoreSyncState.lastSyncError) {
      return <span style={{ color: 'var(--text-secondary)' }}>{t('settings.data.webdav.noSync')}</span>
    }

    return (
      <HStack gap="5px" alignItems="center">
        {nutstoreSyncState.syncing && <SyncOutlined spin />}
        {!nutstoreSyncState.syncing && nutstoreSyncState.lastSyncError && (
          <Tooltip title={`${t('settings.data.webdav.syncError')}: ${nutstoreSyncState.lastSyncError}`}>
            <WarningOutlined style={{ color: 'red' }} />
          </Tooltip>
        )}
        {nutstoreSyncState.lastSyncTime && (
          <span style={{ color: 'var(--text-secondary)' }}>
            {t('settings.data.webdav.lastSync')}: {dayjs(nutstoreSyncState.lastSyncTime).format('HH:mm:ss')}
          </span>
        )}
      </HStack>
    )
  }

  const isLogin = nutstoreToken && nutstoreUsername

  const showBackupManager = () => {
    setBackupManagerVisible(true)
  }

  const closeBackupManager = () => {
    setBackupManagerVisible(false)
  }

  // 显示调试信息
  const handleShowDebugInfo = () => {
    const status = getNutstoreAutoSyncStatus()
    console.log('[NutstoreSettings] Debug info:', status)

    // 创建格式化的调试信息
    const debugInfo = `
坚果云备份状态:

配置状态:
- 自动备份启用: ${status.configStatus.autoSyncEnabled ? '是' : '否'}
- 同步间隔(分钟): ${status.configStatus.syncIntervalMinutes}
- 上次同步时间: ${status.configStatus.lastSyncTime}
- 上次同步错误: ${status.configStatus.lastSyncError || '无'}

运行时状态:
- 自动同步已启动: ${status.runtimeStatus.autoSyncStarted ? '是' : '否'}
- 自动备份运行中: ${status.runtimeStatus.isAutoBackupRunning ? '是' : '否'}
- 手动备份运行中: ${status.runtimeStatus.isManualBackupRunning ? '是' : '否'}
- 定时器活跃: ${status.runtimeStatus.hasActiveTimer ? '是' : '否'}
- 下次备份: ${status.runtimeStatus.nextScheduledBackup}
    `

    // 显示模态框
    window.modal.info({
      title: '坚果云备份调试信息',
      content: debugInfo,
      width: 500
    })

    // 如果发现不一致的状态，提供修复选项
    if (status.configStatus.autoSyncEnabled !== status.runtimeStatus.autoSyncStarted) {
      window.modal.confirm({
        title: '检测到状态不一致',
        content: '坚果云备份的配置状态与运行状态不一致。是否尝试修复？',
        onOk: () => {
          if (status.configStatus.autoSyncEnabled && !status.runtimeStatus.autoSyncStarted) {
            // 配置启用但未运行，尝试启动
            startNutstoreAutoSync()
          } else if (!status.configStatus.autoSyncEnabled && status.runtimeStatus.autoSyncStarted) {
            // 配置禁用但仍在运行，尝试停止
            stopNutstoreAutoSync()
          }

          // 显示修复后的状态
          setTimeout(() => {
            handleShowDebugInfo()
          }, 1000)
        }
      })
    }
  }

  return (
    <SettingGroup theme={theme}>
      <SettingTitle>{t('settings.data.nutstore.title')}</SettingTitle>
      <SettingDivider />
      <SettingRow>
        <SettingRowTitle>
          {isLogin ? t('settings.data.nutstore.isLogin') : t('settings.data.nutstore.notLogin')}
        </SettingRowTitle>
        {isLogin ? (
          <HStack gap="5px" justifyContent="space-between" alignItems="center">
            <Button
              type={nsConnected ? 'primary' : 'default'}
              ghost={nsConnected}
              onClick={handleCheckConnection}
              loading={checkConnectionLoading}>
              {checkConnectionLoading ? (
                <LoadingOutlined spin />
              ) : nsConnected ? (
                <CheckOutlined />
              ) : (
                t('settings.data.nutstore.checkConnection.name')
              )}
            </Button>
            <Button type="primary" danger onClick={handleLayout}>
              {t('settings.data.nutstore.logout.button')}
            </Button>
          </HStack>
        ) : (
          <Button onClick={handleClickNutstoreSSO}>{t('settings.data.nutstore.login.button')}</Button>
        )}
      </SettingRow>
      <SettingDivider />
      {isLogin && (
        <>
          <SettingRow>
            <SettingRowTitle>{t('settings.data.nutstore.username')}</SettingRowTitle>
            <Typography.Text style={{ color: 'var(--color-text-3)' }}>{nutstoreUsername}</Typography.Text>
          </SettingRow>

          <SettingDivider />
          <SettingRow>
            <SettingRowTitle>{t('settings.data.nutstore.path')}</SettingRowTitle>
            <HStack gap="4px" justifyContent="space-between">
              <Input
                placeholder={t('settings.data.nutstore.path.placeholder')}
                style={{ width: 250 }}
                value={nutstorePath}
                onChange={(e) => {
                  setStoragePath(e.target.value)
                  dispatch(setNutstorePath(e.target.value))
                }}
              />
              <Button type="default" onClick={handleClickPathChange}>
                <FolderOutlined />
              </Button>
            </HStack>
          </SettingRow>
          <SettingDivider />
          <SettingRow>
            <SettingRowTitle>{t('settings.general.backup.title')}</SettingRowTitle>
            <HStack gap="5px" justifyContent="space-between">
              <Button onClick={showBackupModal} loading={backuping}>
                {t('settings.data.nutstore.backup.button')}
              </Button>
              <Button onClick={showBackupManager} disabled={!nutstoreToken}>
                {t('settings.data.nutstore.restore.button')}
              </Button>
            </HStack>
          </SettingRow>
          <SettingDivider />
          <SettingRow>
            <SettingRowTitle>{t('settings.data.webdav.autoSync')}</SettingRowTitle>
            <HStack gap="5px">
              <Select value={syncInterval} onChange={onSyncIntervalChange} style={{ width: 120 }}>
                <Select.Option value={0}>{t('settings.data.webdav.autoSync.off')}</Select.Option>
                <Select.Option value={1}>{t('settings.data.webdav.minute_interval', { count: 1 })}</Select.Option>
                <Select.Option value={5}>{t('settings.data.webdav.minute_interval', { count: 5 })}</Select.Option>
                <Select.Option value={15}>{t('settings.data.webdav.minute_interval', { count: 15 })}</Select.Option>
                <Select.Option value={30}>{t('settings.data.webdav.minute_interval', { count: 30 })}</Select.Option>
                <Select.Option value={60}>{t('settings.data.webdav.hour_interval', { count: 1 })}</Select.Option>
                <Select.Option value={120}>{t('settings.data.webdav.hour_interval', { count: 2 })}</Select.Option>
                <Select.Option value={360}>{t('settings.data.webdav.hour_interval', { count: 6 })}</Select.Option>
                <Select.Option value={720}>{t('settings.data.webdav.hour_interval', { count: 12 })}</Select.Option>
                <Select.Option value={1440}>{t('settings.data.webdav.hour_interval', { count: 24 })}</Select.Option>
              </Select>
              <Button type="text" icon={<WarningOutlined />} onClick={handleShowDebugInfo} title="查看坚果云备份状态" />
            </HStack>
          </SettingRow>
          {nutstoreAutoSync && syncInterval > 0 && (
            <>
              <SettingDivider />
              <SettingRow>
                <SettingRowTitle>{t('settings.data.webdav.syncStatus')}</SettingRowTitle>
                {renderSyncStatus()}
              </SettingRow>
            </>
          )}
        </>
      )}
      <>
        <WebdavBackupModal
          isModalVisible={isModalVisible}
          handleBackup={handleBackup}
          handleCancel={handleCancel}
          backuping={backuping}
          customFileName={customFileName}
          setCustomFileName={setCustomFileName}
        />

        <WebdavBackupManager
          visible={backupManagerVisible}
          onClose={closeBackupManager}
          webdavConfig={{
            webdavHost: NUTSTORE_HOST,
            webdavUser: nutstoreUsername,
            webdavPass: nutstorePass,
            webdavPath: storagePath
          }}
          restoreMethod={restoreFromNutstore}
        />
      </>
    </SettingGroup>
  )
}

export interface StatModel {
  path: string
  basename: string
  isDir: boolean
  isDeleted: boolean
  mtime: number
  size: number
}

function fileStatToStatModel(from: FileStat): StatModel {
  return {
    path: from.filename,
    basename: from.basename,
    isDir: from.type === 'directory',
    isDeleted: false,
    mtime: new Date(from.lastmod).valueOf(),
    size: from.size
  }
}

export default NutstoreSettings
