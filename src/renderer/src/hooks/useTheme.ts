import { RootState } from '@renderer/store'
import { useSelector } from 'react-redux'

export const useTheme = () => {
  const theme = useSelector((state: RootState) => state.settings.theme)
  const isDark = theme === 'dark'

  return { theme, isDark }
}
