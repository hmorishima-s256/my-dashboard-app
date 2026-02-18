import type { AppSettings, UserProfile } from '../../shared/contracts'

type AutoFetchSchedulerDependencies = {
  getCurrentUser: () => UserProfile | null
  getSettings: () => AppSettings
  getLastAutoFetchDateKey: () => string | null
  setLastAutoFetchDateKey: (value: string | null) => void
  getLastIntervalFetchAtMs: () => number | null
  setLastIntervalFetchAtMs: (value: number | null) => void
  fetchByDate: (targetDate: string, source: 'auto') => Promise<void>
}

const pad2 = (value: number): string => String(value).padStart(2, '0')
const buildDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
const buildTimeKey = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`

// 自動取得の判定と実行を担当するサービス
export const createAutoFetchScheduler = (dependencies: AutoFetchSchedulerDependencies) => {
  let timer: NodeJS.Timeout | null = null

  const runAutoFetchIfNeeded = async (): Promise<void> => {
    if (!dependencies.getCurrentUser()) return

    const settings = dependencies.getSettings()
    const hasDailyTime = !!settings.autoFetchTime
    const hasInterval = !!settings.autoFetchIntervalMinutes
    if (!hasDailyTime && !hasInterval) return

    const now = new Date()
    const nowMs = now.getTime()

    let shouldFetch = false

    if (hasDailyTime && settings.autoFetchTime) {
      const todayKey = buildDateKey(now)
      const isTargetTime = buildTimeKey(now) === settings.autoFetchTime
      if (isTargetTime && dependencies.getLastAutoFetchDateKey() !== todayKey) {
        shouldFetch = true
        dependencies.setLastAutoFetchDateKey(todayKey)
      }
    }

    if (!shouldFetch && hasInterval && settings.autoFetchIntervalMinutes) {
      const intervalMs = settings.autoFetchIntervalMinutes * 60 * 1000
      const lastIntervalFetchAtMs = dependencies.getLastIntervalFetchAtMs()
      const shouldRunByInterval =
        lastIntervalFetchAtMs === null || nowMs - lastIntervalFetchAtMs >= intervalMs
      if (shouldRunByInterval) {
        shouldFetch = true
      }
    }

    if (!shouldFetch) return

    await dependencies.fetchByDate(buildDateKey(now), 'auto')
    dependencies.setLastIntervalFetchAtMs(nowMs)
  }

  const start = (): void => {
    if (timer) {
      clearInterval(timer)
    }

    timer = setInterval(() => {
      void runAutoFetchIfNeeded()
    }, 30 * 1000)

    void runAutoFetchIfNeeded()
  }

  const stop = (): void => {
    if (!timer) return
    clearInterval(timer)
    timer = null
  }

  const resetRunState = (): void => {
    dependencies.setLastAutoFetchDateKey(null)
    dependencies.setLastIntervalFetchAtMs(null)
  }

  return {
    start,
    stop,
    resetRunState
  }
}
