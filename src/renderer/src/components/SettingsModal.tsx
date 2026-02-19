import type { IntervalUnit, TaskTimeDisplayMode } from '../types/ui'

type SettingsModalProps = {
  isOpen: boolean
  currentUserExists: boolean
  autoFetchTime: string
  autoFetchIntervalValue: string
  autoFetchIntervalUnit: IntervalUnit
  taskTimeDisplayMode: TaskTimeDisplayMode
  isSavingSettings: boolean
  onClose: () => void
  onChangeAutoFetchTime: (value: string) => void
  onChangeAutoFetchIntervalValue: (value: string) => void
  onChangeAutoFetchIntervalUnit: (unit: IntervalUnit) => void
  onChangeTaskTimeDisplayMode: (mode: TaskTimeDisplayMode) => void
  onClear: () => void
  onSave: () => void
}

// 設定モーダルの表示・入力UIを担当する表示コンポーネント
export const SettingsModal = ({
  isOpen,
  currentUserExists,
  autoFetchTime,
  autoFetchIntervalValue,
  autoFetchIntervalUnit,
  taskTimeDisplayMode,
  isSavingSettings,
  onClose,
  onChangeAutoFetchTime,
  onChangeAutoFetchIntervalValue,
  onChangeAutoFetchIntervalUnit,
  onChangeTaskTimeDisplayMode,
  onClear,
  onSave
}: SettingsModalProps): React.JSX.Element | null => {
  if (!isOpen) return null

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
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
          onChange={(event) => onChangeAutoFetchTime(event.target.value)}
          disabled={!currentUserExists}
        />
        <p className="settings-note">
          {currentUserExists
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
            onChange={(event) => onChangeAutoFetchIntervalValue(event.target.value)}
            disabled={!currentUserExists}
            placeholder="未設定"
          />
          <select
            className="settings-time-input settings-interval-unit"
            value={autoFetchIntervalUnit}
            onChange={(event) => onChangeAutoFetchIntervalUnit(event.target.value as IntervalUnit)}
            disabled={!currentUserExists}
          >
            <option value="minutes">分ごと</option>
            <option value="hours">時間ごと</option>
          </select>
        </div>
        <label className="settings-label" htmlFor="task-time-display-mode">
          タスク時間表記
        </label>
        <select
          id="task-time-display-mode"
          className="settings-time-input"
          value={taskTimeDisplayMode}
          onChange={(event) =>
            onChangeTaskTimeDisplayMode(event.target.value as TaskTimeDisplayMode)
          }
        >
          <option value="hourMinute">6時間45分</option>
          <option value="decimal">6.75時間</option>
        </select>
        <div className="settings-actions">
          <button
            className="settings-action-button secondary"
            onClick={onClose}
            disabled={isSavingSettings}
          >
            閉じる
          </button>
          <button
            className="settings-action-button secondary"
            onClick={onClear}
            disabled={isSavingSettings || !currentUserExists}
          >
            未設定にする
          </button>
          <button
            className="settings-action-button primary"
            onClick={onSave}
            disabled={isSavingSettings || !currentUserExists}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
