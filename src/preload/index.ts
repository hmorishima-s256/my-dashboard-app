import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

type AppSettings = {
  autoFetchTime: string | null
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
  getCalendar: () => ipcRenderer.invoke('get-calendar'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: AppSettings) => ipcRenderer.invoke('save-settings', settings),
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
