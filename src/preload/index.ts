import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

type AppSettings = {
  autoFetchTime: string | null
  autoFetchIntervalMinutes: number | null
}

type UserProfile = {
  name: string
  email: string
  iconUrl: string
}

type AuthLoginResult = {
  success: boolean
  user: UserProfile | null
  message: string
}

type AuthLogoutResult = {
  success: boolean
  message?: string
}

type CalendarUpdatePayload = {
  events: CalendarTableRow[]
  updatedAt: string
  source: 'manual' | 'auto'
}

// Custom APIs for renderer
// const api = {
//   getCalendar: () => ipcRenderer.invoke('get-calendar')
// }
const api = {
  getCalendar: (targetDate?: string) => ipcRenderer.invoke('get-calendar', targetDate),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),
  getDefaultProfileIconUrl: () => ipcRenderer.invoke('get-default-profile-icon-url') as Promise<string>,
  authLogin: () => ipcRenderer.invoke('auth:login') as Promise<AuthLoginResult>,
  authLogout: () => ipcRenderer.invoke('auth:logout') as Promise<AuthLogoutResult>,
  authGetCurrentUser: () => ipcRenderer.invoke('auth:get-current-user') as Promise<UserProfile | null>,
  onCalendarUpdated: (callback: (payload: CalendarUpdatePayload) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: CalendarUpdatePayload): void => {
      callback(payload)
    }
    ipcRenderer.on('calendar-updated', listener)
    return () => {
      ipcRenderer.removeListener('calendar-updated', listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
