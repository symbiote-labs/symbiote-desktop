import { useSelector } from 'react-redux'
import { RootState } from '@renderer/store'

export const useTheme = () => {
  const theme = useSelector((state: RootState) => state.settings.theme)
  const isDark = theme === 'dark'
  
  return { theme, isDark }
}
