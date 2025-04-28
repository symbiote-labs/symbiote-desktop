import './services/MemoryFileService'

import fs from 'node:fs'
import { arch } from 'node:os'
import { join } from 'node:path'

import { isMac, isWin } from '@main/constant'
import { getBinaryPath, isBinaryExists, runInstallScript } from '@main/utils/process'
import { IpcChannel } from '@shared/IpcChannel'
import { MCPServer, Shortcut, ThemeMode } from '@types' // Import MCPServer here
import { BrowserWindow, ipcMain, session, shell, webContents } from 'electron'
import log from 'electron-log'

import { titleBarOverlayDark, titleBarOverlayLight } from './config'
import AppUpdater from './services/AppUpdater'
import { asrServerService } from './services/ASRServerService'
import BackupManager from './services/BackupManager'
import { codeExecutorService } from './services/CodeExecutorService'
import { configManager } from './services/ConfigManager'
import CopilotService from './services/CopilotService'
import { deepResearchService } from './services/DeepResearchService'
import { ExportService } from './services/ExportService'
import FileService from './services/FileService'
import FileStorage from './services/FileStorage'
import { GeminiService } from './services/GeminiService'
import KnowledgeService from './services/KnowledgeService'
import mcpService from './services/MCPService'
import { memoryFileService } from './services/MemoryFileService'
import * as MsTTSService from './services/MsTTSService'
import * as NutstoreService from './services/NutstoreService'
import ObsidianVaultService from './services/ObsidianVaultService'
import { PDFService } from './services/PDFService'
import { ProxyConfig, proxyManager } from './services/ProxyManager'
import { searchService } from './services/SearchService'
import { registerShortcuts, unregisterAllShortcuts } from './services/ShortcutService'
import { TrayService } from './services/TrayService'
import { windowService } from './services/WindowService'
import WorkspaceService from './services/WorkspaceService'
import { getResourcePath } from './utils'
import { decrypt, encrypt } from './utils/aes'
import { getConfigDir, getFilesDir } from './utils/file'
import { compress, decompress } from './utils/zip'

const fileManager = new FileStorage()
const backupManager = new BackupManager()
const exportService = new ExportService(fileManager)
const obsidianVaultService = new ObsidianVaultService()

