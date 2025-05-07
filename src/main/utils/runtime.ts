import os from 'os'

export function isWindows7() {
  if (process.platform !== 'win32') return false
  const version = os.release()
  return version.startsWith('6.1') // Windows 7 的版本号为 6.1
}
