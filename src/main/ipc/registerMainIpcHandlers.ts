import { ipcMain } from 'electron'
import type {
  AppSettings,
  AuthLoginResult,
  AuthLogoutResult,
  CalendarTableRow,
  Task,
  TaskCreateInput,
  TaskListResponse,
  UserProfile
} from '../../shared/contracts'

type RegisterMainIpcHandlersDependencies = {
  getCurrentUser: () => UserProfile | null
  setCurrentUser: (user: UserProfile | null) => void
  getSettings: () => AppSettings
  loadSettingsForCurrentUser: () => Promise<void>
  saveSettingsForCurrentUser: (nextSettings: AppSettings) => Promise<AppSettings>
  resetAutoFetchRunState: () => void
  restartAutoFetchScheduler: () => void
  getDefaultProfileIconUrl: () => Promise<string>
  loginWithGoogle: () => Promise<UserProfile>
  logoutGoogle: () => Promise<AuthLogoutResult>
  fetchAndPublishByDate: (
    targetDate: string,
    source: 'manual' | 'auto'
  ) => Promise<CalendarTableRow[]>
  publishEmptyManualUpdate: () => void
  ensureMainWindowVisible: () => void
  buildDateKey: (date: Date) => string
  taskGetAll: (date: string) => Promise<TaskListResponse>
  taskAdd: (taskInput: TaskCreateInput) => Promise<Task>
  taskUpdate: (task: Task) => Promise<Task | null>
  taskDelete: (taskId: string) => Promise<boolean>
}

// IPC の入出力契約を1か所で登録する
export const registerMainIpcHandlers = (
  dependencies: RegisterMainIpcHandlersDependencies
): void => {
  ipcMain.handle('get-calendar', async (_event, targetDate?: string) => {
    const requestedDate =
      typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
        ? targetDate
        : dependencies.buildDateKey(new Date())
    return await dependencies.fetchAndPublishByDate(requestedDate, 'manual')
  })

  ipcMain.handle('get-settings', async () => dependencies.getSettings())

  ipcMain.handle('save-settings', async (_event, nextSettings: AppSettings) => {
    const saved = await dependencies.saveSettingsForCurrentUser(nextSettings)
    dependencies.resetAutoFetchRunState()
    dependencies.restartAutoFetchScheduler()
    return saved
  })

  ipcMain.handle('get-default-profile-icon-url', async () => await dependencies.getDefaultProfileIconUrl())

  ipcMain.handle('task:get-all', async (_event, _userId: string | undefined, targetDate?: string) => {
    const requestedDate =
      typeof targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
        ? targetDate
        : dependencies.buildDateKey(new Date())
    return await dependencies.taskGetAll(requestedDate)
  })

  ipcMain.handle('task:add', async (_event, taskInput: TaskCreateInput) => {
    return await dependencies.taskAdd(taskInput)
  })

  ipcMain.handle('task:update', async (_event, task: Task) => {
    return await dependencies.taskUpdate(task)
  })

  ipcMain.handle('task:delete', async (_event, taskId: string) => {
    return await dependencies.taskDelete(taskId)
  })

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