export function registerIpc(mainWindow: BrowserWindow, app: Electron.App) {
  const appUpdater = new AppUpdater(mainWindow)

  ipcMain.handle(IpcChannel.App_Info, () => ({
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    appPath: app.getAppPath(),
    filesPath: getFilesDir(),
    configPath: getConfigDir(),
    appDataPath: app.getPath('userData'),
    resourcesPath: getResourcePath(),
    logsPath: log.transports.file.getFile().path,
    arch: arch()
  }))

  ipcMain.handle(IpcChannel.App_Proxy, async (_, proxy: string) => {
    let proxyConfig: ProxyConfig

    if (proxy === 'system') {
      proxyConfig = { mode: 'system' }
    } else if (proxy) {
      proxyConfig = { mode: 'custom', url: proxy }
    } else {
      proxyConfig = { mode: 'none' }
    }

    await proxyManager.configureProxy(proxyConfig)
  })

  ipcMain.handle(IpcChannel.App_Reload, () => mainWindow.reload())
  ipcMain.handle(IpcChannel.Open_Website, (_, url: string) => shell.openExternal(url))

  // Update
  ipcMain.handle(IpcChannel.App_ShowUpdateDialog, () => appUpdater.showUpdateDialog(mainWindow))

  // language
  ipcMain.handle(IpcChannel.App_SetLanguage, (_, language) => {
    configManager.setLanguage(language)
  })

  // launch on boot
  ipcMain.handle(IpcChannel.App_SetLaunchOnBoot, (_, openAtLogin: boolean) => {
    // Set login item settings for windows and mac
    // linux is not supported because it requires more file operations
    if (isWin || isMac) {
      app.setLoginItemSettings({ openAtLogin })
    }
  })

  // launch to tray
  ipcMain.handle(IpcChannel.App_SetLaunchToTray, (_, isActive: boolean) => {
    configManager.setLaunchToTray(isActive)
  })

  // tray
  ipcMain.handle(IpcChannel.App_SetTray, (_, isActive: boolean) => {
    configManager.setTray(isActive)
  })

  // to tray on close
  ipcMain.handle(IpcChannel.App_SetTrayOnClose, (_, isActive: boolean) => {
    configManager.setTrayOnClose(isActive)
  })

  // 设置数据收集
  ipcMain.handle('app:setEnableDataCollection', (_, isActive: boolean) => {
    configManager.setEnableDataCollection(isActive)
  })

  ipcMain.handle(IpcChannel.App_RestartTray, () => TrayService.getInstance().restartTray())

  ipcMain.handle(IpcChannel.Config_Set, (_, key: string, value: any) => {
    configManager.set(key, value)
  })

  ipcMain.handle(IpcChannel.Config_Get, (_, key: string) => {
    return configManager.get(key)
  })

  // theme
  ipcMain.handle(IpcChannel.App_SetTheme, (event, theme: ThemeMode) => {
    if (theme === configManager.getTheme()) return

    configManager.setTheme(theme)

    // should sync theme change to all windows
    const senderWindowId = event.sender.id
    const windows = BrowserWindow.getAllWindows()
    // 向其他窗口广播主题变化
    windows.forEach((win) => {
      if (win.webContents.id !== senderWindowId) {
        win.webContents.send(IpcChannel.ThemeChange, theme)
      }
    })

    mainWindow?.setTitleBarOverlay &&
      mainWindow.setTitleBarOverlay(theme === 'dark' ? titleBarOverlayDark : titleBarOverlayLight)
  })

  // clear cache
  ipcMain.handle(IpcChannel.App_ClearCache, async () => {
    const sessions = [session.defaultSession, session.fromPartition('persist:webview')]

    try {
      await Promise.all(
        sessions.map(async (session) => {
          await session.clearCache()
          await session.clearStorageData({
            storages: ['cookies', 'filesystem', 'shadercache', 'websql', 'serviceworkers', 'cachestorage']
          })
        })
      )
      await fileManager.clearTemp()
      fs.writeFileSync(log.transports.file.getFile().path, '')
      return { success: true }
    } catch (error: any) {
      log.error('Failed to clear cache:', error)
      return { success: false, error: error.message }
    }
  })

  // 清除浏览器数据
  ipcMain.handle('browser:clear-data', async () => {
    const browserSession = session.fromPartition('persist:browser')

    try {
      // 清除所有类型的存储数据
      await browserSession.clearStorageData({
        storages: ['cookies', 'filesystem', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
        quotas: ['temporary', 'syncable']
      })

      // 清除HTTP缓存
      await browserSession.clearCache()

      // 清除主机解析器缓存
      await browserSession.clearHostResolverCache()

      // 清除授权缓存
      await browserSession.clearAuthCache()

      // 清除代码缓存
      if (typeof browserSession.clearCodeCaches === 'function') {
        await browserSession.clearCodeCaches({ urls: ['*'] })
      }

      return { success: true }
    } catch (error: any) {
      log.error('Failed to clear browser data:', error)
      return { success: false, error: error.message }
    }
  })

  // 销毁webContents
  ipcMain.handle('browser:destroy-webcontents', async (_, webContentsId: number) => {
    try {
      // 尝试通过ID获取webContents
      const allWebContents = webContents.getAllWebContents()
      const targetWebContents = allWebContents.find((wc) => wc.id === webContentsId)

      if (targetWebContents) {
        // 如果找到了webContents，尝试销毁它
        if (!targetWebContents.isDestroyed()) {
          // 先停止加载
          targetWebContents.stop()

          // 加载空白页面
          targetWebContents.loadURL('about:blank')

          // 等待一小段时间，让空白页面加载完成
          await new Promise((resolve) => setTimeout(resolve, 100))

          // 销毁webContents - 使用close方法
          targetWebContents.close() // WebContents没有destroy方法，但有close方法

          log.info(`Successfully destroyed webContents with ID: ${webContentsId}`)
          return { success: true }
        } else {
          log.info(`WebContents with ID ${webContentsId} is already destroyed`)
          return { success: true, alreadyDestroyed: true }
        }
      } else {
        log.warn(`WebContents with ID ${webContentsId} not found`)
        return { success: false, error: 'WebContents not found' }
      }
    } catch (error: any) {
      log.error(`Failed to destroy webContents with ID ${webContentsId}:`, error)
      return { success: false, error: error.message }
    }
  })

  // check for update
  ipcMain.handle(IpcChannel.App_CheckForUpdate, async () => {
    const update = await appUpdater.autoUpdater.checkForUpdates()

    return {
      currentVersion: appUpdater.autoUpdater.currentVersion,
      updateInfo: update?.updateInfo
    }
  })

  // zip
  ipcMain.handle(IpcChannel.Zip_Compress, (_, text: string) => compress(text))
  ipcMain.handle(IpcChannel.Zip_Decompress, (_, text: Buffer) => decompress(text))

  // system
  ipcMain.handle(IpcChannel.System_GetDeviceType, () => {
    if (isMac) return 'mac'
    if (isWin) return 'windows'
    return 'linux'
  })
  ipcMain.handle(IpcChannel.System_GetHostname, () => require('os').hostname())

  // backup
  ipcMain.handle(IpcChannel.Backup_Backup, backupManager.backup)
  ipcMain.handle(IpcChannel.Backup_Restore, backupManager.restore)
  ipcMain.handle(IpcChannel.Backup_BackupToWebdav, backupManager.backupToWebdav)
  ipcMain.handle(IpcChannel.Backup_RestoreFromWebdav, backupManager.restoreFromWebdav)
  ipcMain.handle(IpcChannel.Backup_ListWebdavFiles, backupManager.listWebdavFiles)
  ipcMain.handle(IpcChannel.Backup_CheckConnection, backupManager.checkConnection)
  ipcMain.handle(IpcChannel.Backup_CreateDirectory, backupManager.createDirectory)
  ipcMain.handle(IpcChannel.Backup_DeleteWebdavFile, backupManager.deleteWebdavFile)

  // file
  ipcMain.handle(IpcChannel.File_Open, fileManager.open)
  ipcMain.handle(IpcChannel.File_OpenPath, fileManager.openPath)
  ipcMain.handle(IpcChannel.File_Save, fileManager.save)
  ipcMain.handle(IpcChannel.File_Select, fileManager.selectFile)
  ipcMain.handle(IpcChannel.File_Upload, fileManager.uploadFile)
  ipcMain.handle(IpcChannel.File_Clear, fileManager.clear)
  ipcMain.handle(IpcChannel.File_Read, fileManager.readFile)
  ipcMain.handle(IpcChannel.File_Delete, fileManager.deleteFile)
  ipcMain.handle(IpcChannel.File_Get, fileManager.getFile)
  ipcMain.handle(IpcChannel.File_SelectFolder, fileManager.selectFolder)
  ipcMain.handle(IpcChannel.File_Create, fileManager.createTempFile)
  ipcMain.handle(IpcChannel.File_Write, fileManager.writeFile)
  ipcMain.handle(IpcChannel.File_SaveImage, fileManager.saveImage)
  ipcMain.handle(IpcChannel.File_Base64Image, fileManager.base64Image)
  ipcMain.handle(IpcChannel.File_Download, fileManager.downloadFile)
  ipcMain.handle(IpcChannel.File_Copy, fileManager.copyFile)
  ipcMain.handle(IpcChannel.File_BinaryFile, fileManager.binaryFile)

  // fs
  ipcMain.handle(IpcChannel.Fs_Read, FileService.readFile)

  // export
  ipcMain.handle(IpcChannel.Export_Word, exportService.exportToWord)

  // open path
  ipcMain.handle(IpcChannel.Open_Path, async (_, path: string) => {
    await shell.openPath(path)
  })

  // browser
  ipcMain.handle('browser:openNewWindow', async (_, args: { url: string; title?: string }) => {
    log.info('Received IPC call to open new window:', args) // 添加日志
    const { url, title } = args

    // 获取浏览器会话
    const browserSession = session.fromPartition('persist:browser')

    // 创建新的浏览器窗口，使用相同的会话
    const newWindow = new BrowserWindow({
      width: 1000,
      height: 800,
      title: title || 'New Window',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
        session: browserSession // 使用与内置浏览器相同的会话
      }
    })

    // 加载URL
    await newWindow.loadURL(url)

    // 当窗口关闭时，通知渲染进程同步cookie
    newWindow.on('closed', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('browser-window-closed')
      }
    })
  })

  // 同步cookie
  ipcMain.handle('browser:syncCookies', async () => {
    try {
      // 获取浏览器会话
      const browserSession = session.fromPartition('persist:browser')

      // 获取所有cookie
      const cookies = await browserSession.cookies.get({})

      log.info(`[Cookie Sync] Found ${cookies.length} cookies in browser session`)

      return { success: true, message: `Synced ${cookies.length} cookies` }
    } catch (error: any) {
      log.error('[Cookie Sync] Error syncing cookies:', error)
      return { success: false, message: `Error: ${error.message}` }
    }
  })

  // shortcuts
  ipcMain.handle(IpcChannel.Shortcuts_Update, (_, shortcuts: Shortcut[]) => {
    configManager.setShortcuts(shortcuts)
    // Refresh shortcuts registration
    if (mainWindow) {
      unregisterAllShortcuts()
      registerShortcuts(mainWindow)
    }
  })

  // knowledge base
  ipcMain.handle(IpcChannel.KnowledgeBase_Create, KnowledgeService.create)
  ipcMain.handle(IpcChannel.KnowledgeBase_Reset, KnowledgeService.reset)
  ipcMain.handle(IpcChannel.KnowledgeBase_Delete, KnowledgeService.delete)
  ipcMain.handle(IpcChannel.KnowledgeBase_Add, KnowledgeService.add)
  ipcMain.handle(IpcChannel.KnowledgeBase_Remove, KnowledgeService.remove)
  ipcMain.handle(IpcChannel.KnowledgeBase_Search, KnowledgeService.search)
  ipcMain.handle(IpcChannel.KnowledgeBase_Rerank, KnowledgeService.rerank)

  // window
  ipcMain.handle(IpcChannel.Windows_SetMinimumSize, (_, width: number, height: number) => {
    mainWindow?.setMinimumSize(width, height)
  })

  ipcMain.handle(IpcChannel.Windows_ResetMinimumSize, () => {
    mainWindow?.setMinimumSize(1080, 600)
    const [width, height] = mainWindow?.getSize() ?? [1080, 600]
    if (width < 1080) {
      mainWindow?.setSize(1080, height)
    }
  })

  // 添加窗口最小化和关闭处理程序
  ipcMain.handle(IpcChannel.Windows_Minimize, () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    if (win) {
      win.minimize()
    }
  })

  ipcMain.handle(IpcChannel.Windows_Close, () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow
    if (win) {
      win.close()
    }
  })

  // gemini
  ipcMain.handle(IpcChannel.Gemini_UploadFile, GeminiService.uploadFile)
  ipcMain.handle(IpcChannel.Gemini_Base64File, GeminiService.base64File)
  ipcMain.handle(IpcChannel.Gemini_RetrieveFile, GeminiService.retrieveFile)
  ipcMain.handle(IpcChannel.Gemini_ListFiles, GeminiService.listFiles)
  ipcMain.handle(IpcChannel.Gemini_DeleteFile, GeminiService.deleteFile)

  // mini window
  ipcMain.handle(IpcChannel.MiniWindow_Show, () => windowService.showMiniWindow())
  ipcMain.handle(IpcChannel.MiniWindow_Hide, () => windowService.hideMiniWindow())
  ipcMain.handle(IpcChannel.MiniWindow_Close, () => windowService.closeMiniWindow())
  ipcMain.handle(IpcChannel.MiniWindow_Toggle, () => windowService.toggleMiniWindow())
  ipcMain.handle(IpcChannel.MiniWindow_SetPin, (_, isPinned) => windowService.setPinMiniWindow(isPinned))

  // aes
  ipcMain.handle(IpcChannel.Aes_Encrypt, (_, text: string, secretKey: string, iv: string) =>
    encrypt(text, secretKey, iv)
  )
  ipcMain.handle(IpcChannel.Aes_Decrypt, (_, encryptedData: string, iv: string, secretKey: string) =>
    decrypt(encryptedData, iv, secretKey)
  )

  // Register MCP handlers
  ipcMain.handle(IpcChannel.Mcp_RemoveServer, mcpService.removeServer)
  ipcMain.handle(IpcChannel.Mcp_RestartServer, mcpService.restartServer)
  ipcMain.handle(IpcChannel.Mcp_StopServer, mcpService.stopServer)
  ipcMain.handle(IpcChannel.Mcp_ListTools, mcpService.listTools)
  ipcMain.handle(IpcChannel.Mcp_ResetToolsList, mcpService.resetToolsList)
  ipcMain.handle(IpcChannel.Mcp_CallTool, mcpService.callTool)
  ipcMain.handle(IpcChannel.Mcp_ListPrompts, mcpService.listPrompts)
  ipcMain.handle(IpcChannel.Mcp_GetPrompt, mcpService.getPrompt)
  ipcMain.handle(IpcChannel.Mcp_ListResources, mcpService.listResources)
  ipcMain.handle(IpcChannel.Mcp_GetResource, mcpService.getResource)
  ipcMain.handle(IpcChannel.Mcp_GetInstallInfo, mcpService.getInstallInfo)
  // Add handler for rerunTool
  // Update handler for rerunTool to accept serverId and toolName
  ipcMain.handle(
    IpcChannel.Mcp_RerunTool,
    (
      event,
      messageId: string,
      toolCallId: string,
      server: MCPServer, // Changed from serverId: string to server: MCPServer
      toolName: string,
      args: Record<string, any>
    ) => mcpService.rerunTool(event, messageId, toolCallId, server, toolName, args) // Pass the full server object
  )

  ipcMain.handle(IpcChannel.App_IsBinaryExist, (_, name: string) => isBinaryExists(name))
  ipcMain.handle(IpcChannel.App_GetBinaryPath, (_, name: string) => getBinaryPath(name))
  ipcMain.handle(IpcChannel.App_InstallUvBinary, () => runInstallScript('install-uv.js'))
  ipcMain.handle(IpcChannel.App_InstallBunBinary, () => runInstallScript('install-bun.js'))

  //copilot
  ipcMain.handle(IpcChannel.Copilot_GetAuthMessage, CopilotService.getAuthMessage)
  ipcMain.handle(IpcChannel.Copilot_GetCopilotToken, CopilotService.getCopilotToken)
  ipcMain.handle(IpcChannel.Copilot_SaveCopilotToken, CopilotService.saveCopilotToken)
  ipcMain.handle(IpcChannel.Copilot_GetToken, CopilotService.getToken)
  ipcMain.handle(IpcChannel.Copilot_Logout, CopilotService.logout)
  ipcMain.handle(IpcChannel.Copilot_GetUser, CopilotService.getUser)

  // Obsidian service
  ipcMain.handle(IpcChannel.Obsidian_GetVaults, () => {
    return obsidianVaultService.getVaults()
  })

  ipcMain.handle(IpcChannel.Obsidian_GetFiles, (_event, vaultName) => {
    return obsidianVaultService.getFilesByVaultName(vaultName)
  })

  // nutstore
  ipcMain.handle(IpcChannel.Nutstore_GetSsoUrl, NutstoreService.getNutstoreSSOUrl)
  ipcMain.handle(IpcChannel.Nutstore_DecryptToken, (_, token: string) => NutstoreService.decryptToken(token))
  ipcMain.handle(IpcChannel.Nutstore_GetDirectoryContents, (_, token: string, path: string) =>
    NutstoreService.getDirectoryContents(token, path)
  )

  // search window
  ipcMain.handle(IpcChannel.SearchWindow_Open, async (_, uid: string) => {
    await searchService.openSearchWindow(uid)
  })
  ipcMain.handle(IpcChannel.SearchWindow_Close, async (_, uid: string) => {
    await searchService.closeSearchWindow(uid)
  })
  ipcMain.handle(IpcChannel.SearchWindow_OpenUrl, async (_, uid: string, url: string) => {
    return await searchService.openUrlInSearchWindow(uid, url)
  })

  // memory
  ipcMain.handle(IpcChannel.Memory_LoadData, async () => {
    return await memoryFileService.loadData()
  })
  ipcMain.handle(IpcChannel.Memory_SaveData, async (_, data, forceOverwrite = false) => {
    return await memoryFileService.saveData(data, forceOverwrite)
  })
  ipcMain.handle(IpcChannel.Memory_DeleteShortMemoryById, async (_, id) => {
    return await memoryFileService.deleteShortMemoryById(id)
  })
  ipcMain.handle(IpcChannel.LongTermMemory_LoadData, async () => {
    return await memoryFileService.loadLongTermData()
  })
  ipcMain.handle(IpcChannel.LongTermMemory_SaveData, async (_, data, forceOverwrite = false) => {
    return await memoryFileService.saveLongTermData(data, forceOverwrite)
  })

  // 注册ASR服务器IPC处理程序
  asrServerService.registerIpcHandlers()

  // 注册MsTTS IPC处理程序
  ipcMain.handle(IpcChannel.MsTTS_GetVoices, MsTTSService.getVoices)
  ipcMain.handle(IpcChannel.MsTTS_Synthesize, (_, text: string, voice: string, outputFormat: string) =>
    MsTTSService.synthesize(text, voice, outputFormat)
  )

  // 注册代码执行器IPC处理程序
  ipcMain.handle(IpcChannel.CodeExecutor_GetSupportedLanguages, async () => {
    return await codeExecutorService.getSupportedLanguages()
  })
  ipcMain.handle(IpcChannel.CodeExecutor_ExecuteJS, async (_, code: string) => {
    return await codeExecutorService.executeJavaScript(code)
  })
  ipcMain.handle(IpcChannel.CodeExecutor_ExecutePython, async (_, code: string) => {
    return await codeExecutorService.executePython(code)
  })

  // PDF服务
  ipcMain.handle(IpcChannel.PDF_SplitPDF, PDFService.splitPDF.bind(PDFService))
  ipcMain.handle(IpcChannel.PDF_GetPageCount, PDFService.getPDFPageCount.bind(PDFService))

  // 深度研究服务
  deepResearchService.setMainWindow(mainWindow)
  // 使用 IpcChannel 枚举代替硬编码字符串
  // 注意：DeepResearch_Progress 和 DeepResearch_Complete 事件是由 DeepResearchService 发送到渲染进程的
  // 不需要在主进程中注册处理程序
  // 注册深度研究的处理程序
  ipcMain.handle('deep-research:start', async (_, query: string, websearch: any) => {
    return await deepResearchService.startResearch(query, websearch)
  })
  ipcMain.handle('deep-research:cancel', () => {
    deepResearchService.cancelResearch()
  })

  // 工作区服务
  const workspaceService = new WorkspaceService()
  ipcMain.handle('workspace:selectFolder', workspaceService.selectWorkspaceFolder)
  ipcMain.handle('workspace:getFiles', workspaceService.getWorkspaceFiles)
  ipcMain.handle('workspace:readFile', workspaceService.readWorkspaceFile)
  ipcMain.handle('workspace:getFolderStructure', workspaceService.getWorkspaceFolderStructure)
}
