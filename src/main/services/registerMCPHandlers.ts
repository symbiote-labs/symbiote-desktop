import { IpcChannel } from '@shared/IpcChannel'
import { ipcMain } from 'electron'

import mcpService from './MCPService'

/**
 * 注册MCP相关的IPC处理程序
 */
export function registerMCPHandlers(): void {
  // 注册MCP服务的IPC处理程序
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
  ipcMain.handle(IpcChannel.Mcp_RerunTool, mcpService.rerunTool)

  // 同时注册兼容旧版本的处理程序
  ipcMain.handle('mcp:restart-server', mcpService.restartServer)
  ipcMain.handle('mcp:remove-server', mcpService.removeServer)
  ipcMain.handle('mcp:stop-server', mcpService.stopServer)
  ipcMain.handle('mcp:list-tools', mcpService.listTools)
  ipcMain.handle('mcp:reset-tools-list', mcpService.resetToolsList)
  ipcMain.handle('mcp:call-tool', mcpService.callTool)
  ipcMain.handle('mcp:list-prompts', mcpService.listPrompts)
  ipcMain.handle('mcp:get-prompt', mcpService.getPrompt)
  ipcMain.handle('mcp:list-resources', mcpService.listResources)
  ipcMain.handle('mcp:get-resource', mcpService.getResource)
  ipcMain.handle('mcp:get-install-info', mcpService.getInstallInfo)
  ipcMain.handle('mcp:rerunTool', mcpService.rerunTool)
}
