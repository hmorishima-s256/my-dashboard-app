import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task, TaskCreateInput } from '../../../src/shared/contracts'
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

import { registerTaskHandlers } from '../../../src/main/ipc/handlers/taskHandlers'

const getRegisteredHandler = (channel: string): RegisteredHandler => {
  const handler = ipcHandlerState.handlers.get(channel)
  if (!handler) throw new Error(`Handler not found: ${channel}`)
  return handler
}

describe('taskHandlers', () => {
  beforeEach(() => {
    ipcHandlerState.handlers.clear()
    ipcHandleMock.mockClear()
  })

  it('task:get-all は不正日付時に当日キーへフォールバックする', async () => {
    const { dependencies } = createDependencies()
    registerTaskHandlers(dependencies)
    const handler = getRegisteredHandler('task:get-all')

    await handler({}, 'guest', 'invalid-date')
    expect(dependencies.taskGetAll).toHaveBeenCalledWith('2026-02-18')

    await handler({}, 'guest', '2026-02-17')
    expect(dependencies.taskGetAll).toHaveBeenCalledWith('2026-02-17')
  })

  it('task:add / task:update / task:delete を委譲する', async () => {
    const { dependencies } = createDependencies()
    registerTaskHandlers(dependencies)
    const addHandler = getRegisteredHandler('task:add')
    const updateHandler = getRegisteredHandler('task:update')
    const deleteHandler = getRegisteredHandler('task:delete')

    const taskInput: TaskCreateInput = {
      date: '2026-02-18',
      project: '案件A',
      category: '設計',
      title: '詳細設計',
      priority: '中',
      memo: '',
      estimated: {
        start: '09:00',
        end: '10:00',
        minutes: 60
      }
    }

    const addedTask = (await addHandler({}, taskInput)) as Task
    expect(dependencies.taskAdd).toHaveBeenCalledWith(taskInput)

    await updateHandler({}, addedTask)
    expect(dependencies.taskUpdate).toHaveBeenCalledWith(addedTask)

    await deleteHandler({}, addedTask.id)
    expect(dependencies.taskDelete).toHaveBeenCalledWith(addedTask.id)
  })
})
