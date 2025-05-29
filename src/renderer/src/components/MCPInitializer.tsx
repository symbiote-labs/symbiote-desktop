import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@renderer/store'
import { builtinMCPServers, addMCPServer } from '@renderer/store/mcp'
import { nanoid } from '@reduxjs/toolkit'
import Logger from '@renderer/config/logger'

export const MCPInitializer: React.FC = () => {
  const dispatch = useAppDispatch()
  const existingServers = useAppSelector((state) => state.mcp.servers)

  useEffect(() => {
    // Check if Symbiote servers are present, add them if missing
    const serverNames = existingServers.map((server) => server.name)

    // Check for each Symbiote server
    const symbioteServers = ['blender-mcp', 'symbiote-unreal-mcp', 'symbiote-mcp']

    symbioteServers.forEach((serverName) => {
      if (!serverNames.includes(serverName)) {
        const builtinServer = builtinMCPServers.find((server) => server.name === serverName)
        if (builtinServer) {
          Logger.log(`[MCPInitializer] Adding missing server: ${serverName}`)
          dispatch(addMCPServer({ ...builtinServer, id: nanoid() }))
        }
      }
    })
  }, [dispatch, existingServers])

  return null
}