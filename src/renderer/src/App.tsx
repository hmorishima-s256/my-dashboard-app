// import { useState } from 'react'
import { useEffect, useRef, useState } from 'react'
import userAvatarIcon from './assets/user-avatar.svg'

// テーブル1行分の表示型
type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

// 設定モーダルで編集する設定値
type AppSettings = {
  autoFetchTime: string | null
  autoFetchIntervalMinutes: number | null
}

// 認証済みユーザー情報
type UserProfile = {
  name: string
  email: string
  iconUrl: string
}

// ログインAPIの戻り値
type AuthLoginResult = {
  success: boolean
  user: UserProfile | null
  message: string
}

// ログアウトAPIの戻り値
type AuthLogoutResult = {
  success: boolean
  message?: string
}

// Main から配信される更新通知
type CalendarUpdatePayload = {
  events: CalendarTableRow[]
  updatedAt: string
  source: 'manual' | 'auto'
}

type IntervalUnit = 'minutes' | 'hours'
type DashboardTab = 'schedule' | 'task'
type DateFieldErrors = {
  year: boolean
  month: boolean
  day: boolean
}

// 日付/時刻のゼロ埋めを共通化
const pad2 = (value: number): string => String(value).padStart(2, '0')

// ヘッダー表示用: yyyy/mm/dd
const formatDate = (date: Date): string =>
  `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`

// 入力値用: yyyy-mm-dd
const formatInputDate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

// 画面表示用: yyyy/mm/dd
const formatDateFromInput = (inputDate: string): string => inputDate.replace(/-/g, '/')

// 全角数字を半角へ正規化し、数字以外を除去する
const normalizeNumericText = (value: string): string =>
  value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '')

// 桁不足の場合に0埋めする（空文字はそのまま）
const padNumericText = (value: string, length: number): string => {
  if (!value) return value
  return value.padStart(length, '0').slice(0, length)
}

// 更新日時表示用: yyyy/mm/dd HH24:MM/SS
const formatDateTime = (date: Date): string =>
  `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`

// 設定値（分）をUI入力（値 + 単位）へ変換する
const parseIntervalForInput = (minutes: number | null): { value: string; unit: IntervalUnit } => {
  if (!minutes) {
    return { value: '', unit: 'minutes' }
  }
  if (minutes % 60 === 0) {
    return { value: String(minutes / 60), unit: 'hours' }
  }
  return { value: String(minutes), unit: 'minutes' }
}

// UI入力（値 + 単位）を保存値（分）へ変換する
const buildIntervalMinutes = (value: string, unit: IntervalUnit): number | null => {
  if (!value.trim()) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const normalized = Math.floor(numeric)
  return unit === 'hours' ? normalized * 60 : normalized
}

