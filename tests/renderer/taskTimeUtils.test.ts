import { describe, expect, it } from 'vitest'
import {
  calculateActualDurationMinutes,
  calculateDurationMinutes,
  calculateElapsedMinutes,
  calculateEndTime,
  formatMinutesAsDecimalHours,
  formatMinutesAsDecimalHoursValue,
  formatMinutesAsHourMinute,
  formatMinutesToTime,
  parseTimeToMinutes,
  resumeTaskTracking,
  startTaskTracking,
  suspendTaskTracking,
  stopTaskTracking
} from '../../src/renderer/src/lib/taskTimeUtils'
import type { Task } from '../../src/shared/contracts'

const createBaseTask = (): Task => ({
  id: 'task-1',
  userId: 'guest',
  date: '2026-02-18',
  project: '案件A',
  category: '設計',
  title: '詳細設計',
  status: 'todo',
  priority: '中',
  memo: '',
  estimated: {
    start: '09:00',
    end: '10:00',
    minutes: 60
  },
  actual: {
    minutes: 0,
    suspendMinutes: 0,
    suspendStartedAt: null,
    logs: []
  },
  createdAt: '2026-02-18T00:00:00.000Z',
  updatedAt: '2026-02-18T00:00:00.000Z'
})

describe('taskTimeUtils', () => {
  it('HH:mm を分へ変換する', () => {
    expect(parseTimeToMinutes('09:30')).toBe(570)
    expect(parseTimeToMinutes('99:00')).toBeNull()
    expect(parseTimeToMinutes(null)).toBeNull()
  })

  it('分を HH:mm 形式へ変換する', () => {
    expect(formatMinutesToTime(0)).toBe('00:00')
    expect(formatMinutesToTime(570)).toBe('09:30')
    expect(formatMinutesToTime(24 * 60 + 30)).toBe('00:30')
  })

  it('開始時刻と見積分から終了時刻を算出する', () => {
    expect(calculateEndTime('09:00', 60)).toBe('10:00')
    expect(calculateEndTime('09:30', 405)).toBe('17:15')
    expect(calculateEndTime('12:30', 30)).toBe('13:30')
    expect(calculateEndTime('23:30', 60)).toBe('00:30')
    expect(calculateEndTime(null, 60)).toBeNull()
  })

  it('開始/終了時刻から昼休憩を除いた分を算出する', () => {
    expect(calculateDurationMinutes('09:00', '10:00')).toBe(60)
    expect(calculateDurationMinutes('09:30', '17:15')).toBe(405)
    expect(calculateDurationMinutes('23:30', '00:30')).toBe(60)
    expect(calculateDurationMinutes('aa', '10:00')).toBe(0)
  })

  it('実績分は昼休憩と中断時間を除いて算出する', () => {
    expect(calculateActualDurationMinutes('09:30', '17:15', 30)).toBe(375)
    expect(calculateActualDurationMinutes('09:30', '17:15', 999)).toBe(0)
  })

  it('ISO日時差から昼休憩を除き秒切り捨てで分を算出する', () => {
    expect(calculateElapsedMinutes('2026-02-18T09:00:00.000Z', '2026-02-18T09:10:59.000Z')).toBe(10)
    expect(calculateElapsedMinutes('2026-02-18T09:30:00', '2026-02-18T17:15:00')).toBe(405)
    expect(calculateElapsedMinutes('2026-02-18T09:00:00.000Z', '2026-02-18T08:59:59.000Z')).toBe(0)
  })

  it('分を 時間+分 の表示文字列へ変換する', () => {
    expect(formatMinutesAsHourMinute(0)).toBe('0時間0分')
    expect(formatMinutesAsHourMinute(405)).toBe('6時間45分')
  })

  it('分を 小数時間 の表示文字列へ変換する', () => {
    expect(formatMinutesAsDecimalHoursValue(0)).toBe('0.00')
    expect(formatMinutesAsDecimalHoursValue(405)).toBe('6.75')
    expect(formatMinutesAsDecimalHours(405)).toBe('6.75時間')
  })

  it('開始操作で doing + open log を追加する', () => {
    const task = createBaseTask()
    const next = startTaskTracking(task, '2026-02-18T09:00:00.000Z')
    expect(next.status).toBe('doing')
    expect(next.actual.logs).toEqual([{ start: '2026-02-18T09:00:00.000Z', end: null }])
  })

  it('停止操作で open log を閉じて実績分を加算する', () => {
    const task = createBaseTask()
    task.status = 'doing'
    task.actual.logs = [{ start: '2026-02-18T09:00:00.000Z', end: null }]
    const next = stopTaskTracking(task, '2026-02-18T09:15:59.000Z', 'finished')
    expect(next.status).toBe('finished')
    expect(next.actual.minutes).toBe(15)
    expect(next.actual.logs[0].end).toBe('2026-02-18T09:15:59.000Z')
  })

  it('中断→再開で中断分を記録して実績計測を継続する', () => {
    const task = createBaseTask()
    const started = startTaskTracking(task, '2026-02-18T09:00:00.000Z')
    const suspended = suspendTaskTracking(started, '2026-02-18T09:10:00.000Z')
    expect(suspended.status).toBe('suspend')
    expect(suspended.actual.minutes).toBe(10)
    expect(suspended.actual.suspendStartedAt).toBe('2026-02-18T09:10:00.000Z')

    const resumed = resumeTaskTracking(suspended, '2026-02-18T09:16:00.000Z')
    expect(resumed.status).toBe('doing')
    expect(resumed.actual.suspendMinutes).toBe(6)
    expect(resumed.actual.suspendStartedAt).toBeNull()
    expect(resumed.actual.logs[resumed.actual.logs.length - 1]).toEqual({
      start: '2026-02-18T09:16:00.000Z',
      end: null
    })

    const finished = stopTaskTracking(resumed, '2026-02-18T09:26:00.000Z', 'finished')
    expect(finished.actual.minutes).toBe(20)
    expect(finished.actual.suspendMinutes).toBe(6)
    expect(finished.status).toBe('finished')
  })
})
