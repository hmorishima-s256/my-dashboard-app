type LogoutConfirmModalProps = {
  isOpen: boolean
  isProcessing: boolean
  onClose: () => void
  onConfirm: () => void
}

// ログアウト確認モーダルの表示を担当する表示コンポーネント
export const LogoutConfirmModal = ({
  isOpen,
  isProcessing,
  onClose,
  onConfirm
}: LogoutConfirmModalProps): React.JSX.Element | null => {
  if (!isOpen) return null

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal logout-confirm-modal" onClick={(event) => event.stopPropagation()}>
        <h2 className="settings-title">ログアウト確認</h2>
        <p className="settings-note">ログアウトします。よろしいですか？</p>
        <div className="settings-actions">
          <button className="settings-action-button secondary" onClick={onClose} disabled={isProcessing}>
            キャンセル
          </button>
          <button className="settings-action-button primary" onClick={onConfirm} disabled={isProcessing}>
            ログアウト
          </button>
        </div>
      </div>
    </div>
  )
}