function App(): React.JSX.Element {
  // 取得結果をテーブル表示するための state
  const [rows, setRows] = useState<CalendarTableRow[]>([])
  // 最終更新日時の表示用 state
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  // 設定モーダルの開閉 state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  // 自動取得時刻（HH:mm）の編集 state
  const [autoFetchTime, setAutoFetchTime] = useState('')
  // 設定保存中の二重送信防止 state
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  // 自動取得間隔の入力値（数値）
  const [autoFetchIntervalValue, setAutoFetchIntervalValue] = useState('')
  // 自動取得間隔の入力単位（分/時間）
  const [autoFetchIntervalUnit, setAutoFetchIntervalUnit] = useState<IntervalUnit>('minutes')
  // 現在ログイン中のユーザー state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  // 右上プロフィールメニュー開閉 state
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  // 認証処理中の二重押下防止 state
  const [isAuthProcessing, setIsAuthProcessing] = useState(false)
  // ログアウト確認モーダル開閉 state
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  // 画面ヘッダーで選択中の日付（yyyy-mm-dd）
  const [selectedDate, setSelectedDate] = useState<string>(formatInputDate(new Date()))
  // 年月日入力フィールドの開閉 state
  const [isDateEditorOpen, setIsDateEditorOpen] = useState(false)
  // 年月日入力フィールド（yyyy / mm / dd）
  const [yearInput, setYearInput] = useState<string>(selectedDate.slice(0, 4))
  const [monthInput, setMonthInput] = useState<string>(selectedDate.slice(5, 7))
  const [dayInput, setDayInput] = useState<string>(selectedDate.slice(8, 10))
  // 年月日入力欄のインラインエラー state
  const [dateEditorError, setDateEditorError] = useState('')
  const [dateFieldErrors, setDateFieldErrors] = useState<DateFieldErrors>({
    year: false,
    month: false,
    day: false
  })
  // 一覧表示タブ（予定表/タスク）
  const [activeTab, setActiveTab] = useState<DashboardTab>('schedule')
  // 年月日入力フィールドのフォーカス制御用 ref
  const yearInputRef = useRef<HTMLInputElement | null>(null)
  const monthInputRef = useRef<HTMLInputElement | null>(null)
  const dayInputRef = useRef<HTMLInputElement | null>(null)
  // 通知コールバックで最新の選択日を参照するための ref
  const selectedDateRef = useRef<string>(formatInputDate(new Date()))

  // 日付選択時に最新値を通知コールバック側でも参照できるようにする
  useEffect(() => {
    selectedDateRef.current = selectedDate
  }, [selectedDate])

  // 選択日が更新されたら年月日入力の表示値も同期する
  useEffect(() => {
    setYearInput(selectedDate.slice(0, 4))
    setMonthInput(selectedDate.slice(5, 7))
    setDayInput(selectedDate.slice(8, 10))
  }, [selectedDate])

  // 起動時に設定を読み込み、Main からの自動更新通知を購読する
  useEffect(() => {
    let isMounted = true
    const unsubscribe = window.api.onCalendarUpdated((payload: CalendarUpdatePayload) => {
      if (!isMounted) return
      // 当日以外を表示中は、自動更新通知で表の表示を上書きしない
      if (payload.source === 'auto' && selectedDateRef.current !== formatInputDate(new Date())) {
        return
      }
      setRows(payload.events)
      setLastUpdatedAt(new Date(payload.updatedAt))
    })

    const applyLoadedSettings = (loadedSettings: AppSettings): void => {
      setAutoFetchTime(loadedSettings.autoFetchTime ?? '')
      const parsedInterval = parseIntervalForInput(loadedSettings.autoFetchIntervalMinutes)
      setAutoFetchIntervalValue(parsedInterval.value)
      setAutoFetchIntervalUnit(parsedInterval.unit)
    }

    const loadInitialState = async (): Promise<void> => {
      try {
        const user = await window.api.authGetCurrentUser()
        if (isMounted) {
          setCurrentUser(user)
        }

        const loadedSettings: AppSettings = await window.api.getSettings()
        if (!isMounted) return
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

  // 指定日（未指定時は選択日）の予定を取得する
  const handleGetSchedule = async (targetDate = selectedDate): Promise<void> => {
    if (!currentUser) {
      return
    }
    const events = await window.api.getCalendar(targetDate)
    setRows(events)
    // データ更新のタイミングで更新日時を保存
    setLastUpdatedAt(new Date())
  }

  // ログイン済みの場合、ヘッダーの日付が変わったら自動再取得する
  useEffect(() => {
    if (!currentUser) return
    void handleGetSchedule(selectedDate)
  }, [selectedDate, currentUser])

  // 年月日入力欄のエラー表示を初期化する
  const resetDateEditorError = (): void => {
    setDateEditorError('')
    setDateFieldErrors({ year: false, month: false, day: false })
  }

  // 年月日入力値を検証し、必要に応じてフィールド別のエラーを返す
  const validateDateInputs = (
    nextYear: string,
    nextMonth: string,
    nextDay: string
  ): { valid: boolean; message: string; fieldErrors: DateFieldErrors } => {
    const fieldErrors: DateFieldErrors = {
      year: nextYear.length !== 4,
      month: nextMonth.length !== 2,
      day: nextDay.length !== 2
    }

    if (fieldErrors.year || fieldErrors.month || fieldErrors.day) {
      return { valid: false, message: 'yyyy/mm/dd の各桁数を入力してください。', fieldErrors }
    }

    const year = Number(nextYear)
    const month = Number(nextMonth)
    const day = Number(nextDay)
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      return { valid: false, message: '年月日には数字のみ入力できます。', fieldErrors }
    }

    if (month < 1 || month > 12) {
      fieldErrors.month = true
      return { valid: false, message: '月は 01 から 12 の範囲で入力してください。', fieldErrors }
    }

    if (day < 1 || day > 31) {
      fieldErrors.day = true
      return { valid: false, message: '日は 01 から 31 の範囲で入力してください。', fieldErrors }
    }

    const candidate = new Date(year, month - 1, day)
    const isValidDate =
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    if (!isValidDate) {
      fieldErrors.day = true
      return { valid: false, message: '存在しない日付です。年月日を確認してください。', fieldErrors }
    }

    return { valid: true, message: '', fieldErrors }
  }

  // 日付表示ボタンのクリックで年月日入力欄を開閉する
  const handleToggleDateEditor = (): void => {
    setIsDateEditorOpen((previous) => {
      const next = !previous
      if (next) {
        setYearInput(selectedDate.slice(0, 4))
        setMonthInput(selectedDate.slice(5, 7))
        setDayInput(selectedDate.slice(8, 10))
        resetDateEditorError()
        setTimeout(() => {
          yearInputRef.current?.focus()
          yearInputRef.current?.select()
        }, 0)
      }
      return next
    })
  }

  // 年月日入力モーダルをキャンセルして閉じる
  const handleCancelDateEditor = (): void => {
    setYearInput(selectedDate.slice(0, 4))
    setMonthInput(selectedDate.slice(5, 7))
    setDayInput(selectedDate.slice(8, 10))
    resetDateEditorError()
    setIsDateEditorOpen(false)
  }

  // 年月日入力モーダルの値を確定する
  const handleSubmitDateEditor = (): void => {
    const paddedYear = padNumericText(yearInput, 4)
    const paddedMonth = padNumericText(monthInput, 2)
    const paddedDay = padNumericText(dayInput, 2)

    setYearInput(paddedYear)
    setMonthInput(paddedMonth)
    setDayInput(paddedDay)

    const validation = validateDateInputs(paddedYear, paddedMonth, paddedDay)
    if (!validation.valid) {
      setDateEditorError(validation.message)
      setDateFieldErrors(validation.fieldErrors)
      return
    }

    setSelectedDate(`${paddedYear}-${paddedMonth}-${paddedDay}`)
    resetDateEditorError()
    setIsDateEditorOpen(false)
  }

  // yyyy 入力時は数字のみ許可し、4桁で mm へフォーカス移動する
  const handleYearInputChange = (value: string): void => {
    const normalized = normalizeNumericText(value).slice(0, 4)
    setYearInput(normalized)
    resetDateEditorError()
    if (normalized.length === 4) {
      monthInputRef.current?.focus()
      monthInputRef.current?.select()
    }
  }

  // mm 入力時は数字のみ許可し、2桁で dd へフォーカス移動する
  const handleMonthInputChange = (value: string): void => {
    const normalized = normalizeNumericText(value).slice(0, 2)
    setMonthInput(normalized)
    resetDateEditorError()
    if (normalized.length === 2) {
      dayInputRef.current?.focus()
      dayInputRef.current?.select()
    }
  }

  // dd 入力時は数字のみ許可し、2桁入力後は入力完了状態にする
  const handleDayInputChange = (value: string): void => {
    const normalized = normalizeNumericText(value).slice(0, 2)
    setDayInput(normalized)
    resetDateEditorError()
  }

  // dd 入力欄で Enter を押したら OK と同じ確定処理を実行する
  const handleDayInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    handleSubmitDateEditor()
  }

  // フォーカス時に既存値を全選択し、消さずに上書き入力しやすくする
  const handleSelectAllOnFocus = (event: React.FocusEvent<HTMLInputElement>): void => {
    event.currentTarget.select()
  }

  // フィールド離脱時に桁不足を0埋めする
  const handlePadOnBlur = (field: 'year' | 'month' | 'day'): void => {
    if (field === 'year') {
      setYearInput((previous) => padNumericText(previous, 4))
      return
    }
    if (field === 'month') {
      setMonthInput((previous) => padNumericText(previous, 2))
      return
    }
    setDayInput((previous) => padNumericText(previous, 2))
  }

  // 現在のログインユーザーに紐づく設定を再読込する
  const reloadSettings = async (): Promise<void> => {
    const loadedSettings: AppSettings = await window.api.getSettings()
    setAutoFetchTime(loadedSettings.autoFetchTime ?? '')
    const parsedInterval = parseIntervalForInput(loadedSettings.autoFetchIntervalMinutes)
    setAutoFetchIntervalValue(parsedInterval.value)
    setAutoFetchIntervalUnit(parsedInterval.unit)
  }

  // ログイン処理を実行してプロフィールを反映する
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
      await reloadSettings()
    } catch (error) {
      console.error('Failed to login:', error)
    } finally {
      setIsAuthProcessing(false)
    }
  }

  // ログアウト処理を実行して未ログイン状態へ戻す
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
      await reloadSettings()
    } catch (error) {
      console.error('Failed to logout:', error)
    } finally {
      setIsAuthProcessing(false)
    }
  }

  // モーダル入力値を設定として保存する
  const handleSaveSettings = async (): Promise<void> => {
    if (!currentUser) return
    if (isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const savedSettings: AppSettings = await window.api.saveSettings({
        autoFetchTime: autoFetchTime || null,
        autoFetchIntervalMinutes: buildIntervalMinutes(autoFetchIntervalValue, autoFetchIntervalUnit)
      })
      setAutoFetchTime(savedSettings.autoFetchTime ?? '')
      const parsedInterval = parseIntervalForInput(savedSettings.autoFetchIntervalMinutes)
      setAutoFetchIntervalValue(parsedInterval.value)
      setAutoFetchIntervalUnit(parsedInterval.unit)
      setIsSettingsOpen(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSavingSettings(false)
    }
  }

  // 自動取得を未設定（無効）にする
  const handleClearAutoFetchTime = async (): Promise<void> => {
    if (!currentUser) return
    if (isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const savedSettings: AppSettings = await window.api.saveSettings({
        autoFetchTime: null,
        autoFetchIntervalMinutes: null
      })
      setAutoFetchTime(savedSettings.autoFetchTime ?? '')
      setAutoFetchIntervalValue('')
      setAutoFetchIntervalUnit('minutes')
      setIsSettingsOpen(false)
    } catch (error) {
      console.error('Failed to clear settings:', error)
    } finally {
      setIsSavingSettings(false)
    }
  }

  // ヘッダー表示用の選択日
  const selectedDateLabel = formatDateFromInput(selectedDate)
  // タスクタブの仮データ（選択日連動の表示）
  const mockTasks = [
    `${selectedDateLabel} のタスク: メール確認`,
    `${selectedDateLabel} のタスク: 定例MTG準備`,
    `${selectedDateLabel} のタスク: 進捗メモ整理`
  ]

  return (
    <div className="container">
      {/* ダッシュボード上部: 左=日付, 中央=タブ, 右=同期/プロフィール */}
      <header className="dashboard-topbar">
        <div className="topbar-left">
          {/* 日付表示を押すと、年月日入力フィールドを開閉する */}
          <button className="date-picker-button" onClick={handleToggleDateEditor} type="button" aria-label="日付選択">
            <span className="date-picker-text">{selectedDateLabel}</span>
          </button>
          {isDateEditorOpen ? (
            <div className="date-editor-panel">
              <div className="date-editor-row">
                <input
                  ref={yearInputRef}
                  className={`date-editor-input year ${dateFieldErrors.year ? 'error' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={yearInput}
                  onChange={(event) => handleYearInputChange(event.target.value)}
                  onFocus={handleSelectAllOnFocus}
                  onBlur={() => handlePadOnBlur('year')}
                  aria-label="年"
                  placeholder="yyyy"
                />
                <span className="date-editor-separator">/</span>
                <input
                  ref={monthInputRef}
                  className={`date-editor-input month ${dateFieldErrors.month ? 'error' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={monthInput}
                  onChange={(event) => handleMonthInputChange(event.target.value)}
                  onFocus={handleSelectAllOnFocus}
                  onBlur={() => handlePadOnBlur('month')}
                  aria-label="月"
                  placeholder="mm"
                />
                <span className="date-editor-separator">/</span>
                <input
                  ref={dayInputRef}
                  className={`date-editor-input day ${dateFieldErrors.day ? 'error' : ''}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  value={dayInput}
                  onChange={(event) => handleDayInputChange(event.target.value)}
                  onKeyDown={handleDayInputKeyDown}
                  onFocus={handleSelectAllOnFocus}
                  onBlur={() => handlePadOnBlur('day')}
                  aria-label="日"
                  placeholder="dd"
                />
              </div>
              {dateEditorError ? <p className="date-editor-error">{dateEditorError}</p> : null}
              <div className="date-editor-actions">
                <button className="date-editor-action cancel" type="button" onClick={handleCancelDateEditor}>
                  キャンセル
                </button>
                <button className="date-editor-action ok" type="button" onClick={handleSubmitDateEditor}>
                  OK
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* 予定表/タスクの切替タブ */}
        <div className="dashboard-tabs">
          <button
            type="button"
            className={`dashboard-tab-button ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            予定表
          </button>
          <button
            type="button"
            className={`dashboard-tab-button ${activeTab === 'task' ? 'active' : ''}`}
            onClick={() => setActiveTab('task')}
          >
            タスク
          </button>
        </div>

        <div className="topbar-right">
          <button className="sync-button" onClick={() => void handleGetSchedule()} disabled={!currentUser || isAuthProcessing}>
            同期
          </button>

          {!currentUser ? (
            <button className="login-button" onClick={handleLogin} disabled={isAuthProcessing}>
              Googleログイン
            </button>
          ) : (
            <div className="profile-wrap">
              <button
                className="profile-button"
                onClick={() => setIsProfileMenuOpen((previous) => !previous)}
                aria-label="プロフィール"
              >
                {/* Googleプロフィール画像の有無に関係なく固定アイコンを表示する */}
                <img src={userAvatarIcon} alt="profile" className="profile-image fallback-logo" />
              </button>

              {isProfileMenuOpen ? (
                <div className="profile-menu">
                  <div className="profile-menu-header">
                    {/* アイコン押下後のメニューでも固定アイコンを表示する */}
                    <img src={userAvatarIcon} alt="profile" className="profile-image small fallback-logo" />
                    <div className="profile-meta">
                      <div className="profile-name">{currentUser.name}</div>
                      <div className="profile-email">{currentUser.email}</div>
                    </div>
                  </div>
                  <button
                    className="logout-button"
                    onClick={() => setIsLogoutConfirmOpen(true)}
                    disabled={isAuthProcessing}
                  >
                    ログアウト
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </header>

      {/* 左下の歯車ボタンから設定モーダルを開く */}
      <button className="settings-button" onClick={() => setIsSettingsOpen(true)} aria-label="設定">
        ⚙
      </button>

      {/* 一覧領域は上寄せし、データが少ない場合は下側に余白が残るレイアウトにする */}
      <section className="content-panel">
        {activeTab === 'schedule' ? (
          /* 取得結果を「日時」「件名」「カレンダー名」カラムで表示 */
          <main className="table-card">
            <table>
              <thead>
                <tr>
                  <th>日時</th>
                  <th>件名</th>
                  <th>カレンダー名</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.calendarName}-${row.subject}-${row.dateTime}-${index}`}>
                    {/* 日時の改行（開始/終了）をそのまま表示するセル */}
                    <td className="date-time-cell">{row.dateTime}</td>
                    <td>{row.subject}</td>
                    <td>{row.calendarName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </main>
        ) : (
          /* タスクタブは仮データを表示 */
          <main className="task-card">
            <ul className="task-list">
              {mockTasks.map((taskName, index) => (
                <li key={`${taskName}-${index}`} className="task-item">
                  {taskName}
                </li>
              ))}
            </ul>
          </main>
        )}
      </section>

      {/* 右下の更新日時表示 */}
      <div className="updated-at">
        更新日時: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '-'}
      </div>

      {/* 自動取得時刻の設定モーダル */}
      {isSettingsOpen ? (
        <div className="settings-modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="settings-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="settings-title">設定</h2>
            <label className="settings-label" htmlFor="auto-fetch-time">
              自動取得時刻
            </label>
            <input
              id="auto-fetch-time"
              className="settings-time-input"
              type="time"
              value={autoFetchTime}
              onChange={(event) => setAutoFetchTime(event.target.value)}
              disabled={!currentUser}
            />
            <p className="settings-note">
              {currentUser
                ? '未設定の場合、自動取得は実行しません。'
                : 'ログインすると自動取得時刻を設定できます。'}
            </p>
            <label className="settings-label" htmlFor="auto-fetch-interval-value">
              自動取得間隔
            </label>
            <div className="settings-interval-row">
              <input
                id="auto-fetch-interval-value"
                className="settings-time-input settings-interval-input"
                type="number"
                min={1}
                step={1}
                value={autoFetchIntervalValue}
                onChange={(event) => setAutoFetchIntervalValue(event.target.value)}
                disabled={!currentUser}
                placeholder="未設定"
              />
              <select
                className="settings-time-input settings-interval-unit"
                value={autoFetchIntervalUnit}
                onChange={(event) => setAutoFetchIntervalUnit(event.target.value as IntervalUnit)}
                disabled={!currentUser}
              >
                <option value="minutes">分ごと</option>
                <option value="hours">時間ごと</option>
              </select>
            </div>
            <div className="settings-actions">
              <button
                className="settings-action-button secondary"
                onClick={() => setIsSettingsOpen(false)}
                disabled={isSavingSettings}
              >
                閉じる
              </button>
              <button
                className="settings-action-button secondary"
                onClick={handleClearAutoFetchTime}
                disabled={isSavingSettings || !currentUser}
              >
                未設定にする
              </button>
              <button
                className="settings-action-button primary"
                onClick={handleSaveSettings}
                disabled={isSavingSettings || !currentUser}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ログアウト確認モーダル */}
      {isLogoutConfirmOpen ? (
        <div className="settings-modal-overlay" onClick={() => setIsLogoutConfirmOpen(false)}>
          <div className="settings-modal logout-confirm-modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="settings-title">ログアウト確認</h2>
            <p className="settings-note">ログアウトします。よろしいですか？</p>
            <div className="settings-actions">
              <button
                className="settings-action-button secondary"
                onClick={() => setIsLogoutConfirmOpen(false)}
                disabled={isAuthProcessing}
              >
                キャンセル
              </button>
              <button
                className="settings-action-button primary"
                onClick={handleConfirmLogout}
                disabled={isAuthProcessing}
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
