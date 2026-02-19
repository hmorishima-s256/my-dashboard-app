import { describe, expect, it, vi } from 'vitest'
import { createCalendarPublisher } from '../../src/main/services/calendarPublisher'
import type { CalendarTableRow, UserProfile } from '../../src/shared/contracts'

const user: UserProfile = {
  name: 'Test User',
  email: 'test@example.com',
  iconUrl: ''
}

describe('calendarPublisher', () => {
  it('未ログイン時は取得せず空配列を返す', async () => {
    const getEventsByDate = vi.fn(async () => [])
    const send = vi.fn()

    const publisher = createCalendarPublisher({
      getCurrentUser: () => null,
      getMainWindow: () => ({ isDestroyed: () => false, webContents: { send } }),
      getEventsByDate
    })

    await expect(publisher.fetchAndPublishByDate('2026-02-18', 'manual')).resolves.toEqual([])
    expect(getEventsByDate).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it('取得成功時に calendar-updated を送信する', async () => {
    const rows: CalendarTableRow[] = [
      { calendarName: 'my-calendar', subject: 'meeting', dateTime: '09:00\n10:00' }
    ]
    const getEventsByDate = vi.fn(async () => rows)
    const send = vi.fn()

    const publisher = createCalendarPublisher({
      getCurrentUser: () => user,
      getMainWindow: () => ({ isDestroyed: () => false, webContents: { send } }),
      getEventsByDate
    })

    await expect(publisher.fetchAndPublishByDate('2026-02-18', 'manual')).resolves.toEqual(rows)

    expect(getEventsByDate).toHaveBeenCalledWith('2026-02-18')
    expect(send).toHaveBeenCalledTimes(1)
    const [channel, payload] = send.mock.calls[0] as [
      string,
      { source: string; events: CalendarTableRow[]; updatedAt: string }
    ]
    expect(channel).toBe('calendar-updated')
    expect(payload.events).toEqual(rows)
    expect(payload.source).toBe('manual')
    expect(new Date(payload.updatedAt).toString()).not.toBe('Invalid Date')
  })

  it('取得失敗時は空配列を返し、例外を外へ投げない', async () => {
    const getEventsByDate = vi.fn(async () => {
      throw new Error('fetch failed')
    })
    const send = vi.fn()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const publisher = createCalendarPublisher({
      getCurrentUser: () => user,
      getMainWindow: () => ({ isDestroyed: () => false, webContents: { send } }),
      getEventsByDate
    })

    await expect(publisher.fetchAndPublishByDate('2026-02-18', 'auto')).resolves.toEqual([])
    expect(send).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
  })

  it('空配信は manual ソースで送信する', () => {
    const send = vi.fn()
    const publisher = createCalendarPublisher({
      getCurrentUser: () => user,
      getMainWindow: () => ({ isDestroyed: () => false, webContents: { send } }),
      getEventsByDate: async () => []
    })

    publisher.publishEmptyManualUpdate()
    expect(send).toHaveBeenCalledTimes(1)
    const [channel, payload] = send.mock.calls[0] as [
      string,
      { source: string; events: CalendarTableRow[] }
    ]
    expect(channel).toBe('calendar-updated')
    expect(payload.events).toEqual([])
    expect(payload.source).toBe('manual')
  })
})
