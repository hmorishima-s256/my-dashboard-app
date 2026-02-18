import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  AppSettings,
  AuthLoginResult,
  AuthLogoutResult,
  CalendarUpdatePayload,
  UserProfile
} from '../shared/contracts'

// Renderer へ公開する IPC API
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

// contextIsolation 有効時は contextBridge 経由で安全に公開する
// 無効時は従来どおり window へ直接公開する
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore（型定義は index.d.ts 側で宣言）
  window.electron = electronAPI
  // @ts-ignore（型定義は index.d.ts 側で宣言）
  window.api = api
}
