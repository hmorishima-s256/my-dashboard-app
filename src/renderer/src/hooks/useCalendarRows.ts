import { useCallback, useEffect, useState } from 'react'
import { formatInputDate } from '../lib/dateUtils'
import type { CalendarTableRow, CalendarUpdatePayload, UserProfile } from '../types/ui'
import type { RefObject } from 'react'

type UseCalendarRowsOptions = {
  selectedDateRef: RefObject<string>
}

type UseCalendarRowsResult = {
  rows: CalendarTableRow[]
  lastUpdatedAt: Date | null
  fetchSchedule: (currentUser: UserProfile | null, targetDate: string) => Promise<void>
  clearRows: () => void
}

// 予定一覧の表示状態と同期処理を担当するフック
export const useCalendarRows = ({
  selectedDateRef
}: UseCalendarRowsOptions): UseCalendarRowsResult => {
  const [rows, setRows] = useState<CalendarTableRow[]>([])
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

  useEffect(() => {
    let isMounted = true
    const unsubscribe = window.api.onCalendarUpdated((payload: CalendarUpdatePayload) => {
      if (!isMounted) return
      if (payload.source === 'auto' && selectedDateRef.current !== formatInputDate(new Date())) {
        return
      }
      setRows(payload.events)
      setLastUpdatedAt(new Date(payload.updatedAt))
    })
    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [selectedDateRef])

  const fetchSchedule = useCallback(
    async (currentUser: UserProfile | null, targetDate: string): Promise<void> => {
      if (!currentUser) return
      const events = await window.api.getCalendar(targetDate)
      setRows(events)
      setLastUpdatedAt(new Date())
    },
    []
  )

  const clearRows = (): void => {
    setRows([])
    setLastUpdatedAt(null)
  }

  return {
    rows,
    lastUpdatedAt,
    fetchSchedule,
    clearRows
  }
}
