import type { BrowserWindow } from 'electron'
import type { CalendarTableRow, CalendarUpdatePayload, UserProfile } from '../../shared/contracts'

type CalendarPublisherWindow = Pick<BrowserWindow, 'isDestroyed'> & {
  webContents: Pick<BrowserWindow['webContents'], 'send'>
}

type CalendarPublisherDependencies = {
  getCurrentUser: () => UserProfile | null
  getMainWindow: () => CalendarPublisherWindow | null
  getEventsByDate: (targetDate: string) => Promise<CalendarTableRow[]>
}

type CalendarPublisherService = {
  fetchAndPublishByDate: (
    targetDate: string,
    source: 'manual' | 'auto'
  ) => Promise<CalendarTableRow[]>
  publishEmptyManualUpdate: () => void
}

// 予定取得と Renderer への通知配信を担当するサービス
export const createCalendarPublisher = (
  dependencies: CalendarPublisherDependencies
): CalendarPublisherService => {
  const fetchAndPublishByDate = async (
    targetDate: string,
    source: 'manual' | 'auto'
  ): Promise<CalendarTableRow[]> => {
    if (!dependencies.getCurrentUser()) {
      return []
    }

    try {
      const events = await dependencies.getEventsByDate(targetDate)
      const payload: CalendarUpdatePayload = {
        events,
        updatedAt: new Date().toISOString(),
        source
      }

      const mainWindow = dependencies.getMainWindow()
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('calendar-updated', payload)
      }

      return events
    } catch (error) {
      console.error('Google Calendar Error:', error)
      return []
    }
  }

  const publishEmptyManualUpdate = (): void => {
    const mainWindow = dependencies.getMainWindow()
    if (!mainWindow || mainWindow.isDestroyed()) return

    const payload: CalendarUpdatePayload = {
      events: [],
      updatedAt: new Date().toISOString(),
      source: 'manual'
    }
    mainWindow.webContents.send('calendar-updated', payload)
  }

  return {
    fetchAndPublishByDate,
    publishEmptyManualUpdate
  }
}
