import { ipcMain } from 'electron'
import type { AppSettings } from '../../../shared/contracts'
import type { MainIpcHandlerDependencies } from './types'

// 設定関連 IPC を登録する
export const registerSettingsHandlers = (dependencies: MainIpcHandlerDependencies): void => {
  ipcMain.handle('get-settings', async () => dependencies.getSettings())

  ipcMain.handle('save-settings', async (_event, nextSettings: AppSettings) => {
    const saved = await dependencies.saveSettingsForCurrentUser(nextSettings)
    dependencies.resetAutoFetchRunState()
    dependencies.restartAutoFetchScheduler()
    return saved
  })

  ipcMain.handle('get-default-profile-icon-url', async () => await dependencies.getDefaultProfileIconUrl())
}
