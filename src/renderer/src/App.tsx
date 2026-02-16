import { useState } from 'react'

// テーブル1行分の表示型
type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
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

  const handleGetSchedule = async () => {
    console.log('Fetching schedule...')
    const events = await window.api.getCalendar()
    console.log('Events:', events)
    setRows(events)
    // データ更新のタイミングで更新日時を保存
    setLastUpdatedAt(new Date())
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
    </div>
  )
}

export default App
