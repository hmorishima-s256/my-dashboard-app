// Main / Preload / Renderer 間で共有する契約型

export type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

export type AppSettings = {
  autoFetchTime: string | null
  autoFetchIntervalMinutes: number | null
}

export type UserProfile = {
  name: string
  email: string
  iconUrl: string
}

export type AuthLoginResult = {
  success: boolean
  user: UserProfile | null
  message: string
}

export type AuthLogoutResult = {
  success: boolean
  message?: string
}

export type CalendarUpdatePayload = {
  events: CalendarTableRow[]
  updatedAt: string
  source: 'manual' | 'auto'
}
