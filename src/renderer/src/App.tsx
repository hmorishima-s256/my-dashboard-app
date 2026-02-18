import { useEffect, useRef, useState } from 'react'
import { DateSelector } from './components/DateSelector'
import { DashboardTabs } from './components/DashboardTabs'
import { LogoutConfirmModal } from './components/LogoutConfirmModal'
import { ProfileSection } from './components/ProfileSection'
import { ScheduleTable } from './components/ScheduleTable'
import { SettingsModal } from './components/SettingsModal'
import { TaskMockList } from './components/TaskMockList'
import { formatDateTime, formatInputDate } from './lib/dateUtils'
import { buildIntervalMinutes, parseIntervalForInput } from './lib/settingsUtils'
import { useDateEditor } from './hooks/useDateEditor'
import type {
  AppSettings,
  AuthLoginResult,
  AuthLogoutResult,
  CalendarTableRow,
  CalendarUpdatePayload,
  DashboardTab,
  IntervalUnit,
  UserProfile
} from './types/ui'

// ダッシュボード画面全体を構成するルートコンポーネント
function App(): React.JSX.Element {
  // 画面表示用の状態
  const [rows, setRows] = useState<CalendarTableRow[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [autoFetchTime, setAutoFetchTime] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [autoFetchIntervalValue, setAutoFetchIntervalValue] = useState('')
  const [autoFetchIntervalUnit, setAutoFetchIntervalUnit] = useState<IntervalUnit>('minutes')
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isAuthProcessing, setIsAuthProcessing] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>('schedule')

  const selectedDateRef = useRef<string>(formatInputDate(new Date()))
  const dateEditor = useDateEditor()

  useEffect(() => {
    selectedDateRef.current = dateEditor.selectedDate
  }, [dateEditor.selectedDate])

  const applyLoadedSettings = (loadedSettings: AppSettings): void => {
    setAutoFetchTime(loadedSettings.autoFetchTime ?? '')
    const parsedInterval = parseIntervalForInput(loadedSettings.autoFetchIntervalMinutes)
    setAutoFetchIntervalValue(parsedInterval.value)
    setAutoFetchIntervalUnit(parsedInterval.unit)
  }

  useEffect(() => {
    let isMounted = true
    // Main からの自動更新通知を受け取り、表示データへ反映する
    const unsubscribe = window.api.onCalendarUpdated((payload: CalendarUpdatePayload) => {
      if (!isMounted) return
      if (payload.source === 'auto' && selectedDateRef.current !== formatInputDate(new Date())) {
        return
      }
      setRows(payload.events)
      setLastUpdatedAt(new Date(payload.updatedAt))
    })

    const loadInitialState = async (): Promise<void> => {
      try {
        const [user, loadedSettings] = await Promise.all([
          window.api.authGetCurrentUser(),
          window.api.getSettings()
        ])
        if (!isMounted) return
        setCurrentUser(user)
        applyLoadedSettings(loadedSettings)
      } catch (error) {
        console.error('Failed to load initial state:', error)
      }
    }

    void loadInitialState()
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const handleGetSchedule = async (targetDate = dateEditor.selectedDate): Promise<void> => {
    if (!currentUser) return
    // 指定日の予定を取得してテーブルへ反映する
    const events = await window.api.getCalendar(targetDate)
    setRows(events)
    setLastUpdatedAt(new Date())
  }

  useEffect(() => {
    if (!currentUser) return
    void handleGetSchedule(dateEditor.selectedDate)
  }, [currentUser, dateEditor.selectedDate])

  const reloadSettings = async (): Promise<void> => {
    const loadedSettings = await window.api.getSettings()
    applyLoadedSettings(loadedSettings)
  }

  const handleLogin = async (): Promise<void> => {
    if (isAuthProcessing) return
    setIsAuthProcessing(true)
    try {
      const result: AuthLoginResult = await window.api.authLogin()
      if (!result.success || !result.user) {
        console.error('Login failed:', result.message)
        return
      }
      setCurrentUser(result.user)
      setIsProfileMenuOpen(false)
      // ログインユーザー向け設定へ再読込し、反映する
      await reloadSettings()
    } catch (error) {
      console.error('Failed to login:', error)
    } finally {
      setIsAuthProcessing(false)
    }
  }

  const handleConfirmLogout = async (): Promise<void> => {
    if (isAuthProcessing) return
    setIsAuthProcessing(true)
    try {
      const result: AuthLogoutResult = await window.api.authLogout()
      if (!result.success) {
        console.error('Logout failed:', result.message)
        return
      }
      setCurrentUser(null)
      setIsProfileMenuOpen(false)
      setIsLogoutConfirmOpen(false)
      setRows([])
      setLastUpdatedAt(null)
      // ログアウト後はゲスト向け設定へ再読込する
      await reloadSettings()
    } catch (error) {
      console.error('Failed to logout:', error)
    } finally {
      setIsAuthProcessing(false)
    }
  }

  const handleSaveSettings = async (): Promise<void> => {
    if (!currentUser || isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const savedSettings = await window.api.saveSettings({
        autoFetchTime: autoFetchTime || null,
        autoFetchIntervalMinutes: buildIntervalMinutes(autoFetchIntervalValue, autoFetchIntervalUnit)
      })
      applyLoadedSettings(savedSettings)
      setIsSettingsOpen(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleClearAutoFetchTime = async (): Promise<void> => {
    if (!currentUser || isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const savedSettings = await window.api.saveSettings({
        autoFetchTime: null,
        autoFetchIntervalMinutes: null
      })
      applyLoadedSettings(savedSettings)
      setIsSettingsOpen(false)
    } catch (error) {
      console.error('Failed to clear settings:', error)
    } finally {
      setIsSavingSettings(false)
    }
  }

  useEffect(() => {
    // Esc キーで日付入力/設定モーダルを閉じる
    const handleEscKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (dateEditor.isDateEditorOpen) {
        event.preventDefault()
        dateEditor.closeEditor()
        return
      }
      if (isSettingsOpen) {
        event.preventDefault()
        setIsSettingsOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscKeyDown)
    return () => {
      window.removeEventListener('keydown', handleEscKeyDown)
    }
  }, [dateEditor, isSettingsOpen])

  const mockTasks = [
    `${dateEditor.selectedDateLabel} のタスク: メール確認`,
    `${dateEditor.selectedDateLabel} のタスク: 定例MTG準備`,
    `${dateEditor.selectedDateLabel} のタスク: 進捗メモ整理`
  ]

  return (
    <div className="container">
      <header className="dashboard-topbar">
        <DateSelector
          selectedDateLabel={dateEditor.selectedDateLabel}
          isDateEditorOpen={dateEditor.isDateEditorOpen}
          dateEditorError={dateEditor.dateEditorError}
          dateFieldErrors={dateEditor.dateFieldErrors}
          yearInput={dateEditor.yearInput}
          monthInput={dateEditor.monthInput}
          dayInput={dateEditor.dayInput}
          yearInputRef={dateEditor.yearInputRef}
          monthInputRef={dateEditor.monthInputRef}
          dayInputRef={dateEditor.dayInputRef}
          onToggleEditor={dateEditor.toggleEditor}
          onCancelEditor={dateEditor.closeEditor}
          onSubmitEditor={dateEditor.submitEditor}
          onYearInputChange={dateEditor.handleYearInputChange}
          onMonthInputChange={dateEditor.handleMonthInputChange}
          onDayInputChange={dateEditor.handleDayInputChange}
          onDayInputKeyDown={dateEditor.handleDayInputKeyDown}
          onInputFocus={dateEditor.handleSelectAllOnFocus}
          onInputBlurPad={dateEditor.handlePadOnBlur}
        />

        <DashboardTabs activeTab={activeTab} onChangeTab={setActiveTab} />

        <div className="topbar-right">
          <button className="sync-button" onClick={() => void handleGetSchedule()} disabled={!currentUser || isAuthProcessing}>
            同期
          </button>
          <ProfileSection
            currentUser={currentUser}
            isAuthProcessing={isAuthProcessing}
            isProfileMenuOpen={isProfileMenuOpen}
            onLogin={() => void handleLogin()}
            onToggleProfileMenu={() => setIsProfileMenuOpen((previous) => !previous)}
            onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
          />
        </div>
      </header>

      <button className="settings-button" onClick={() => setIsSettingsOpen(true)} aria-label="設定">
        ⚙
      </button>

      <section className="content-panel">
        {activeTab === 'schedule' ? <ScheduleTable rows={rows} /> : <TaskMockList taskNames={mockTasks} />}
      </section>

      <div className="updated-at">更新日時: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '-'}</div>

      <SettingsModal
        isOpen={isSettingsOpen}
        currentUserExists={!!currentUser}
        autoFetchTime={autoFetchTime}
        autoFetchIntervalValue={autoFetchIntervalValue}
        autoFetchIntervalUnit={autoFetchIntervalUnit}
        isSavingSettings={isSavingSettings}
        onClose={() => setIsSettingsOpen(false)}
        onChangeAutoFetchTime={setAutoFetchTime}
        onChangeAutoFetchIntervalValue={setAutoFetchIntervalValue}
        onChangeAutoFetchIntervalUnit={setAutoFetchIntervalUnit}
        onClear={() => void handleClearAutoFetchTime()}
        onSave={() => void handleSaveSettings()}
      />

      <LogoutConfirmModal
        isOpen={isLogoutConfirmOpen}
        isProcessing={isAuthProcessing}
        onClose={() => setIsLogoutConfirmOpen(false)}
        onConfirm={() => void handleConfirmLogout()}
      />
    </div>
  )
}

export default App
