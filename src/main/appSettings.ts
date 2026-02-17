import path from 'path'
import fs from 'fs/promises'
import { type UserProfile, APP_SHARED_CONFIG_DIR, getUserSettingsDir } from './googleAuth'

// 自動取得設定の保存型
export type AppSettings = {
  autoFetchTime: string | null
  autoFetchIntervalMinutes: number | null
}

const DEFAULT_SETTINGS: AppSettings = {
  autoFetchTime: null,
  autoFetchIntervalMinutes: null
}

// 設定ファイル保存先（未ログイン時はゲスト設定を返す）
// const getSettingsPath = (): string => path.join(app.getPath('userData'), 'settings.json')
const getSettingsPath = (currentUser: UserProfile | null): string => {
  if (!currentUser?.email) {
    return path.join(APP_SHARED_CONFIG_DIR, 'settings.guest.json')
  }
  return path.join(getUserSettingsDir(currentUser.email), 'settings.json')
}

// HH:mm 形式のみ許可し、それ以外は未設定扱いにする
const normalizeAutoFetchTime = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed)
  return match ? `${match[1]}:${match[2]}` : null
}

// 1分以上の整数のみ許可し、それ以外は未設定扱いにする
const normalizeAutoFetchIntervalMinutes = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null
  if (!Number.isFinite(value)) return null
  const normalized = Math.floor(value)
  return normalized >= 1 ? normalized : null
}

// 設定を読み込む（ファイル未作成時はデフォルトを返す）
// export const loadAppSettings = async (): Promise<AppSettings> => {
export const loadAppSettings = async (currentUser: UserProfile | null): Promise<AppSettings> => {
  try {
    const filePath = getSettingsPath(currentUser)
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content) as Partial<AppSettings>
    return {
      autoFetchTime: normalizeAutoFetchTime(parsed.autoFetchTime),
      autoFetchIntervalMinutes: normalizeAutoFetchIntervalMinutes(parsed.autoFetchIntervalMinutes)
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

// 設定を保存する（保存前に正規化）
// export const saveAppSettings = async (settings: AppSettings): Promise<AppSettings> => {
export const saveAppSettings = async (
  currentUser: UserProfile | null,
  settings: AppSettings
): Promise<AppSettings> => {
  const nextSettings: AppSettings = {
    autoFetchTime: normalizeAutoFetchTime(settings.autoFetchTime),
    autoFetchIntervalMinutes: normalizeAutoFetchIntervalMinutes(settings.autoFetchIntervalMinutes)
  }

  const filePath = getSettingsPath(currentUser)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(nextSettings, null, 2), 'utf-8')

  return nextSettings
}
