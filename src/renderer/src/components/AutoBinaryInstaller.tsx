import { useEffect, useState } from 'react'
import Logger from '@renderer/config/logger'

interface AutoBinaryInstallerProps {
  onInstallComplete?: (success: boolean) => void
  enabled?: boolean
}

export const AutoBinaryInstaller: React.FC<AutoBinaryInstallerProps> = ({
  onInstallComplete,
  enabled = true
}) => {
  const [isInstalling, setIsInstalling] = useState(false)
  const [installationStatus, setInstallationStatus] = useState<{
    uv: boolean | null
    bun: boolean | null
  }>({ uv: null, bun: null })

  const checkAndInstallBinaries = async () => {
    if (!enabled || isInstalling) return

    if (!window.api) {
      Logger.error('[AutoBinaryInstaller] window.api is not available')
      return
    }

    try {
      setIsInstalling(true)
      Logger.log('[AutoBinaryInstaller] Checking for required binaries...')

      // Check if binaries exist
      const uvExists = await window.api.isBinaryExist('uv')
      const bunExists = await window.api.isBinaryExist('bun')

      Logger.log('[AutoBinaryInstaller] Binary status:', { uv: uvExists, bun: bunExists })

      setInstallationStatus({ uv: uvExists, bun: bunExists })

      if (uvExists && bunExists) {
        Logger.log('[AutoBinaryInstaller] All required binaries are already installed')
        onInstallComplete?.(true)
        return
      }

      let installSuccess = true

      if (!uvExists) {
        try {
          Logger.log('[AutoBinaryInstaller] Installing UV binary...')
          await window.api.installUVBinary()
          Logger.log('[AutoBinaryInstaller] UV installation completed')
          setInstallationStatus(prev => ({ ...prev, uv: true }))
        } catch (error: any) {
          Logger.error('[AutoBinaryInstaller] UV installation failed:', error)
          installSuccess = false
          setInstallationStatus(prev => ({ ...prev, uv: false }))
        }
      }

      // Install Bun if missing
      if (!bunExists) {
        try {
          Logger.log('[AutoBinaryInstaller] Installing Bun binary...')
          await window.api.installBunBinary()
          Logger.log('[AutoBinaryInstaller] Bun installation completed')
          setInstallationStatus(prev => ({ ...prev, bun: true }))
        } catch (error: any) {
          Logger.error('[AutoBinaryInstaller] Bun installation failed:', error)
          installSuccess = false
          setInstallationStatus(prev => ({ ...prev, bun: false }))
        }
      }

      Logger.log('[AutoBinaryInstaller] Auto-installation process completed:', {
        success: installSuccess,
        uvStatus: installationStatus.uv,
        bunStatus: installationStatus.bun
      })

      onInstallComplete?.(installSuccess)
    } catch (error) {
      Logger.error('[AutoBinaryInstaller] Auto-installation failed:', error)
      onInstallComplete?.(false)
    } finally {
      setIsInstalling(false)
    }
  }

  useEffect(() => {
    if (enabled) {
      // Add a small delay to allow the app to fully initialize
      const timer = setTimeout(() => {
        checkAndInstallBinaries()
      }, 2000)

      return () => clearTimeout(timer)
    }

    return () => {}
  }, [enabled])

  return null
}

export default AutoBinaryInstaller