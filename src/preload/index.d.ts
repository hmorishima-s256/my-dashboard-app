import { ElectronAPI } from '@electron-toolkit/preload'

// Renderer テーブル表示で使う1行分の型
type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

// 設定モーダルで保持する設定値の型
type AppSettings = {
  autoFetchTime: string | null
  autoFetchIntervalMinutes: number | null
}

// 認証済みユーザー情報の型
type UserProfile = {
  name: string
  email: string
  iconUrl: string
}

// ログイン実行結果の型
type AuthLoginResult = {
  success: boolean
  user: UserProfile | null
  message: string
}

// ログアウト実行結果の型
type AuthLogoutResult = {
  success: boolean
  message?: string
}

// Main から配信されるカレンダー更新イベントの型
type CalendarUpdatePayload = {
  events: CalendarTableRow[]
  updatedAt: string
  source: 'manual' | 'auto'
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // getCalendar: () => Promise<CalendarTableRow[]>
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
