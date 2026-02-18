import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateFromInput,
  formatDateTime,
  formatInputDate,
  normalizeNumericText,
  padNumericText
} from '../../src/renderer/src/lib/dateUtils'

describe('dateUtils', () => {
  it('日付フォーマットを yyyy/mm/dd 形式で返す', () => {
    const date = new Date(2026, 0, 2)
    expect(formatDate(date)).toBe('2026/01/02')
  })

  it('入力用日付フォーマットを yyyy-mm-dd 形式で返す', () => {
    const date = new Date(2026, 10, 9)
    expect(formatInputDate(date)).toBe('2026-11-09')
  })

  it('yyyy-mm-dd 形式を yyyy/mm/dd（曜日） へ変換する', () => {
    expect(formatDateFromInput('2026-02-18')).toBe('2026/02/18（水）')
  })

  it('更新日時フォーマットを yyyy/mm/dd HH:mm:ss で返す', () => {
    const date = new Date(2026, 1, 18, 3, 4, 5)
    expect(formatDateTime(date)).toBe('2026/02/18 03:04:05')
  })

  it('全角数字と不要文字を正規化する', () => {
    expect(normalizeNumericText('２０２６年0a2月1８日')).toBe('20260218')
  })

  it('桁埋めを行い、指定長を超える場合は切り詰める', () => {
    expect(padNumericText('3', 2)).toBe('03')
    expect(padNumericText('123', 2)).toBe('12')
    expect(padNumericText('', 2)).toBe('')
  })
})
