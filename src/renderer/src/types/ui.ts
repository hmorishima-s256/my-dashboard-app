import type {
  AppSettings,
  AuthLoginResult,
  AuthLogoutResult,
  CalendarTableRow,
  CalendarUpdatePayload,
  UserProfile
} from '@shared/contracts'

// shared の契約型を Renderer 側へ再公開する
export type {
  AppSettings,
  AuthLoginResult,
  AuthLogoutResult,
  CalendarTableRow,
  CalendarUpdatePayload,
  UserProfile
}

// Renderer 画面固有の UI 型
export type IntervalUnit = 'minutes' | 'hours'
export type DashboardTab = 'schedule' | 'task'

export type DateFieldErrors = {
  year: boolean
  month: boolean
  day: boolean
}
