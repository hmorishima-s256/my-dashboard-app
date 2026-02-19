import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDependencies } from './handlerTestUtils'

type RegisteredHandler = (...args: unknown[]) => Promise<unknown>

const ipcHandlerState = vi.hoisted(() => ({
  handlers: new Map<string, RegisteredHandler>()
}))

const ipcHandleMock = vi.hoisted(() =>
  vi.fn((channel: string, handler: RegisteredHandler) => {
    ipcHandlerState.handlers.set(channel, handler)
  })
)

vi.mock('electron', () => ({
  ipcMain: {
    handle: ipcHandleMock
  }
}))

import { registerCalendarHandlers } from '../../../src/main/ipc/handlers/calendarHandlers'

const getRegisteredHandler = (channel: string): RegisteredHandler => {
  const handler = ipcHandlerState.handlers.get(channel)
  if (!handler) throw new Error(`Handler not found: ${channel}`)
  return handler
}

describe('calendarHandlers', () => {
  beforeEach(() => {
    ipcHandlerState.handlers.clear()
    ipcHandleMock.mockClear()
  })

  it('get-calendar を登録し、不正日付は当日キーへフォールバックする', async () => {
    const { dependencies } = createDependencies()
    registerCalendarHandlers(dependencies)

    expect(ipcHandleMock).toHaveBeenCalledTimes(1)
    const handler = getRegisteredHandler('get-calendar')

    await handler({}, 'invalid-date')
    expect(dependencies.buildDateKey).toHaveBeenCalledTimes(1)
    expect(dependencies.fetchAndPublishByDate).toHaveBeenCalledWith('2026-02-18', 'manual')

    await handler({}, '2026-02-17')
    expect(dependencies.fetchAndPublishByDate).toHaveBeenCalledWith('2026-02-17', 'manual')
  })
})
