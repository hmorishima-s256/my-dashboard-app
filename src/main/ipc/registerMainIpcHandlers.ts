import { registerAuthHandlers } from './handlers/authHandlers'
import { registerCalendarHandlers } from './handlers/calendarHandlers'
import { registerSettingsHandlers } from './handlers/settingsHandlers'
import { registerTaskHandlers } from './handlers/taskHandlers'
import type { MainIpcHandlerDependencies } from './handlers/types'

// IPC の入出力契約を1か所で登録する
export const registerMainIpcHandlers = (dependencies: MainIpcHandlerDependencies): void => {
  // 機能単位で小さな登録関数へ分割し、合成だけを担当させる
  registerCalendarHandlers(dependencies)
  registerSettingsHandlers(dependencies)
  registerTaskHandlers(dependencies)
  registerAuthHandlers(dependencies)
}
