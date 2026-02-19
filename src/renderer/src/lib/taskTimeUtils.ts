import type { Task, TaskStatus } from '../types/ui'

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const DAY_MINUTES = 24 * 60
const LUNCH_BREAK_START_MINUTES = 12 * 60
const LUNCH_BREAK_END_MINUTES = 13 * 60

const overlapMinutes = (
  startA: number,
  endA: number,
  startB: number,
  endB: number
): number => {
  const start = Math.max(startA, startB)
  const end = Math.min(endA, endB)
  return Math.max(0, end - start)
}

const normalizeRangeEnd = (start: number, end: number): number => {
  if (end < start) return end + DAY_MINUTES
  return end
}

const calculateLunchBreakOverlapForDayRange = (start: number, end: number): number => {
  const normalizedEnd = normalizeRangeEnd(start, end)
  let lunchOverlap = overlapMinutes(
    start,
    normalizedEnd,
    LUNCH_BREAK_START_MINUTES,
    LUNCH_BREAK_END_MINUTES
  )

  // 終了が翌日に跨る場合は翌日の昼休憩帯との重なりも見る
  if (normalizedEnd >= DAY_MINUTES) {
    lunchOverlap += overlapMinutes(
      start,
      normalizedEnd,
      DAY_MINUTES + LUNCH_BREAK_START_MINUTES,
      DAY_MINUTES + LUNCH_BREAK_END_MINUTES
    )
  }

  return lunchOverlap
}

const calculateLunchBreakOverlapMs = (startDate: Date, endDate: Date): number => {
  if (endDate <= startDate) return 0

  let total = 0
  const dayCursor = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
    0,
    0,
    0,
    0
  )
  const lastDay = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
    0,
    0,
    0,
    0
  )

  while (dayCursor <= lastDay) {
    const breakStart = new Date(
      dayCursor.getFullYear(),
      dayCursor.getMonth(),
      dayCursor.getDate(),
      12,
      0,
      0,
      0
    )
    const breakEnd = new Date(
      dayCursor.getFullYear(),
      dayCursor.getMonth(),
      dayCursor.getDate(),
      13,
      0,
      0,
      0
    )

    const overlapStart = Math.max(startDate.getTime(), breakStart.getTime())
    const overlapEnd = Math.min(endDate.getTime(), breakEnd.getTime())
    if (overlapEnd > overlapStart) {
      total += overlapEnd - overlapStart
    }

    dayCursor.setDate(dayCursor.getDate() + 1)
  }

  return total
}

export const parseTimeToMinutes = (time: string | null): number | null => {
  if (!time || !TIME_PATTERN.test(time)) return null
  const [hourText, minuteText] = time.split(':')
  return Number(hourText) * 60 + Number(minuteText)
}

