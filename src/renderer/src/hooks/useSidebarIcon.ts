import { SidebarIcon } from '@renderer/store/settings'

import { useSettings } from './useSettings'

export function useSidebarIconShow(icon: SidebarIcon) {
  const { sidebarIcons } = useSettings()
  return sidebarIcons.visible.includes(icon)
}
