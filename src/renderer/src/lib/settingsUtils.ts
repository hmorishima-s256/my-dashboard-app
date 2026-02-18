import type { IntervalUnit } from '../types/ui'

// 保存値（分）を入力フォーム向けの値+単位へ変換する
export const parseIntervalForInput = (minutes: number | null): { value: string; unit: IntervalUnit } => {
  if (!minutes) {
    return { value: '', unit: 'minutes' }
  }
  if (minutes % 60 === 0) {
    return { value: String(minutes / 60), unit: 'hours' }
  }
  return { value: String(minutes), unit: 'minutes' }
}

// 入力フォームの値+単位を保存値（分）へ変換する
export const buildIntervalMinutes = (value: string, unit: IntervalUnit): number | null => {
  if (!value.trim()) return null
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  const normalized = Math.floor(numeric)
  return unit === 'hours' ? normalized * 60 : normalized
}
