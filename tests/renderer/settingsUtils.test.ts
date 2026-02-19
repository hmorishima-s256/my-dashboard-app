import { describe, expect, it } from 'vitest'
import {
  buildIntervalMinutes,
  parseIntervalForInput
} from '../../src/renderer/src/lib/settingsUtils'

describe('settingsUtils', () => {
  it('保存値（分）を入力表示用の値と単位に変換する', () => {
    expect(parseIntervalForInput(null)).toEqual({ value: '', unit: 'minutes' })
    expect(parseIntervalForInput(120)).toEqual({ value: '2', unit: 'hours' })
    expect(parseIntervalForInput(90)).toEqual({ value: '90', unit: 'minutes' })
  })

  it('入力値と単位を保存値（分）に変換する', () => {
    expect(buildIntervalMinutes('10', 'minutes')).toBe(10)
    expect(buildIntervalMinutes('2', 'hours')).toBe(120)
    expect(buildIntervalMinutes('2.9', 'hours')).toBe(120)
  })

  it('不正入力は未設定（null）として扱う', () => {
    expect(buildIntervalMinutes('', 'minutes')).toBeNull()
    expect(buildIntervalMinutes('0', 'minutes')).toBeNull()
    expect(buildIntervalMinutes('-1', 'hours')).toBeNull()
    expect(buildIntervalMinutes('abc', 'minutes')).toBeNull()
  })
})
