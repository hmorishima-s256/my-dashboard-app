import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutoFetchScheduler } from '../../src/main/services/autoFetchScheduler'
import type { AppSettings, UserProfile } from '../../src/shared/contracts'

type SchedulerContext = {
  scheduler: ReturnType<typeof createAutoFetchScheduler>
  fetchByDate: ReturnType<typeof vi.fn>
  getLastAutoFetchDateKey: () => string | null
  getLastIntervalFetchAtMs: () => number | null
}

const user: UserProfile = {
  name: 'Test User',
  email: 'test@example.com',
  iconUrl: ''
}

const flushMicroTasks = async (): Promise<void> => {
  await Promise.resolve()
}

const createContext = (settings: AppSettings, currentUser: UserProfile | null): SchedulerContext => {
  let lastAutoFetchDateKey: string | null = null
  let lastIntervalFetchAtMs: number | null = null
  const fetchByDate = vi.fn(async () => {})

  const scheduler = createAutoFetchScheduler({
    getCurrentUser: () => currentUser,
    getSettings: () => settings,
    getLastAutoFetchDateKey: () => lastAutoFetchDateKey,
    setLastAutoFetchDateKey: (value) => {
      lastAutoFetchDateKey = value
    },
    getLastIntervalFetchAtMs: () => lastIntervalFetchAtMs,
    setLastIntervalFetchAtMs: (value) => {
      lastIntervalFetchAtMs = value
    },
    fetchByDate
  })

  return {
    scheduler,
    fetchByDate,
    getLastAutoFetchDateKey: () => lastAutoFetchDateKey,
    getLastIntervalFetchAtMs: () => lastIntervalFetchAtMs
  }
}

describe('autoFetchScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('未ログイン時は自動取得しない', async () => {
    vi.setSystemTime(new Date(2026, 1, 18, 9, 30, 0))
    const context = createContext({ autoFetchTime: '09:30', autoFetchIntervalMinutes: 10 }, null)

    context.scheduler.start()
    await flushMicroTasks()

    expect(context.fetchByDate).not.toHaveBeenCalled()
    context.scheduler.stop()
  })

  it('指定時刻に1日1回だけ自動取得する', async () => {
    vi.setSystemTime(new Date(2026, 1, 18, 9, 30, 0))
    const context = createContext({ autoFetchTime: '09:30', autoFetchIntervalMinutes: null }, user)

    context.scheduler.start()
    await flushMicroTasks()

    expect(context.fetchByDate).toHaveBeenCalledTimes(1)
    expect(context.fetchByDate).toHaveBeenCalledWith('2026-02-18', 'auto')
    expect(context.getLastAutoFetchDateKey()).toBe('2026-02-18')

    await vi.advanceTimersByTimeAsync(30 * 1000)
    await flushMicroTasks()

    expect(context.fetchByDate).toHaveBeenCalledTimes(1)
    context.scheduler.stop()
  })

  it('指定間隔経過で自動取得する', async () => {
    vi.setSystemTime(new Date(2026, 1, 18, 9, 0, 0))
    const context = createContext({ autoFetchTime: null, autoFetchIntervalMinutes: 10 }, user)

    context.scheduler.start()
    await flushMicroTasks()

    expect(context.fetchByDate).toHaveBeenCalledTimes(1)
    expect(context.getLastIntervalFetchAtMs()).not.toBeNull()

    await vi.advanceTimersByTimeAsync(9 * 60 * 1000 + 59 * 1000)
    await flushMicroTasks()
    expect(context.fetchByDate).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    await flushMicroTasks()
    expect(context.fetchByDate).toHaveBeenCalledTimes(2)
    context.scheduler.stop()
  })

  it('実行状態リセットで日次・間隔の状態を初期化する', () => {
    vi.setSystemTime(new Date(2026, 1, 18, 9, 0, 0))
    const context = createContext({ autoFetchTime: '09:00', autoFetchIntervalMinutes: 5 }, user)

    context.scheduler.resetRunState()

    expect(context.getLastAutoFetchDateKey()).toBeNull()
    expect(context.getLastIntervalFetchAtMs()).toBeNull()
  })
})
