import type {
  AppSettings,
  AuthLoginResult,
  AuthLogoutResult,
  CalendarTableRow,
  CalendarUpdatePayload,
  ProjectMonthlyActual,
  Task,
  TaskCreateInput,
  TaskListResponse,
  TaskMonthlyProjectActualsResponse,
  TaskTimeDisplayMode,
  TaskPriority,
  TaskStatus,
  UserProfile
} from '@shared/contracts'
import { GUEST_USER_ID } from '@shared/contracts'

// shared の契約型を Renderer 側へ再公開する
export type {
  AppSettings,
  AuthLoginResult,
  AuthLogoutResult,
  CalendarTableRow,
  CalendarUpdatePayload,
  ProjectMonthlyActual,
  Task,
  TaskCreateInput,
  TaskListResponse,
  TaskMonthlyProjectActualsResponse,
  TaskTimeDisplayMode,
  TaskPriority,
  TaskStatus,
  UserProfile
}

// Renderer 画面固有の UI 型
export type IntervalUnit = 'minutes' | 'hours'
export type DashboardTab = 'schedule' | 'task'
export { GUEST_USER_ID }

export type DateFieldErrors = {
  year: boolean
  month: boolean
  day: boolean
}
