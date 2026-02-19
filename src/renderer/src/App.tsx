import { useEffect, useRef, useState } from 'react'
import { DateSelector } from './components/DateSelector'
import { DashboardTabs } from './components/DashboardTabs'
import { LogoutConfirmModal } from './components/LogoutConfirmModal'
import { ProfileSection } from './components/ProfileSection'
import { ScheduleTable } from './components/ScheduleTable'
import { SettingsModal } from './components/SettingsModal'
import { TaskBoard } from './components/TaskBoard'
import { formatDateTime, formatInputDate } from './lib/dateUtils'
import { useDateEditor } from './hooks/useDateEditor'
import { useAuthController } from './hooks/useAuthController'
import { useCalendarRows } from './hooks/useCalendarRows'
import { useDashboardSettings } from './hooks/useDashboardSettings'
import type { DashboardTab } from './types/ui'

// ダッシュボード画面全体を構成するルートコンポーネント
function App(): React.JSX.Element {
  // 画面のタブ状態
  const [activeTab, setActiveTab] = useState<DashboardTab>('schedule')

  const selectedDateRef = useRef<string>(formatInputDate(new Date()))
  const dateEditor = useDateEditor()
  const auth = useAuthController()
  const settings = useDashboardSettings()
  const calendarRows = useCalendarRows({ selectedDateRef })
  const selectedDate = dateEditor.selectedDate
  const isDateEditorOpen = dateEditor.isDateEditorOpen
  const closeDateEditor = dateEditor.closeEditor
  const currentUser = auth.currentUser
  const setCurrentUser = auth.setCurrentUser
  const loadCurrentUser = auth.loadCurrentUser
  const applyLoadedSettings = settings.applyLoadedSettings
  const isSettingsOpen = settings.isSettingsOpen
  const closeSettingsModal = settings.closeSettingsModal
  const fetchSchedule = calendarRows.fetchSchedule
  const clearRows = calendarRows.clearRows

  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

  useEffect(() => {
    let isMounted = true
    // 起動時に認証情報と設定をロードする
    const loadInitialState = async (): Promise<void> => {
      try {
        const [user, loadedSettings] = await Promise.all([
          loadCurrentUser(),
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
    }
  }, [applyLoadedSettings, loadCurrentUser, setCurrentUser])

  useEffect(() => {
    if (!currentUser) return
    void fetchSchedule(currentUser, selectedDate)
  }, [currentUser, fetchSchedule, selectedDate])

  const reloadSettings = async (): Promise<void> => {
    const loadedSettings = await window.api.getSettings()
    applyLoadedSettings(loadedSettings)
  }

  const handleLogin = async (): Promise<void> => {
    await auth.login(async () => {
      // ログイン後はユーザー設定を再取得する
      await reloadSettings()
    })
  }

  const handleConfirmLogout = async (): Promise<void> => {
    await auth.logout(async () => {
      // ログアウト後は表示データを初期化し、ゲスト設定へ戻す
      clearRows()
      await reloadSettings()
    })
  }

  const handleGetSchedule = async (targetDate = selectedDate): Promise<void> => {
    await fetchSchedule(currentUser, targetDate)
  }

  // シェブロン操作で日付を移動した際は selectedDate が更新され、同期が自動実行される
  const handleShiftDate = (days: number): void => {
    dateEditor.shiftSelectedDate(days)
  }

  useEffect(() => {
    // Esc キーで日付入力/設定モーダルを閉じる
    const handleEscKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (isDateEditorOpen) {
        event.preventDefault()
        closeDateEditor()
        return
      }
      if (isSettingsOpen) {
        event.preventDefault()
        closeSettingsModal()
      }
    }
    window.addEventListener('keydown', handleEscKeyDown)
    return () => {
      window.removeEventListener('keydown', handleEscKeyDown)
    }
  }, [closeDateEditor, closeSettingsModal, isDateEditorOpen, isSettingsOpen])

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
          onShiftDateBackward={() => handleShiftDate(-1)}
          onShiftDateForward={() => handleShiftDate(1)}
          onCancelEditor={dateEditor.closeEditor}
          onSetToday={dateEditor.setTodayInputs}
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
          <button
            className="sync-button"
            onClick={() => void handleGetSchedule()}
            disabled={!auth.currentUser || auth.isAuthProcessing}
          >
            同期
          </button>
          <ProfileSection
            currentUser={auth.currentUser}
            isAuthProcessing={auth.isAuthProcessing}
            isProfileMenuOpen={auth.isProfileMenuOpen}
            onLogin={() => void handleLogin()}
            onToggleProfileMenu={() => auth.setIsProfileMenuOpen((previous) => !previous)}
            onOpenLogoutConfirm={() => auth.setIsLogoutConfirmOpen(true)}
          />
        </div>
      </header>

      <section className="content-panel">
        {activeTab === 'schedule' ? (
          <ScheduleTable rows={calendarRows.rows} />
        ) : (
          <TaskBoard
            selectedDate={dateEditor.selectedDate}
            selectedDateLabel={dateEditor.selectedDateLabel}
            currentUser={auth.currentUser}
            taskTimeDisplayMode={settings.taskTimeDisplayMode}
          />
        )}
      </section>

      <footer className="dashboard-footer">
        <button className="settings-button" onClick={settings.openSettingsModal} aria-label="設定">
          ⚙
        </button>
        <div className="updated-at">
          更新日時: {calendarRows.lastUpdatedAt ? formatDateTime(calendarRows.lastUpdatedAt) : '-'}
        </div>
      </footer>

      <SettingsModal
        isOpen={settings.isSettingsOpen}
        currentUserExists={!!auth.currentUser}
        autoFetchTime={settings.autoFetchTime}
        autoFetchIntervalValue={settings.autoFetchIntervalValue}
        autoFetchIntervalUnit={settings.autoFetchIntervalUnit}
        taskTimeDisplayMode={settings.taskTimeDisplayModeDraft}
        isSavingSettings={settings.isSavingSettings}
        onClose={settings.closeSettingsModal}
        onChangeAutoFetchTime={settings.setAutoFetchTime}
        onChangeAutoFetchIntervalValue={settings.setAutoFetchIntervalValue}
        onChangeAutoFetchIntervalUnit={settings.setAutoFetchIntervalUnit}
        onChangeTaskTimeDisplayMode={settings.setTaskTimeDisplayModeDraft}
        onClear={() => void settings.clearSettings(auth.currentUser)}
        onSave={() => void settings.saveSettings(auth.currentUser)}
      />

      <LogoutConfirmModal
        isOpen={auth.isLogoutConfirmOpen}
        isProcessing={auth.isAuthProcessing}
        onClose={() => auth.setIsLogoutConfirmOpen(false)}
        onConfirm={() => void handleConfirmLogout()}
      />
    </div>
  )
}

export default App
