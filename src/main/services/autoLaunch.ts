import { app } from 'electron'
import { join } from 'path'
import fs from 'fs/promises'

type ApplyAutoLaunchDependencies = {
  markerDirectoryPath: string
  markerFileName: string
  hiddenLaunchArg: string
}

// Windows パッケージ版のみ、初回1回の自動起動設定を行う
export const applyWindowsAutoLaunchSetting = async (
  dependencies: ApplyAutoLaunchDependencies
): Promise<void> => {
  if (process.platform !== 'win32') return
  if (!app.isPackaged) return

  const markerPath = join(dependencies.markerDirectoryPath, dependencies.markerFileName)
  try {
    await fs.access(markerPath)
    return
  } catch {
    // 初回のみ設定を入れるため、マーカーファイル未存在時のみ続行
  }

  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: [dependencies.hiddenLaunchArg]
  })

  await fs.mkdir(dependencies.markerDirectoryPath, { recursive: true })
  await fs.writeFile(markerPath, new Date().toISOString(), 'utf-8')
}
