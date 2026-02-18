import { app, shell, BrowserWindow, Menu, Tray, nativeImage, dialog, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import type { AppSettings, UserProfile } from '../shared/contracts'
import {
  APP_SHARED_CONFIG_DIR,
  ensureSharedFiles,
  getDefaultProfileIconUrl,
  getEventsByDate,
  loginWithGoogle,
  logoutGoogle,
  getSavedUserProfile
} from './googleAuth'
import { loadAppSettings, saveAppSettings } from './appSettings'
import { createCalendarPublisher } from './services/calendarPublisher'
import { createAutoFetchScheduler } from './services/autoFetchScheduler'
import { applyWindowsAutoLaunchSetting } from './services/autoLaunch'
import { createTaskStoreService } from './services/taskStore'
import { registerMainIpcHandlers } from './ipc/registerMainIpcHandlers'

const START_HIDDEN_ARG = '--hidden'
const AUTO_LAUNCH_MARKER_FILE = 'auto-launch-initialized'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let shouldStartHidden = process.argv.includes(START_HIDDEN_ARG)
let currentUser: UserProfile | null = null
let settings: AppSettings = { autoFetchTime: null, autoFetchIntervalMinutes: null, taskTimeDisplayMode: 'hourMinute' }
let lastAutoFetchDateKey: string | null = null
let lastIntervalFetchAtMs: number | null = null

const pad2 = (value: number): string => String(value).padStart(2, '0')
const buildDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const calendarPublisher = createCalendarPublisher({
  getCurrentUser: () => currentUser,
  getMainWindow: () => mainWindow,
  getEventsByDate
})

const autoFetchScheduler = createAutoFetchScheduler({
  getCurrentUser: () => currentUser,
  getSettings: () => settings,
  getLastAutoFetchDateKey: () => lastAutoFetchDateKey,
  setLastAutoFetchDateKey: (value) => {
    lastAutoFetchDateKey = value
  },
  getLastIntervalFetchAtMs: () => lastIntervalFetchAtMs,
  setLastIntervalFetchAtMs: (value) => {
    lastIntervalFetchAtMs = value
  },
  fetchByDate: async (targetDate, source) => {
    await calendarPublisher.fetchAndPublishByDate(targetDate, source)
  }
})

const taskStoreService = createTaskStoreService({
  getCurrentUser: () => currentUser
})

const quitApplication = (): void => {
  isQuitting = true
  autoFetchScheduler.stop()
  void taskStoreService.clearGuestData()
  if (tray) {
    tray.destroy()
    tray = null
  }
  app.exit(0)
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    if (shouldStartHidden) {
      shouldStartHidden = false
      return
    }
    window.show()
  })

  window.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()

    const selectedButtonIndex = dialog.showMessageBoxSync(window, {
      type: 'question',
      buttons: ['バックグラウンド常駐', '終了'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
      title: 'My Dashboard',
      message: 'アプリを閉じます。バックグラウンドで常駐しますか？',
      detail: '「バックグラウンド常駐」を選ぶとトレイに格納されます。'
    })

    const shouldKeepInBackground = selectedButtonIndex === 0
    if (shouldKeepInBackground) {
      window.hide()
      return
    }

    quitApplication()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

const ensureMainWindowVisible = (): void => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    mainWindow = createWindow()
  }
  mainWindow.show()
  mainWindow.focus()
}

const createTray = (): void => {
  if (tray) return

  const trayImage = nativeImage.createFromPath(icon)
  tray = trayImage.isEmpty() ? new Tray(icon) : new Tray(trayImage)
  tray.setToolTip('My Dashboard')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '表示',
        click: () => {
          ensureMainWindowVisible()
        }
      },
      {
        type: 'separator'
      },
      {
        label: '終了',
        click: () => {
          quitApplication()
        }
      }
    ])
  )

  tray.on('double-click', () => {
    ensureMainWindowVisible()
  })
}

const loadSettingsForCurrentUser = async (): Promise<void> => {
  settings = await loadAppSettings(currentUser)
}

const saveSettingsForCurrentUser = async (nextSettings: AppSettings): Promise<AppSettings> => {
  settings = await saveAppSettings(currentUser, nextSettings)
  return settings
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.electron')
  await ensureSharedFiles()
  currentUser = await getSavedUserProfile()
  await loadSettingsForCurrentUser()

  await applyWindowsAutoLaunchSetting({
    markerDirectoryPath: APP_SHARED_CONFIG_DIR,
    markerFileName: AUTO_LAUNCH_MARKER_FILE,
    hiddenLaunchArg: START_HIDDEN_ARG
  })

  createTray()
  autoFetchScheduler.start()

  registerMainIpcHandlers({
    getCurrentUser: () => currentUser,
    setCurrentUser: (user) => {
      currentUser = user
    },
    getSettings: () => settings,
    loadSettingsForCurrentUser,
    saveSettingsForCurrentUser,
    resetAutoFetchRunState: autoFetchScheduler.resetRunState,
    restartAutoFetchScheduler: autoFetchScheduler.start,
    getDefaultProfileIconUrl,
    loginWithGoogle,
    logoutGoogle,
    fetchAndPublishByDate: calendarPublisher.fetchAndPublishByDate,
    publishEmptyManualUpdate: calendarPublisher.publishEmptyManualUpdate,
    ensureMainWindowVisible,
    buildDateKey,
    taskGetAll: taskStoreService.getAll,
    taskAdd: taskStoreService.add,
    taskUpdate: taskStoreService.update,
    taskDelete: taskStoreService.remove
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))
  mainWindow = createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      return
    }
    ensureMainWindowVisible()
  })
})

app.on('before-quit', () => {
  isQuitting = true
  autoFetchScheduler.stop()
  void taskStoreService.clearGuestData()
})

app.on('window-all-closed', () => {
  // バックグラウンド常駐のため、全ウィンドウを閉じても終了しない
})
