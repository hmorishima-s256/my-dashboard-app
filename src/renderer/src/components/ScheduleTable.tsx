import type { CalendarTableRow } from '../types/ui'

type ScheduleTableProps = {
  rows: CalendarTableRow[]
}

// 予定一覧テーブル表示を担当する表示コンポーネント
export const ScheduleTable = ({ rows }: ScheduleTableProps): React.JSX.Element => {
  return (
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
              <td className="date-time-cell">{row.dateTime}</td>
              <td>{row.subject}</td>
              <td>{row.calendarName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
