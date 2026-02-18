type TaskMockListProps = {
  taskNames: string[]
}

// タスクタブの仮データ表示を担当する表示コンポーネント
export const TaskMockList = ({ taskNames }: TaskMockListProps): React.JSX.Element => {
  return (
    <main className="task-card">
      <ul className="task-list">
        {taskNames.map((taskName, index) => (
          <li key={`${taskName}-${index}`} className="task-item">
            {taskName}
          </li>
        ))}
      </ul>
    </main>
  )
}
