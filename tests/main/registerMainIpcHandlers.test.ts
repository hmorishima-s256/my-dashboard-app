import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDependencies } from './ipc/handlerTestUtils'

const registerCalendarHandlersMock = vi.hoisted(() => vi.fn())
const registerSettingsHandlersMock = vi.hoisted(() => vi.fn())
const registerTaskHandlersMock = vi.hoisted(() => vi.fn())
const registerAuthHandlersMock = vi.hoisted(() => vi.fn())

vi.mock('../../src/main/ipc/handlers/calendarHandlers', () => ({
  registerCalendarHandlers: registerCalendarHandlersMock
}))
vi.mock('../../src/main/ipc/handlers/settingsHandlers', () => ({
  registerSettingsHandlers: registerSettingsHandlersMock
}))
vi.mock('../../src/main/ipc/handlers/taskHandlers', () => ({
  registerTaskHandlers: registerTaskHandlersMock
}))
vi.mock('../../src/main/ipc/handlers/authHandlers', () => ({
  registerAuthHandlers: registerAuthHandlersMock
}))

import { registerMainIpcHandlers } from '../../src/main/ipc/registerMainIpcHandlers'

describe('registerMainIpcHandlers', () => {
  beforeEach(() => {
    registerCalendarHandlersMock.mockClear()
    registerSettingsHandlersMock.mockClear()
    registerTaskHandlersMock.mockClear()
    registerAuthHandlersMock.mockClear()
  })

  it('機能別の登録関数へ依存を委譲する', () => {
    const { dependencies } = createDependencies()
    registerMainIpcHandlers(dependencies)

    expect(registerCalendarHandlersMock).toHaveBeenCalledWith(dependencies)
    expect(registerSettingsHandlersMock).toHaveBeenCalledWith(dependencies)
    expect(registerTaskHandlersMock).toHaveBeenCalledWith(dependencies)
    expect(registerAuthHandlersMock).toHaveBeenCalledWith(dependencies)
  })
})
