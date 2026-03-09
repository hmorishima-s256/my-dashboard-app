import { useCallback, useEffect, useState } from 'react'
import type { CalendarTableRow, CalendarUpdatePayload, UserProfile } from '../types/ui'
import type { RefObject } from 'react'

type UseCalendarRowsOptions = {
  selectedDateRef: RefObject<string>
  onAutoSyncToday?: (date: string) => void
}

type UseCalendarRowsResult = {
  rows: CalendarTableRow[]
  lastUpdatedAt: Date | null
  fetchError: string | null
  fetchSchedule: (currentUser: UserProfile | null, targetDate: string) => Promise<void>
  clearRows: () => void
}

// 予定一覧の表示状態と同期処理を担当するフック
export const useCalendarRows = ({
  selectedDateRef,
  onAutoSyncToday
}: UseCalendarRowsOptions): UseCalendarRowsResult => {
  const [rows, setRows] = useState<CalendarTableRow[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const unsubscribe = window.api.onCalendarUpdated((payload: CalendarUpdatePayload) => {
      if (!isMounted) return
      if (payload.source === 'auto' && payload.targetDate) {
        onAutoSyncToday?.(payload.targetDate)
      }
      setRows(payload.events)
      setLastUpdatedAt(new Date(payload.updatedAt))
    })
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [onAutoSyncToday, selectedDateRef])

  const fetchSchedule = useCallback(
    async (currentUser: UserProfile | null, targetDate: string): Promise<void> => {
      if (!currentUser) return
      try {
        const events = await window.api.getCalendar(targetDate)
        setRows(events)
        setLastUpdatedAt(new Date())
        setFetchError(null)
      } catch (error) {
        const raw = error instanceof Error ? error.message : ''
        const message = raw.includes('invalid_grant')
          ? 'Googleの認証トークンが期限切れです。一度ログアウトして再ログインしてください。'
          : raw || 'カレンダーの取得に失敗しました'
        setFetchError(message)
      }
    },
    []
  )

  const clearRows = (): void => {
    setRows([])
    setLastUpdatedAt(null)
    setFetchError(null)
  }

  return {
    rows,
    lastUpdatedAt,
    fetchError,
    fetchSchedule,
    clearRows
  }
}
