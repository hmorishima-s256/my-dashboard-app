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
      getCalendar: () => Promise<CalendarTableRow[]>
      getSettings: () => Promise<AppSettings>
      saveSettings: (settings: AppSettings) => Promise<AppSettings>
      onCalendarUpdated: (callback: (payload: CalendarUpdatePayload) => void) => () => void
    }
  }
}
