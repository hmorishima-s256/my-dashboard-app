import type {
  AppSettings,
  AuthLogoutResult,
  CalendarTableRow,
  Task,
  TaskCreateInput,
  TaskListResponse,
  UserProfile
} from '../../../shared/contracts'

// IPC ハンドラ登録で利用する依存関係の契約
export type MainIpcHandlerDependencies = {
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
