import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDependencies, currentUserProfile } from './handlerTestUtils'

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

import { registerAuthHandlers } from '../../../src/main/ipc/handlers/authHandlers'

const getRegisteredHandler = (channel: string): ((...args: any[]) => Promise<any>) => {
  const handler = ipcHandlerState.handlers.get(channel)
  if (!handler) throw new Error(`Handler not found: ${channel}`)
  return handler
}

describe('authHandlers', () => {
  beforeEach(() => {
    ipcHandlerState.handlers.clear()
    ipcHandleMock.mockClear()
  })

  it('auth:login 成功時は状態更新と当日同期を実行する', async () => {
    const { dependencies, getCurrentUserState } = createDependencies()
    registerAuthHandlers(dependencies)
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
    registerAuthHandlers(dependencies)
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
    registerAuthHandlers(dependencies)
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
    registerAuthHandlers(dependencies)
    const handler = getRegisteredHandler('auth:logout')

    await expect(handler({})).resolves.toEqual({ success: false, message: 'logout failed' })
    expect(dependencies.setCurrentUser).not.toHaveBeenCalled()
    expect(dependencies.loadSettingsForCurrentUser).not.toHaveBeenCalled()
    expect(dependencies.publishEmptyManualUpdate).not.toHaveBeenCalled()
  })
})