export const formatMinutesToTime = (minutes: number): string => {
  const normalized = ((Math.floor(minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hour = String(Math.floor(normalized / 60)).padStart(2, '0')
  const minute = String(normalized % 60).padStart(2, '0')
  return `${hour}:${minute}`
}

export const formatMinutesAsHourMinute = (minutes: number): string => {
  const normalized = Math.max(0, Math.floor(minutes))
  const hours = Math.floor(normalized / 60)
  const remainMinutes = normalized % 60
  return `${hours}時間${remainMinutes}分`
}

// 分を小数時間の値へ変換する（末尾の 0 は除去）
export const formatMinutesAsDecimalHoursValue = (minutes: number): string => {
  const normalized = Math.max(0, Math.floor(minutes))
  const decimalValue = Math.round((normalized / 60) * 100) / 100
  return decimalValue.toFixed(2)
}

// 分を「n.nn時間」形式で表示する
export const formatMinutesAsDecimalHours = (minutes: number): string => {
  return `${formatMinutesAsDecimalHoursValue(minutes)}時間`
}

export const calculateEndTime = (start: string | null, minutes: number): string | null => {
  const startMinutes = parseTimeToMinutes(start)
  const workMinutes = Math.max(0, Math.floor(minutes))
  if (startMinutes === null || workMinutes <= 0) return null

  let cursor = startMinutes
  let remaining = workMinutes

  while (remaining > 0) {
    const minuteInDay = ((cursor % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
    const isLunchMinute =
      minuteInDay >= LUNCH_BREAK_START_MINUTES && minuteInDay < LUNCH_BREAK_END_MINUTES
    if (isLunchMinute) {
      cursor += LUNCH_BREAK_END_MINUTES - minuteInDay
      continue
    }
    cursor += 1
    remaining -= 1
  }

  return formatMinutesToTime(cursor)
}

export const calculateDurationMinutes = (start: string | null, end: string | null): number => {
  const startMinutes = parseTimeToMinutes(start)
  const endMinutes = parseTimeToMinutes(end)
  if (startMinutes === null || endMinutes === null) return 0

  const normalizedEnd = normalizeRangeEnd(startMinutes, endMinutes)
  const rawMinutes = normalizedEnd - startMinutes
  const lunchOverlap = calculateLunchBreakOverlapForDayRange(startMinutes, endMinutes)
  return Math.max(0, rawMinutes - lunchOverlap)
}

// 実績は「開始/終了の差分 - 昼休憩 - 中断時間」で算出する
export const calculateActualDurationMinutes = (
  start: string | null,
  end: string | null,
  suspendMinutes: number
): number => {
  const baseMinutes = calculateDurationMinutes(start, end)
  const normalizedSuspendMinutes = Math.max(0, Math.floor(suspendMinutes))
  return Math.max(0, baseMinutes - normalizedSuspendMinutes)
}

export const calculateElapsedMinutes = (startIso: string, endIso: string): number => {
  const startDate = new Date(startIso)
  const endDate = new Date(endIso)
  const startMs = startDate.getTime()
  const endMs = endDate.getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0
  }

  const rawMs = endMs - startMs
  const lunchBreakMs = calculateLunchBreakOverlapMs(startDate, endDate)
  return Math.max(0, Math.floor((rawMs - lunchBreakMs) / 60000))
}

export const startTaskTracking = (task: Task, nowIso: string): Task => {
  const baseSuspendMinutes = Math.max(0, Math.floor(task.actual.suspendMinutes ?? 0))
  const resumedSuspendMinutes = task.actual.suspendStartedAt
    ? baseSuspendMinutes + calculateElapsedMinutes(task.actual.suspendStartedAt, nowIso)
    : baseSuspendMinutes
  const hasOpenLog = task.actual.logs.some((log) => log.end === null)
  if (hasOpenLog) {
    return {
      ...task,
      status: 'doing',
      actual: {
        ...task.actual,
        suspendMinutes: resumedSuspendMinutes,
        suspendStartedAt: null
      }
    }
  }

  return {
    ...task,
    status: 'doing',
    actual: {
      ...task.actual,
      suspendMinutes: resumedSuspendMinutes,
      suspendStartedAt: null,
      logs: [...task.actual.logs, { start: nowIso, end: null }]
    }
  }
}

// 中断時は open log を閉じた上で、中断開始時刻を保持する
export const suspendTaskTracking = (task: Task, nowIso: string): Task => {
  const baseSuspendMinutes = Math.max(0, Math.floor(task.actual.suspendMinutes ?? 0))
  let addedMinutes = 0
  let updatedLogs = task.actual.logs

  let latestOpenLogIndex = -1
  for (let index = task.actual.logs.length - 1; index >= 0; index -= 1) {
    if (task.actual.logs[index].end === null) {
      latestOpenLogIndex = index
      break
    }
  }

  if (latestOpenLogIndex >= 0) {
    const latestOpenLog = task.actual.logs[latestOpenLogIndex]
    addedMinutes = calculateElapsedMinutes(latestOpenLog.start, nowIso)
    updatedLogs = task.actual.logs.map((log, index) =>
      index === latestOpenLogIndex ? { ...log, end: nowIso } : log
    )
  }

  return {
    ...task,
    status: 'suspend',
    actual: {
      ...task.actual,
      minutes: task.actual.minutes + addedMinutes,
      suspendMinutes: baseSuspendMinutes,
      suspendStartedAt: task.actual.suspendStartedAt ?? nowIso,
      logs: updatedLogs
    }
  }
}

// 再開時は中断時間を加算確定してから実績計測を再開する
export const resumeTaskTracking = (task: Task, nowIso: string): Task => {
  return startTaskTracking(task, nowIso)
}

export const stopTaskTracking = (task: Task, nowIso: string, nextStatus: TaskStatus): Task => {
  const baseSuspendMinutes = Math.max(0, Math.floor(task.actual.suspendMinutes ?? 0))
  let addedMinutes = 0
  let updatedLogs = task.actual.logs

  let latestOpenLogIndex = -1
  for (let index = task.actual.logs.length - 1; index >= 0; index -= 1) {
    if (task.actual.logs[index].end === null) {
      latestOpenLogIndex = index
      break
    }
  }

  if (latestOpenLogIndex >= 0) {
    const latestOpenLog = task.actual.logs[latestOpenLogIndex]
    addedMinutes = calculateElapsedMinutes(latestOpenLog.start, nowIso)
    updatedLogs = task.actual.logs.map((log, index) =>
      index === latestOpenLogIndex ? { ...log, end: nowIso } : log
    )
  }

  const addedSuspendMinutes = task.actual.suspendStartedAt
    ? calculateElapsedMinutes(task.actual.suspendStartedAt, nowIso)
    : 0

  return {
    ...task,
    status: nextStatus,
    actual: {
      minutes: task.actual.minutes + addedMinutes,
      suspendMinutes: baseSuspendMinutes + addedSuspendMinutes,
      suspendStartedAt: null,
      logs: updatedLogs
    }
  }
}
