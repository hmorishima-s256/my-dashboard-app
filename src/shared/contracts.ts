// Main / Preload / Renderer 間で共有する契約型

export type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

export type AppSettings = {
  autoFetchTime: string | null
  autoFetchIntervalMinutes: number | null
  taskTimeDisplayMode: TaskTimeDisplayMode
}

export type UserProfile = {
  name: string
  email: string
  iconUrl: string
}

export type AuthLoginResult = {
  success: boolean
  user: UserProfile | null
  message: string
}

export type AuthLogoutResult = {
  success: boolean
  message?: string
}

export type CalendarUpdatePayload = {
  events: CalendarTableRow[]
  updatedAt: string
  source: 'manual' | 'auto'
}

// タスク時間の表示形式
export type TaskTimeDisplayMode = 'hourMinute' | 'decimal'

// 未ログイン時に使うゲストユーザーID
export const GUEST_USER_ID = 'guest'

// タスクの進捗状態
export type TaskStatus = 'todo' | 'doing' | 'suspend' | 'done' | 'carryover' | 'finished'

// 優先度
export type TaskPriority = '緊急' | '高' | '中' | '低'

export type TaskActualLog = {
  start: string
  end: string | null
}

export type Task = {
  id: string
  userId: string
  date: string
  project: string
  category: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  memo: string
  estimated: {
    start: string | null
    end: string | null
    minutes: number
  }
  actual: {
    minutes: number
    logs: TaskActualLog[]
  }
  createdAt: string
  updatedAt: string
}

export type TaskCreateInput = {
  date: string
  project: string
  category: string
  title: string
  status?: TaskStatus
  priority: TaskPriority
  memo: string
  estimated: {
    start: string | null
    end: string | null
    minutes: number
  }
  actual?: {
    minutes: number
    logs?: TaskActualLog[]
  }
}

export type TaskSchema = {
  tasks: Task[]
  projects: string[]
  categories: string[]
}

export type TaskListResponse = {
  tasks: Task[]
  projects: string[]
  categories: string[]
  projectCategories: Record<string, string[]>
  projectTitles: Record<string, string[]>
}
