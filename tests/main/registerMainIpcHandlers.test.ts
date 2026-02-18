import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings, AuthLogoutResult, UserProfile } from '../../src/shared/contracts'

const ipcHandlerState = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => Promise<any>>()
}))

const ipcHandleMock = vi.hoisted(() =>
  vi.fn((channel: string, handler: (...args: any[]) => Promise<any>) => {
    ipcHandlerState.handlers.set(channel, handler)
  })
)

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandleMock
  }
}))

import { registerMainIpcHandlers } from '../../src/main/ipc/registerMainIpcHandlers'

type DependencyBundle = {
  dependencies: Parameters<typeof registerMainIpcHandlers>[0]
  getCurrentUserState: () => UserProfile | null
}

const currentUserProfile: UserProfile = {
  name: 'Test User',
  email: 'test@example.com',
  iconUrl: ''
}

const createDependencies = (): DependencyBundle => {
  let currentUser: UserProfile | null = null
  const settings: AppSettings = { autoFetchTime: '09:00', autoFetchIntervalMinutes: 30 }

  const dependencies: Parameters<typeof registerMainIpcHandlers>[0] = {
    getCurrentUser: vi.fn(() => currentUser),
    setCurrentUser: vi.fn((user) => {
      currentUser = user
    }),
    getSettings: vi.fn(() => settings),
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
    buildDateKey: vi.fn(() => '2026-02-18')
  }

  return {
    dependencies,
    getCurrentUserState: () => currentUser
  }
}

const getRegisteredHandler = (channel: string): ((...args: any[]) => Promise<any>) => {
  const handler = ipcHandlerState.handlers.get(channel)
  if (!handler) {
    throw new Error(`Handler not found: ${channel}`)
  }
  return handler
}

describe('registerMainIpcHandlers', () => {
  beforeEach(() => {
    ipcHandlerState.handlers.clear()
    ipcHandleMock.mockClear()
  })

  it('想定した IPC チャネルを登録する', () => {
    const { dependencies } = createDependencies()
    registerMainIpcHandlers(dependencies)

    expect(ipcHandleMock).toHaveBeenCalledTimes(7)
    expect(Array.from(ipcHandlerState.handlers.keys()).sort()).toEqual([
      'auth:get-current-user',
      'auth:login',
      'auth:logout',
      'get-calendar',
      'get-default-profile-icon-url',
      'get-settings',
      'save-settings'
    ])
  })

  it('get-calendar は不正日付時に当日キーへフォールバックする', async () => {
    const { dependencies } = createDependencies()
    registerMainIpcHandlers(dependencies)
    const handler = getRegisteredHandler('get-calendar')

    await handler({}, 'invalid-date')
    expect(dependencies.buildDateKey).toHaveBeenCalled()
    expect(dependencies.fetchAndPublishByDate).toHaveBeenCalledWith('2026-02-18', 'manual')

    await handler({}, '2025-12-31')
    expect(dependencies.fetchAndPublishByDate).toHaveBeenCalledWith('2025-12-31', 'manual')
  })

  it('save-settings は保存後に自動取得状態を再初期化する', async () => {
    const { dependencies } = createDependencies()
    registerMainIpcHandlers(dependencies)
    const handler = getRegisteredHandler('save-settings')
    const nextSettings: AppSettings = { autoFetchTime: null, autoFetchIntervalMinutes: null }

    await expect(handler({}, nextSettings)).resolves.toEqual(nextSettings)
    expect(dependencies.saveSettingsForCurrentUser).toHaveBeenCalledWith(nextSettings)
    expect(dependencies.resetAutoFetchRunState).toHaveBeenCalledTimes(1)
    expect(dependencies.restartAutoFetchScheduler).toHaveBeenCalledTimes(1)
  })

  it('auth:login 成功時はユーザー状態更新と当日同期を実行する', async () => {
    const { dependencies, getCurrentUserState } = createDependencies()
    registerMainIpcHandlers(dependencies)
    const handler = getRegisteredHandler('auth:login')

    const result = await handler({})
    expect(result).toEqual({
      success: true,
      user: currentUserProfile,
      message: ''
    })
    expect(getCurrentUserState()).toEqual(currentUserProfile)
    expect(dependencies.setCurrentUser).toHaveBeenCalledWith(currentUserProfile)
    expect(dependencies.loadSettingsForCurrentUser).toHaveBeenCalledTimes(1)
    expect(dependencies.resetAutoFetchRunState).toHaveBeenCalledTimes(1)
    expect(dependencies.restartAutoFetchScheduler).toHaveBeenCalledTimes(1)
    expect(dependencies.ensureMainWindowVisible).toHaveBeenCalledTimes(1)
    expect(dependencies.fetchAndPublishByDate).toHaveBeenCalledWith('2026-02-18', 'manual')
  })

  it('auth:login 失敗時は success:false を返す', async () => {
    const { dependencies } = createDependencies()
    dependencies.loginWithGoogle = vi.fn(async () => {
      throw new Error('login failed')
    })
    registerMainIpcHandlers(dependencies)
    const handler = getRegisteredHandler('auth:login')

    await expect(handler({})).resolves.toEqual({
      success: false,
      user: null,
      message: 'login failed'
    })
  })

  it('auth:logout 成功時は状態をクリアして空配信する', async () => {
    const { dependencies, getCurrentUserState } = createDependencies()
    dependencies.setCurrentUser(currentUserProfile)
    registerMainIpcHandlers(dependencies)
    const handler = getRegisteredHandler('auth:logout')

    await expect(handler({})).resolves.toEqual({ success: true })
    expect(getCurrentUserState()).toBeNull()
    expect(dependencies.loadSettingsForCurrentUser).toHaveBeenCalledTimes(1)
    expect(dependencies.resetAutoFetchRunState).toHaveBeenCalledTimes(1)
    expect(dependencies.restartAutoFetchScheduler).toHaveBeenCalledTimes(1)
    expect(dependencies.publishEmptyManualUpdate).toHaveBeenCalledTimes(1)
  })

  it('auth:logout 失敗時は後続処理を実行しない', async () => {
    const { dependencies } = createDependencies()
    dependencies.logoutGoogle = vi.fn(async () => ({ success: false, message: 'logout failed' }))
    registerMainIpcHandlers(dependencies)
    const handler = getRegisteredHandler('auth:logout')

    await expect(handler({})).resolves.toEqual({ success: false, message: 'logout failed' })
    expect(dependencies.setCurrentUser).not.toHaveBeenCalled()
    expect(dependencies.loadSettingsForCurrentUser).not.toHaveBeenCalled()
    expect(dependencies.publishEmptyManualUpdate).not.toHaveBeenCalled()
  })
})
