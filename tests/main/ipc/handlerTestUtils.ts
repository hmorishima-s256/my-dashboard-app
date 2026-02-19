import { vi } from 'vitest'
import type { AuthLogoutResult, Task, TaskCreateInput, UserProfile } from '../../../src/shared/contracts'
import type { MainIpcHandlerDependencies } from '../../../src/main/ipc/handlers/types'

export type DependencyBundle = {
  dependencies: MainIpcHandlerDependencies
  getCurrentUserState: () => UserProfile | null
}

export const currentUserProfile: UserProfile = {
  name: 'Test User',
  email: 'test@example.com',
  iconUrl: ''
}

// IPC ハンドラ単体テストで使う依存モックを共通化する
export const createDependencies = (): DependencyBundle => {
  let currentUser: UserProfile | null = null

  const dependencies: MainIpcHandlerDependencies = {
    getCurrentUser: vi.fn(() => currentUser),
    setCurrentUser: vi.fn((user) => {
      currentUser = user
    }),
    getSettings: vi.fn(() => ({ autoFetchTime: '09:00', autoFetchIntervalMinutes: 30, taskTimeDisplayMode: 'hourMinute' })),
    loadSettingsForCurrentUser: vi.fn(async () => {}),
    saveSettingsForCurrentUser: vi.fn(async (nextSettings) => nextSettings),
    resetAutoFetchRunState: vi.fn(),
    restartAutoFetchScheduler: vi.fn(),
    getDefaultProfileIconUrl: vi.fn(async () => 'file:///dummy/icon.svg'),
    loginWithGoogle: vi.fn(async () => currentUserProfile),
    logoutGoogle: vi.fn(async (): Promise<AuthLogoutResult> => ({ success: true })),
    fetchAndPublishByDate: vi.fn(async () => []),
    publishEmptyManualUpdate: vi.fn(),
    ensureMainWindowVisible: vi.fn(),
    buildDateKey: vi.fn(() => '2026-02-18'),
    taskGetAll: vi.fn(async () => ({ tasks: [], projects: [], categories: [], projectCategories: {}, projectTitles: {} })),
    taskAdd: vi.fn(async (taskInput: TaskCreateInput): Promise<Task> => ({
      id: 'task-1',
      userId: currentUser?.email ?? 'guest',
      date: taskInput.date,
      project: taskInput.project,
      category: taskInput.category,
      title: taskInput.title,
      status: taskInput.status ?? 'todo',
      priority: taskInput.priority,
      memo: taskInput.memo,
      estimated: taskInput.estimated,
      actual: {
        minutes: taskInput.actual?.minutes ?? 0,
        suspendMinutes: taskInput.actual?.suspendMinutes ?? 0,
        suspendStartedAt: taskInput.actual?.suspendStartedAt ?? null,
        logs: taskInput.actual?.logs ?? []
      },
      createdAt: '2026-02-18T00:00:00.000Z',
      updatedAt: '2026-02-18T00:00:00.000Z'
    })),
    taskUpdate: vi.fn(async (task: Task) => task),
    taskDelete: vi.fn(async () => true)
  }

  return {
    dependencies,
    getCurrentUserState: () => currentUser
  }
}
