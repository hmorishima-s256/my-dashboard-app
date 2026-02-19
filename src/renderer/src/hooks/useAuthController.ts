import { useCallback, useState } from 'react'
import type { AuthLoginResult, AuthLogoutResult, UserProfile } from '../types/ui'

type UseAuthControllerResult = {
  currentUser: UserProfile | null
  isProfileMenuOpen: boolean
  isAuthProcessing: boolean
  isLogoutConfirmOpen: boolean
  setCurrentUser: React.Dispatch<React.SetStateAction<UserProfile | null>>
  setIsProfileMenuOpen: React.Dispatch<React.SetStateAction<boolean>>
  setIsLogoutConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>
  loadCurrentUser: () => Promise<UserProfile | null>
  login: (onAfterLogin?: (user: UserProfile) => Promise<void> | void) => Promise<void>
  logout: (onAfterLogout?: () => Promise<void> | void) => Promise<void>
}

// 認証状態（ログイン・ログアウト）を担当するフック
export const useAuthController = (): UseAuthControllerResult => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isAuthProcessing, setIsAuthProcessing] = useState(false)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)

  const loadCurrentUser = useCallback(async (): Promise<UserProfile | null> => {
    const user = await window.api.authGetCurrentUser()
    setCurrentUser(user)
    return user
  }, [])

  const login = async (
    onAfterLogin?: (user: UserProfile) => Promise<void> | void
  ): Promise<void> => {
    if (isAuthProcessing) return
    setIsAuthProcessing(true)
    try {
      const result: AuthLoginResult = await window.api.authLogin()
      if (!result.success || !result.user) return
      setCurrentUser(result.user)
      setIsProfileMenuOpen(false)
      if (onAfterLogin) {
        await onAfterLogin(result.user)
      }
    } catch (error) {
      console.error('Failed to login:', error)
    } finally {
      setIsAuthProcessing(false)
    }
  }

  const logout = async (onAfterLogout?: () => Promise<void> | void): Promise<void> => {
    if (isAuthProcessing) return
    setIsAuthProcessing(true)
    try {
      const result: AuthLogoutResult = await window.api.authLogout()
      if (!result.success) return
      setCurrentUser(null)
      setIsProfileMenuOpen(false)
      setIsLogoutConfirmOpen(false)
      if (onAfterLogout) {
        await onAfterLogout()
      }
    } catch (error) {
      console.error('Failed to logout:', error)
    } finally {
      setIsAuthProcessing(false)
    }
  }

  return {
    currentUser,
    isProfileMenuOpen,
    isAuthProcessing,
    isLogoutConfirmOpen,
    setCurrentUser,
    setIsProfileMenuOpen,
    setIsLogoutConfirmOpen,
    loadCurrentUser,
    login,
    logout
  }
}
