import { ipcMain } from 'electron'
import type { Task, TaskCreateInput } from '../../../shared/contracts'
import type { MainIpcHandlerDependencies } from './types'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// タスク関連 IPC を登録する
export const registerTaskHandlers = (dependencies: MainIpcHandlerDependencies): void => {
  ipcMain.handle('task:get-all', async (_event, _userId: string | undefined, targetDate?: string) => {
    const requestedDate =
      typeof targetDate === 'string' && DATE_PATTERN.test(targetDate)
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
}
