import { app } from 'electron'

import { getDataPath } from './utils'
import { isWindows7 } from './utils/runtime'

const isDev = process.env.NODE_ENV === 'development'

if (isDev) {
  app.setPath('userData', app.getPath('userData') + 'Dev')
}

export const DATA_PATH = getDataPath()

export const titleBarOverlayDark = {
  height: 40,
  color: isWindows7() ? '#1c1c1c' : 'rgba(0,0,0,0)',
  symbolColor: '#ffffff'
}

export const titleBarOverlayLight = {
  height: 40,
  color: isWindows7() ? '#f4f4f4' : 'rgba(255,255,255,0)',
  symbolColor: '#000000'
}
