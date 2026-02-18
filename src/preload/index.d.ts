import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  AppSettings,
  AuthLoginResult,
  AuthLogoutResult,
  CalendarTableRow,
  CalendarUpdatePayload,
  UserProfile
} from '../shared/contracts'

// Renderer 側の window 拡張定義
declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // 旧実装: 引数なしで当日予定を取得
      // getCalendar: () => Promise<CalendarTableRow[]>
      // 指定日（yyyy-mm-dd）の予定を取得
      getCalendar: (targetDate?: string) => Promise<CalendarTableRow[]>
      getSettings: () => Promise<AppSettings>
      saveSettings: (settings: AppSettings) => Promise<AppSettings>
      getDefaultProfileIconUrl: () => Promise<string>
      authLogin: () => Promise<AuthLoginResult>
      authLogout: () => Promise<AuthLogoutResult>
      authGetCurrentUser: () => Promise<UserProfile | null>
      onCalendarUpdated: (callback: (payload: CalendarUpdatePayload) => void) => () => void
    }
  }
}
