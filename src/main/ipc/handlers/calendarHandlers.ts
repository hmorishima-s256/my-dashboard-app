import { ipcMain } from 'electron'
import type { MainIpcHandlerDependencies } from './types'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

// カレンダー関連 IPC を登録する
export const registerCalendarHandlers = (dependencies: MainIpcHandlerDependencies): void => {
  ipcMain.handle('get-calendar', async (_event, targetDate?: string) => {
    const requestedDate =
      typeof targetDate === 'string' && DATE_PATTERN.test(targetDate)
        ? targetDate
        : dependencies.buildDateKey(new Date())
    return await dependencies.fetchAndPublishByDate(requestedDate, 'manual')
  })
}
