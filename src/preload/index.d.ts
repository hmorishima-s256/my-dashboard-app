import { ElectronAPI } from '@electron-toolkit/preload'

// Renderer テーブル表示で使う1行分の型
type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getCalendar: () => Promise<CalendarTableRow[]>
    }
  }
}
