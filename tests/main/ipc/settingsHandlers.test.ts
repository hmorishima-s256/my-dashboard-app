import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '../../../src/shared/contracts'
import { createDependencies } from './handlerTestUtils'

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

import { registerSettingsHandlers } from '../../../src/main/ipc/handlers/settingsHandlers'

const getRegisteredHandler = (channel: string): ((...args: any[]) => Promise<any>) => {
  const handler = ipcHandlerState.handlers.get(channel)
  if (!handler) throw new Error(`Handler not found: ${channel}`)
  return handler
}

describe('settingsHandlers', () => {
  beforeEach(() => {
    ipcHandlerState.handlers.clear()
    ipcHandleMock.mockClear()
  })

  it('get-settings を登録して現在設定を返す', async () => {
    const { dependencies } = createDependencies()
    registerSettingsHandlers(dependencies)

    const handler = getRegisteredHandler('get-settings')
    await expect(handler({})).resolves.toEqual({
      autoFetchTime: '09:00',
      autoFetchIntervalMinutes: 30,
      taskTimeDisplayMode: 'hourMinute'
    })
  })

  it('save-settings は保存後に自動取得状態を再初期化する', async () => {
    const { dependencies } = createDependencies()
    registerSettingsHandlers(dependencies)

    const handler = getRegisteredHandler('save-settings')
    const nextSettings: AppSettings = {
      autoFetchTime: null,
      autoFetchIntervalMinutes: null,
      taskTimeDisplayMode: 'decimal'
    }

    await expect(handler({}, nextSettings)).resolves.toEqual(nextSettings)
    expect(dependencies.saveSettingsForCurrentUser).toHaveBeenCalledWith(nextSettings)
    expect(dependencies.resetAutoFetchRunState).toHaveBeenCalledTimes(1)
    expect(dependencies.restartAutoFetchScheduler).toHaveBeenCalledTimes(1)
  })

  it('get-default-profile-icon-url を登録して委譲する', async () => {
    const { dependencies } = createDependencies()
    registerSettingsHandlers(dependencies)
    const handler = getRegisteredHandler('get-default-profile-icon-url')

    await expect(handler({})).resolves.toBe('file:///dummy/icon.svg')
    expect(dependencies.getDefaultProfileIconUrl).toHaveBeenCalledTimes(1)
  })
})
