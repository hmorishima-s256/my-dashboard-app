import userAvatarIcon from '../assets/user-avatar.svg'
import type { UserProfile } from '../types/ui'

type ProfileSectionProps = {
  currentUser: UserProfile | null
  isAuthProcessing: boolean
  isProfileMenuOpen: boolean
  onLogin: () => void
  onToggleProfileMenu: () => void
  onOpenLogoutConfirm: () => void
}

// 右上の認証UI（ログイン/プロフィール）を担当する表示コンポーネント
export const ProfileSection = ({
  currentUser,
  isAuthProcessing,
  isProfileMenuOpen,
  onLogin,
  onToggleProfileMenu,
  onOpenLogoutConfirm
}: ProfileSectionProps): React.JSX.Element => {
  if (!currentUser) {
    return (
      <button className="login-button" onClick={onLogin} disabled={isAuthProcessing}>
        Googleログイン
      </button>
    )
  }

  return (
    <div className="profile-wrap">
      <button className="profile-button" onClick={onToggleProfileMenu} aria-label="プロフィール">
        <img src={userAvatarIcon} alt="profile" className="profile-image fallback-logo" />
      </button>

      {isProfileMenuOpen ? (
        <div className="profile-menu">
          <div className="profile-menu-header">
            <img src={userAvatarIcon} alt="profile" className="profile-image small fallback-logo" />
            <div className="profile-meta">
              <div className="profile-name">{currentUser.name}</div>
              <div className="profile-email">{currentUser.email}</div>
            </div>
          </div>
          <button
            className="logout-button"
            onClick={onOpenLogoutConfirm}
            disabled={isAuthProcessing}
          >
            ログアウト
          </button>
        </div>
      ) : null}
    </div>
  )
}
