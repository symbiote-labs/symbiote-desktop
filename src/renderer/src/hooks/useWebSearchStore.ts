import { useAppSelector } from '@renderer/store'

export function useWebSearchStore() {
  const websearch = useAppSelector((state) => state.websearch)
  const providers = useAppSelector((state) => state.websearch.providers)
  const selectedProvider = useAppSelector((state) => state.websearch.defaultProvider)

  return {
    websearch,
    providers,
    selectedProvider
  }
}
