import { nanoid } from '@reduxjs/toolkit'
import Logger from '@renderer/config/logger'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { addMCPServer, builtinMCPServers, updateMCPServer } from '@renderer/store/mcp'
import { useEffect } from 'react'

export const MCPInitializer: React.FC = () => {
  const dispatch = useAppDispatch()
  const existingServers = useAppSelector((state) => state.mcp.servers)

  useEffect(() => {
    // Create a map of existing servers by name for quick lookup
    const existingServerMap = new Map(existingServers.map((server) => [server.name, server]))

    builtinMCPServers.forEach((builtinServer) => {
      const existingServer = existingServerMap.get(builtinServer.name)

      if (!existingServer) {
        // Add missing server
        Logger.log(`[MCPInitializer] Adding missing built-in server: ${builtinServer.name}`)
        dispatch(addMCPServer({ ...builtinServer, id: nanoid() }))
      } else if (
        existingServer.description !== builtinServer.description ||
        existingServer.provider !== builtinServer.provider
      ) {
        // Update existing server with new description/provider but preserve user settings
        Logger.log(`[MCPInitializer] Updating server description: ${builtinServer.name}`)
        dispatch(
          updateMCPServer({
            ...existingServer,
            description: builtinServer.description,
            provider: builtinServer.provider,
            // Only update env if the existing env is empty or has placeholder values
            env:
              existingServer.env &&
              Object.values(existingServer.env).some((val) => typeof val === 'string' && !val.startsWith('YOUR_'))
                ? existingServer.env
                : builtinServer.env
          })
        )
      }
    })
  }, [dispatch, existingServers])

  return null
}
