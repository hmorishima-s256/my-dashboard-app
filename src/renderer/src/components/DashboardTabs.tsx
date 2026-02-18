import type { DashboardTab } from '../types/ui'

type DashboardTabsProps = {
  activeTab: DashboardTab
  onChangeTab: (tab: DashboardTab) => void
}

// 予定表/タスクのタブ切替を担当する表示コンポーネント
export const DashboardTabs = ({ activeTab, onChangeTab }: DashboardTabsProps): React.JSX.Element => {
  return (
    <div className="dashboard-tabs">
      <button
        type="button"
        className={`dashboard-tab-button ${activeTab === 'schedule' ? 'active' : ''}`}
        onClick={() => onChangeTab('schedule')}
      >
        予定表
      </button>
      <button
        type="button"
        className={`dashboard-tab-button ${activeTab === 'task' ? 'active' : ''}`}
        onClick={() => onChangeTab('task')}
      >
        タスク
      </button>
    </div>
  )
}
