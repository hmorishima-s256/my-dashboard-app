// import { useState } from 'react'
import { useEffect, useState } from 'react'

// テーブル1行分の表示型
type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

// 設定モーダルで編集する設定値
type AppSettings = {
  autoFetchTime: string | null
}

// Main から配信される更新通知
type CalendarUpdatePayload = {
  events: CalendarTableRow[]
  updatedAt: string
  source: 'manual' | 'auto'
}

// 日付/時刻のゼロ埋めを共通化
const pad2 = (value: number): string => String(value).padStart(2, '0')

// ヘッダー表示用: yyyy/mm/dd
const formatDate = (date: Date): string =>
  `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`

// 更新日時表示用: yyyy/mm/dd HH24:MM/SS
const formatDateTime = (date: Date): string =>
  `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`

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

  // 起動時に設定を読み込み、Main からの自動更新通知を購読する
  useEffect(() => {
    let isMounted = true
    const unsubscribe = window.api.onCalendarUpdated((payload: CalendarUpdatePayload) => {
      if (!isMounted) return
      setRows(payload.events)
      setLastUpdatedAt(new Date(payload.updatedAt))
    })

    const loadSettings = async (): Promise<void> => {
      try {
        const loadedSettings: AppSettings = await window.api.getSettings()
        if (!isMounted) return
        setAutoFetchTime(loadedSettings.autoFetchTime ?? '')
      } catch (error) {
        console.error('Failed to load settings:', error)
      }
    }

    void loadSettings()

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const handleGetSchedule = async () => {
    console.log('Fetching schedule...')
    const events = await window.api.getCalendar()
    console.log('Events:', events)
    setRows(events)
    // データ更新のタイミングで更新日時を保存
    setLastUpdatedAt(new Date())
  }

  // モーダル入力値を設定として保存する
  const handleSaveSettings = async (): Promise<void> => {
    if (isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const savedSettings: AppSettings = await window.api.saveSettings({
        autoFetchTime: autoFetchTime || null
      })
      setAutoFetchTime(savedSettings.autoFetchTime ?? '')
      setIsSettingsOpen(false)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSavingSettings(false)
    }
  }

  // 自動取得を未設定（無効）にする
  const handleClearAutoFetchTime = async (): Promise<void> => {
    if (isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const savedSettings: AppSettings = await window.api.saveSettings({
        autoFetchTime: null
      })
      setAutoFetchTime(savedSettings.autoFetchTime ?? '')
      setIsSettingsOpen(false)
    } catch (error) {
      console.error('Failed to clear settings:', error)
    } finally {
      setIsSavingSettings(false)
    }
  }

  return (
    <div className="container">
      {/* ダッシュボードヘッダー */}
      <header className="dashboard-header">
        <h1 className="dashboard-title">{formatDate(new Date())} 今日の予定</h1>
      </header>

      {/* 右上固定の同期ボタン */}
      <button className="sync-button" onClick={handleGetSchedule}>
        Googleカレンダー同期
      </button>

      {/* 左下の歯車ボタンから設定モーダルを開く */}
      <button className="settings-button" onClick={() => setIsSettingsOpen(true)} aria-label="設定">
        ⚙
      </button>

      {/* 取得結果を「日時」「件名」「カレンダー名」カラムで表示 */}
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
            />
            <p className="settings-note">未設定の場合、自動取得は実行しません。</p>
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
                disabled={isSavingSettings}
              >
                未設定にする
              </button>
              <button
                className="settings-action-button primary"
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
