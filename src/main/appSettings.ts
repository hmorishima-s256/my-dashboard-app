import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'

// 自動取得設定の保存型
export type AppSettings = {
  autoFetchTime: string | null
}

const DEFAULT_SETTINGS: AppSettings = {
  autoFetchTime: null
}

// 設定ファイル保存先（OSごとの userData 配下）
const getSettingsPath = (): string => path.join(app.getPath('userData'), 'settings.json')

// HH:mm 形式のみ許可し、それ以外は未設定扱いにする
const normalizeAutoFetchTime = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(trimmed)
  return match ? `${match[1]}:${match[2]}` : null
}

// 設定を読み込む（ファイル未作成時はデフォルトを返す）
export const loadAppSettings = async (): Promise<AppSettings> => {
  try {
    const filePath = getSettingsPath()
    const content = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(content) as Partial<AppSettings>
    return {
      autoFetchTime: normalizeAutoFetchTime(parsed.autoFetchTime)
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

// 設定を保存する（保存前に正規化）
export const saveAppSettings = async (settings: AppSettings): Promise<AppSettings> => {
  const nextSettings: AppSettings = {
    autoFetchTime: normalizeAutoFetchTime(settings.autoFetchTime)
  }

  const filePath = getSettingsPath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(nextSettings, null, 2), 'utf-8')

  return nextSettings
}
