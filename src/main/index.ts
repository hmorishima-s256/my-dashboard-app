import { app, shell, BrowserWindow, ipcMain, Menu, Tray, nativeImage, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs/promises'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { getTodayEvents, type CalendarTableRow } from './googleAuth'
import { loadAppSettings, saveAppSettings, type AppSettings } from './appSettings'

// Renderer へ配信する更新通知の型
type CalendarUpdatePayload = {
  events: CalendarTableRow[]
  updatedAt: string
  source: 'manual' | 'auto'
}

const START_HIDDEN_ARG = '--hidden'
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let schedulerTimer: NodeJS.Timeout | null = null
let settings: AppSettings = { autoFetchTime: null }
let lastAutoFetchDateKey: string | null = null
let shouldStartHidden = process.argv.includes(START_HIDDEN_ARG)
const AUTO_LAUNCH_MARKER_FILE = 'auto-launch-initialized'

// 日付・時刻比較用の補助関数
const pad2 = (value: number): string => String(value).padStart(2, '0')
const buildDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
const buildTimeKey = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`

// 終了処理を一本化し、常駐せず確実にアプリを終了する
const quitApplication = (): void => {
  isQuitting = true
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
  }
  if (tray) {
    tray.destroy()
    tray = null
  }
  // app.quit()
  app.exit(0)
}

// 当日予定を取得し、Renderer に更新通知を送る共通処理
const fetchAndNotifyTodayEvents = async (
  source: 'manual' | 'auto'
): Promise<CalendarTableRow[]> => {
  try {
    const events = await getTodayEvents()
    const payload: CalendarUpdatePayload = {
      events,
      updatedAt: new Date().toISOString(),
      source
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('calendar-updated', payload)
    }

    return events
  } catch (error) {
    console.error('Google Calendar Error:', error)
    return []
  }
}

// 自動取得時刻に到達したかを判定し、1日1回だけ実行する
const runAutoFetchIfNeeded = async (): Promise<void> => {
  if (!settings.autoFetchTime) return

  const now = new Date()
  if (buildTimeKey(now) !== settings.autoFetchTime) return

  const todayKey = buildDateKey(now)
  if (lastAutoFetchDateKey === todayKey) return

  await fetchAndNotifyTodayEvents('auto')
  lastAutoFetchDateKey = todayKey
}

// 自動取得スケジューラを開始/再開始する
const startAutoFetchScheduler = (): void => {
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
  }

  schedulerTimer = setInterval(() => {
    void runAutoFetchIfNeeded()
  }, 30 * 1000)

  void runAutoFetchIfNeeded()
}

// Windows のパッケージ版でログイン時自動起動を初回1回だけ有効化する
// const applyWindowsAutoLaunchSetting = (): void => {
const applyWindowsAutoLaunchSetting = async (): Promise<void> => {
  if (process.platform !== 'win32') return
  if (!app.isPackaged) return

  const markerPath = join(app.getPath('userData'), AUTO_LAUNCH_MARKER_FILE)
  try {
    await fs.access(markerPath)
    return
  } catch {
    // 初回のみ設定を入れるため、マーカーファイル未存在時のみ続行
  }

  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
    args: [START_HIDDEN_ARG]
  })

  await fs.writeFile(markerPath, new Date().toISOString(), 'utf-8')
}

// バックグラウンド常駐用のトレイを作成する
const createTray = (): void => {
  if (tray) return

  // const trayImage = nativeImage.createFromPath(icon)
  const trayImage = nativeImage.createFromPath(icon)
  tray = trayImage.isEmpty() ? new Tray(icon) : new Tray(trayImage)
  tray.setToolTip('My Dashboard')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: '表示',
        click: () => {
          if (!mainWindow || mainWindow.isDestroyed()) {
            mainWindow = createWindow()
            return
          }
          mainWindow.show()
          mainWindow.focus()
        }
      },
      {
        type: 'separator'
      },
      {
        label: '終了',
        click: () => {
          // isQuitting = true
          // app.quit()
          quitApplication()
        }
      }
    ])
  )

  tray.on('double-click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createWindow()
      return
    }
    mainWindow.show()
    mainWindow.focus()
  })
}

// function createWindow(): void {
function createWindow(): BrowserWindow {
  // Create the browser window.
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
    // mainWindow.show()
    if (shouldStartHidden) {
      shouldStartHidden = false
      return
    }
    window.show()
  })

  // ウィンドウを閉じても終了せず、トレイに格納して常駐させる
  window.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()

    // 閉じる時にバックグラウンド常駐するかを選択させる
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

    // const shouldKeepInBackground = true
    const shouldKeepInBackground = selectedButtonIndex === 0
    if (shouldKeepInBackground) {
      window.hide()
      return
    }

    // isQuitting = true
    // app.quit()
    quitApplication()
  })

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')
  settings = await loadAppSettings()
  // applyWindowsAutoLaunchSetting()
  await applyWindowsAutoLaunchSetting()
  createTray()
  startAutoFetchScheduler()

  ipcMain.handle('get-calendar', async () => {
    // const events = await getTodayEvents()
    const events = await fetchAndNotifyTodayEvents('manual')
    return events
  })

  // Renderer から自動取得時刻設定を読み書きするための IPC
  ipcMain.handle('get-settings', async () => settings)
  ipcMain.handle('save-settings', async (_event, nextSettings: AppSettings) => {
    settings = await saveAppSettings(nextSettings)
    // 設定変更時は当日実行フラグをリセットし、次回判定を有効にする
    lastAutoFetchDateKey = null
    startAutoFetchScheduler()
    return settings
  })

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // createWindow()
  mainWindow = createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
      return
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
})

app.on('before-quit', () => {
  isQuitting = true
  if (schedulerTimer) {
    clearInterval(schedulerTimer)
  }
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  // if (process.platform !== 'darwin') {
  //   app.quit()
  // }
  // バックグラウンド常駐のため、全ウィンドウを閉じても終了しない
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
