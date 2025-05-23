import store, { useAppSelector } from '@renderer/store'
import { setVertexAILocation, setVertexAIMode, setVertexAIProjectId } from '@renderer/store/llm'
import { VertexAIMode } from '@renderer/types'
import { useDispatch } from 'react-redux'

export function useVertexAISettings() {
  const settings = useAppSelector((state) => state.llm.settings.vertexai)
  const dispatch = useDispatch()

  return {
    ...settings,
    setProjectId: (projectId: string) => dispatch(setVertexAIProjectId(projectId)),
    setLocation: (location: string) => dispatch(setVertexAILocation(location)),
    setMode: (mode: VertexAIMode) => dispatch(setVertexAIMode(mode))
  }
}

export function getVertexAISettings() {
  return store.getState().llm.settings.vertexai
}
