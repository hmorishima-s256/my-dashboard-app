import { ipcMain } from 'electron'
import type { AuthLoginResult, AuthLogoutResult } from '../../../shared/contracts'
import type { MainIpcHandlerDependencies } from './types'

// 認証関連 IPC を登録する
export const registerAuthHandlers = (dependencies: MainIpcHandlerDependencies): void => {
  ipcMain.handle('auth:get-current-user', async () => dependencies.getCurrentUser())

  ipcMain.handle('auth:login', async (): Promise<AuthLoginResult> => {
    try {
      const profile = await dependencies.loginWithGoogle()
      dependencies.setCurrentUser(profile)
      await dependencies.loadSettingsForCurrentUser()
      dependencies.resetAutoFetchRunState()
      dependencies.restartAutoFetchScheduler()
      dependencies.ensureMainWindowVisible()
      await dependencies.fetchAndPublishByDate(dependencies.buildDateKey(new Date()), 'manual')
      return { success: true, user: dependencies.getCurrentUser(), message: '' }
    } catch (error) {
      return {
        success: false,
        user: null,
        message: error instanceof Error ? error.message : 'Google login failed'
      }
    }
  })

  ipcMain.handle('auth:logout', async (): Promise<AuthLogoutResult> => {
    const result = await dependencies.logoutGoogle()
    if (!result.success) {
      return result
    }

    dependencies.setCurrentUser(null)
    await dependencies.loadSettingsForCurrentUser()
    dependencies.resetAutoFetchRunState()
    dependencies.restartAutoFetchScheduler()
    dependencies.publishEmptyManualUpdate()
    return result
  })
}
