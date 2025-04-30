export enum IpcChannel {
  // App
  App_Info = 'app:info',
  App_Proxy = 'app:proxy',
  App_Reload = 'app:reload',
  App_ShowUpdateDialog = 'app:showUpdateDialog',
  App_SetLanguage = 'app:setLanguage',
  App_SetLaunchOnBoot = 'app:setLaunchOnBoot',
  App_SetLaunchToTray = 'app:setLaunchToTray',
  App_SetTray = 'app:setTray',
  App_SetTrayOnClose = 'app:setTrayOnClose',
  App_RestartTray = 'app:restartTray',
  App_SetTheme = 'app:setTheme',
  App_GetTheme = 'app:getTheme',
  App_ClearCache = 'app:clearCache',
  App_CheckForUpdate = 'app:checkForUpdate',
  App_IsBinaryExist = 'app:isBinaryExist',
  App_GetBinaryPath = 'app:getBinaryPath',
  App_InstallUvBinary = 'app:installUvBinary',
  App_InstallBunBinary = 'app:installBunBinary',

  // Config
  Config_Set = 'config:set',
  Config_Get = 'config:get',

  // Zip
  Zip_Compress = 'zip:compress',
  Zip_Decompress = 'zip:decompress',

  // Backup
  Backup_Backup = 'backup:backup',
  Backup_Restore = 'backup:restore',
  Backup_BackupToWebdav = 'backup:backupToWebdav',
  Backup_RestoreFromWebdav = 'backup:restoreFromWebdav',
  Backup_ListWebdavFiles = 'backup:listWebdavFiles',
  Backup_CheckConnection = 'backup:checkConnection',
  Backup_CreateDirectory = 'backup:createDirectory',
  Backup_DeleteWebdavFile = 'backup:deleteWebdavFile',

  // File
  File_Open = 'file:open',
  File_OpenPath = 'file:openPath',
  File_Save = 'file:save',
  File_Select = 'file:select',
  File_Upload = 'file:upload',
  File_Clear = 'file:clear',
  File_Read = 'file:read',
  File_Delete = 'file:delete',
  File_Get = 'file:get',
  File_SelectFolder = 'file:selectFolder',
  File_Create = 'file:create',
  File_Write = 'file:write',
  File_SaveImage = 'file:saveImage',
  File_Base64Image = 'file:base64Image',
  File_Download = 'file:download',
  File_Copy = 'file:copy',
  File_BinaryFile = 'file:binaryFile',

  // Fs
  Fs_Read = 'fs:read',

  // Export
  Export_Word = 'export:word',

  // Open
  Open_Path = 'open:path',
  Open_Website = 'open:website',

  // Shortcuts
  Shortcuts_Update = 'shortcuts:update',

  // Knowledge Base
  KnowledgeBase_Create = 'knowledgeBase:create',
  KnowledgeBase_Reset = 'knowledgeBase:reset',
  KnowledgeBase_Delete = 'knowledgeBase:delete',
  KnowledgeBase_Add = 'knowledgeBase:add',
  KnowledgeBase_Remove = 'knowledgeBase:remove',
  KnowledgeBase_Search = 'knowledgeBase:search',
  KnowledgeBase_Rerank = 'knowledgeBase:rerank',

  // Windows
  Windows_SetMinimumSize = 'windows:setMinimumSize',
  Windows_ResetMinimumSize = 'windows:resetMinimumSize',
  Windows_Minimize = 'windows:minimize',
  Windows_Close = 'windows:close',

  // Gemini
  Gemini_UploadFile = 'gemini:uploadFile',
  Gemini_Base64File = 'gemini:base64File',
  Gemini_RetrieveFile = 'gemini:retrieveFile',
  Gemini_ListFiles = 'gemini:listFiles',
  Gemini_DeleteFile = 'gemini:deleteFile',

  // Mini Window
  MiniWindow_Show = 'miniWindow:show',
  MiniWindow_Hide = 'miniWindow:hide',
  MiniWindow_Close = 'miniWindow:close',
  MiniWindow_Toggle = 'miniWindow:toggle',
  MiniWindow_SetPin = 'miniWindow:setPin',

  // AES
  Aes_Encrypt = 'aes:encrypt',
  Aes_Decrypt = 'aes:decrypt',

  // MCP
  Mcp_RemoveServer = 'mcp:removeServer',
  Mcp_RestartServer = 'mcp:restartServer',
  Mcp_StopServer = 'mcp:stopServer',
  Mcp_ListTools = 'mcp:listTools',
  Mcp_ResetToolsList = 'mcp:resetToolsList',
  Mcp_CallTool = 'mcp:callTool',
  Mcp_ListPrompts = 'mcp:listPrompts',
  Mcp_GetPrompt = 'mcp:getPrompt',
  Mcp_ListResources = 'mcp:listResources',
  Mcp_GetResource = 'mcp:getResource',
  Mcp_GetInstallInfo = 'mcp:getInstallInfo',
  Mcp_RerunTool = 'mcp:rerunTool',

  // Copilot
  Copilot_GetAuthMessage = 'copilot:getAuthMessage',
  Copilot_GetCopilotToken = 'copilot:getCopilotToken',
  Copilot_SaveCopilotToken = 'copilot:saveCopilotToken',
  Copilot_GetToken = 'copilot:getToken',
  Copilot_Logout = 'copilot:logout',
  Copilot_GetUser = 'copilot:getUser',

  // Obsidian
  Obsidian_GetVaults = 'obsidian:getVaults',
  Obsidian_GetFiles = 'obsidian:getFiles',

  // Nutstore
  Nutstore_GetSsoUrl = 'nutstore:getSsoUrl',
  Nutstore_DecryptToken = 'nutstore:decryptToken',
  Nutstore_GetDirectoryContents = 'nutstore:getDirectoryContents',

  // Search Window
  SearchWindow_Open = 'searchWindow:open',
  SearchWindow_Close = 'searchWindow:close',
  SearchWindow_OpenUrl = 'searchWindow:openUrl',

  // Memory
  Memory_LoadData = 'memory:loadData',
  Memory_SaveData = 'memory:saveData',
  Memory_DeleteShortMemoryById = 'memory:deleteShortMemoryById',
  LongTermMemory_LoadData = 'longTermMemory:loadData',
  LongTermMemory_SaveData = 'longTermMemory:saveData',

  // ASR
  ASR_Start = 'asr:start',
  ASR_Stop = 'asr:stop',
  ASR_GetStatus = 'asr:getStatus',
  ASR_GetLanguages = 'asr:getLanguages',
  ASR_SetLanguage = 'asr:setLanguage',
  ASR_GetLanguage = 'asr:getLanguage',
  ASR_GetModels = 'asr:getModels',
  ASR_SetModel = 'asr:setModel',
  ASR_GetModel = 'asr:getModel',
  ASR_GetDevices = 'asr:getDevices',
  ASR_SetDevice = 'asr:setDevice',
  ASR_GetDevice = 'asr:getDevice',
  ASR_GetServerStatus = 'asr:getServerStatus',
  ASR_StartServer = 'asr:startServer',
  ASR_StopServer = 'asr:stopServer',
  ASR_GetServerInfo = 'asr:getServerInfo',
  ASR_GetServerLogs = 'asr:getServerLogs',
  ASR_ClearServerLogs = 'asr:clearServerLogs',
  ASR_GetServerConfig = 'asr:getServerConfig',
  ASR_SetServerConfig = 'asr:setServerConfig',
  ASR_GetServerModels = 'asr:getServerModels',
  ASR_DownloadServerModel = 'asr:downloadServerModel',
  ASR_DeleteServerModel = 'asr:deleteServerModel',
  ASR_GetServerModelDownloadStatus = 'asr:getServerModelDownloadStatus',
  ASR_CancelServerModelDownload = 'asr:cancelServerModelDownload',
  ASR_GetServerModelInfo = 'asr:getServerModelInfo',
  ASR_GetServerModelList = 'asr:getServerModelList',
  ASR_GetServerModelDownloadList = 'asr:getServerModelDownloadList',
  ASR_GetServerModelDownloadInfo = 'asr:getServerModelDownloadInfo',
  ASR_GetServerModelDownloadProgress = 'asr:getServerModelDownloadProgress',
  ASR_GetServerModelDownloadSpeed = 'asr:getServerModelDownloadSpeed',
  ASR_GetServerModelDownloadSize = 'asr:getServerModelDownloadSize',
  ASR_GetServerModelDownloadTime = 'asr:getServerModelDownloadTime',
  ASR_GetServerModelDownloadTimeLeft = 'asr:getServerModelDownloadTimeLeft',
  ASR_GetServerModelDownloadPercentage = 'asr:getServerModelDownloadPercentage',
  ASR_GetServerModelDownloadState = 'asr:getServerModelDownloadState',
  ASR_GetServerModelDownloadError = 'asr:getServerModelDownloadError',
  ASR_GetServerModelDownloadUrl = 'asr:getServerModelDownloadUrl',
  ASR_GetServerModelDownloadPath = 'asr:getServerModelDownloadPath',
  ASR_GetServerModelDownloadFileName = 'asr:getServerModelDownloadFileName',
  ASR_GetServerModelDownloadFileSize = 'asr:getServerModelDownloadFileSize',
  ASR_GetServerModelDownloadFileSizeFormatted = 'asr:getServerModelDownloadFileSizeFormatted',
  ASR_GetServerModelDownloadFileSizeUnit = 'asr:getServerModelDownloadFileSizeUnit',
  ASR_GetServerModelDownloadFileSizeValue = 'asr:getServerModelDownloadFileSizeValue',
  ASR_GetServerModelDownloadFileSizeValueFormatted = 'asr:getServerModelDownloadFileSizeValueFormatted',
  ASR_GetServerModelDownloadFileSizeValueUnit = 'asr:getServerModelDownloadFileSizeValueUnit',

  // MsTTS
  MsTTS_GetVoices = 'mstts:getVoices',
  MsTTS_Synthesize = 'mstts:synthesize',

  // CodeExecutor
  CodeExecutor_GetSupportedLanguages = 'codeExecutor:getSupportedLanguages',
  CodeExecutor_ExecuteJS = 'codeExecutor:executeJS',
  CodeExecutor_ExecutePython = 'codeExecutor:executePython',

  // PDF
  PDF_SplitPDF = 'pdf:splitPDF',
  PDF_GetPageCount = 'pdf:getPageCount',

  // Theme
  ThemeChange = 'theme:change',

  // Workspace
  Workspace_SelectFolder = 'workspace:selectFolder',
  Workspace_GetFiles = 'workspace:getFiles',
  Workspace_ReadFile = 'workspace:readFile',
  Workspace_GetFolderStructure = 'workspace:getFolderStructure',

  // Browser
  Browser_OpenNewWindow = 'browser:openNewWindow',
  Browser_SyncCookies = 'browser:syncCookies',

  // Module Manager
  Module_Download = 'module:download',
  Module_Delete = 'module:delete',
  Module_List = 'module:list',
  Module_Exists = 'module:exists'
}
