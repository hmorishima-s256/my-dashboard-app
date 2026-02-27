import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import { getUserSettingsDir } from '../googleAuth'
import { GUEST_USER_ID } from '../../shared/contracts'
import type {
  CategoryMonthlyActual,
  ProjectMonthlyActual,
  Task,
  TaskActualLog,
  TaskCreateInput,
  TaskListResponse,
  TaskMonthlyProjectActualsResponse,
  TaskPriority,
  TaskSchema,
  TaskStatus,
  TitleMonthlyActual,
  UserProfile
} from '../../shared/contracts'

type TaskStoreServiceDependencies = {
  getCurrentUser: () => UserProfile | null
  createId?: () => string
  getNow?: () => Date
}

type TaskStoreService = {
  getAll: (date: string) => Promise<TaskListResponse>
  getMonthlyProjectActuals: (period: string) => Promise<TaskMonthlyProjectActualsResponse>
  add: (input: TaskCreateInput) => Promise<Task>
  update: (task: Task) => Promise<Task | null>
  remove: (taskId: string) => Promise<boolean>
  clearGuestData: () => Promise<void>
}

const TASK_FILE_NAME = 'tasks.json'
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const YEAR_PATTERN = /^\d{4}$/
const MONTH_PATTERN = /^\d{4}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const TASK_STATUS_SET: Set<TaskStatus> = new Set([
  'todo',
  'doing',
  'suspend',
  'done',
  'carryover',
  'finished'
])
const TASK_PRIORITY_SET: Set<TaskPriority> = new Set(['緊急', '高', '中', '低'])

const createDefaultTaskSchema = (): TaskSchema => ({
  tasks: [],
  projects: [],
  categories: []
})

const normalizeText = (value: string): string => value.trim()

const normalizeDate = (value: string): string => {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`Invalid task date: ${value}`)
  }
  return value
}

const normalizePeriod = (value: string): { period: string; periodUnit: 'month' | 'year' } => {
  if (MONTH_PATTERN.test(value)) {
    return { period: value, periodUnit: 'month' }
  }
  if (YEAR_PATTERN.test(value)) {
    return { period: value, periodUnit: 'year' }
  }
  throw new Error(`Invalid task period: ${value}`)
}

const normalizeTimeValue = (value: string | null | undefined): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return TIME_PATTERN.test(trimmed) ? trimmed : null
}

const normalizeMinutes = (value: number | null | undefined): number => {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return 0
  }
  return Math.floor(value)
}

const normalizeIsoValue = (value: string | null | undefined): string | null => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

const normalizeActualLogs = (logs: TaskActualLog[] | undefined): TaskActualLog[] => {
  if (!Array.isArray(logs)) return []
  return logs.filter(
    (log) =>
      typeof log.start === 'string' &&
      !!log.start &&
      !Number.isNaN(new Date(log.start).getTime()) &&
      (log.end === null ||
        (typeof log.end === 'string' && !Number.isNaN(new Date(log.end).getTime())))
  )
}

const normalizeStatus = (value: TaskStatus | undefined): TaskStatus =>
  value && TASK_STATUS_SET.has(value) ? value : 'todo'

const normalizePriority = (value: TaskPriority): TaskPriority =>
  TASK_PRIORITY_SET.has(value) ? value : '中'

const sortUnique = (items: string[]): string[] =>
  Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, 'ja'))

const upsertMaster = (list: string[], value: string): string[] => {
  const normalized = normalizeText(value)
  if (!normalized) return list
  return sortUnique([...list, normalized])
}

const sanitizeTaskCreateInput = (input: TaskCreateInput): TaskCreateInput => {
  const project = normalizeText(input.project)
  const title = normalizeText(input.title)
  if (!project) {
    throw new Error('project is required')
  }
  if (!title) {
    throw new Error('title is required')
  }

  return {
    date: normalizeDate(input.date),
    project,
    category: normalizeText(input.category),
    title,
    status: normalizeStatus(input.status),
    priority: normalizePriority(input.priority),
    memo: normalizeText(input.memo),
    estimated: {
      start: normalizeTimeValue(input.estimated.start),
      end: normalizeTimeValue(input.estimated.end),
      minutes: normalizeMinutes(input.estimated.minutes)
    },
    actual: {
      minutes: normalizeMinutes(input.actual?.minutes),
      suspendMinutes: normalizeMinutes(input.actual?.suspendMinutes),
      suspendStartedAt: normalizeIsoValue(input.actual?.suspendStartedAt),
      logs: normalizeActualLogs(input.actual?.logs)
    }
  }
}

const sanitizeTaskForUpdate = (task: Task, userId: string): Task => {
  const project = normalizeText(task.project)
  const title = normalizeText(task.title)
  if (!project) {
    throw new Error('project is required')
  }
  if (!title) {
    throw new Error('title is required')
  }

  return {
    ...task,
    userId,
    date: normalizeDate(task.date),
    project,
    category: normalizeText(task.category),
    title,
    status: normalizeStatus(task.status),
    priority: normalizePriority(task.priority),
    memo: normalizeText(task.memo),
    estimated: {
      start: normalizeTimeValue(task.estimated.start),
      end: normalizeTimeValue(task.estimated.end),
      minutes: normalizeMinutes(task.estimated.minutes)
    },
    actual: {
      minutes: normalizeMinutes(task.actual.minutes),
      suspendMinutes: normalizeMinutes(task.actual.suspendMinutes),
      suspendStartedAt: normalizeIsoValue(task.actual.suspendStartedAt),
      logs: normalizeActualLogs(task.actual.logs)
    }
  }
}

const normalizeTaskRecord = (task: Task): Task => ({
  ...task,
  actual: {
    minutes: normalizeMinutes(task.actual?.minutes),
    suspendMinutes: normalizeMinutes(task.actual?.suspendMinutes),
    suspendStartedAt: normalizeIsoValue(task.actual?.suspendStartedAt),
    logs: normalizeActualLogs(task.actual?.logs)
  }
})

const createDb = (filePath: string): Low<TaskSchema> => {
  const adapter = new JSONFile<TaskSchema>(filePath)
  return new Low<TaskSchema>(adapter, createDefaultTaskSchema())
}

const buildProjectScopedMasters = (
  tasks: Task[]
): {
  projectCategories: Record<string, string[]>
  projectTitles: Record<string, string[]>
} => {
  const categoryMap = new Map<string, Set<string>>()
  const titleMap = new Map<string, Set<string>>()

  tasks.forEach((task) => {
    const projectKey = normalizeText(task.project)
    if (!projectKey) return

    if (!categoryMap.has(projectKey)) categoryMap.set(projectKey, new Set<string>())
    if (!titleMap.has(projectKey)) titleMap.set(projectKey, new Set<string>())

    if (task.category.trim()) {
      categoryMap.get(projectKey)?.add(task.category.trim())
    }
    if (task.title.trim()) {
      titleMap.get(projectKey)?.add(task.title.trim())
    }
  })

  const projectCategories: Record<string, string[]> = {}
  const projectTitles: Record<string, string[]> = {}
  for (const [project, categories] of categoryMap.entries()) {
    projectCategories[project] = Array.from(categories).sort((a, b) => a.localeCompare(b, 'ja'))
  }
  for (const [project, titles] of titleMap.entries()) {
    projectTitles[project] = Array.from(titles).sort((a, b) => a.localeCompare(b, 'ja'))
  }

  return { projectCategories, projectTitles }
}

const buildTaskListResponse = (schema: TaskSchema, date: string): TaskListResponse => {
  const { projectCategories, projectTitles } = buildProjectScopedMasters(schema.tasks)
  return {
    tasks: schema.tasks
      .filter((task) => task.date === date)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    projects: sortUnique(schema.projects),
    categories: sortUnique(schema.categories),
    projectCategories,
    projectTitles
  }
}

const buildMonthlyProjectActualsResponse = (
  schema: TaskSchema,
  period: string,
  periodUnit: 'month' | 'year'
): TaskMonthlyProjectActualsResponse => {
  const projectSummaryMap = new Map<string, { actualMinutes: number; estimatedMinutes: number }>()
  const categorySummaryMap = new Map<string, { actualMinutes: number; estimatedMinutes: number }>()
  const titleSummaryMap = new Map<string, { actualMinutes: number; estimatedMinutes: number }>()
  const periodPrefix = `${period}-`
  schema.tasks.forEach((task) => {
    if (!task.date.startsWith(periodPrefix)) return
    const projectName = normalizeText(task.project)
    if (!projectName) return
    const categoryName = normalizeText(task.category) || '-'
    const titleName = normalizeText(task.title) || '-'
    const currentSummary = projectSummaryMap.get(projectName) ?? {
      actualMinutes: 0,
      estimatedMinutes: 0
    }
    projectSummaryMap.set(projectName, {
      actualMinutes: currentSummary.actualMinutes + task.actual.minutes,
      estimatedMinutes: currentSummary.estimatedMinutes + task.estimated.minutes
    })

    const categoryKey = `${projectName}\u0000${categoryName}`
    const currentCategorySummary = categorySummaryMap.get(categoryKey) ?? {
      actualMinutes: 0,
      estimatedMinutes: 0
    }
    categorySummaryMap.set(categoryKey, {
      actualMinutes: currentCategorySummary.actualMinutes + task.actual.minutes,
      estimatedMinutes: currentCategorySummary.estimatedMinutes + task.estimated.minutes
    })

    const titleKey = `${projectName}\u0000${categoryName}\u0000${titleName}`
    const currentTitleSummary = titleSummaryMap.get(titleKey) ?? {
      actualMinutes: 0,
      estimatedMinutes: 0
    }
    titleSummaryMap.set(titleKey, {
      actualMinutes: currentTitleSummary.actualMinutes + task.actual.minutes,
      estimatedMinutes: currentTitleSummary.estimatedMinutes + task.estimated.minutes
    })
  })

  const projectActuals: ProjectMonthlyActual[] = Array.from(projectSummaryMap.entries())
    .map(([project, summary]) => ({
      project,
      actualMinutes: summary.actualMinutes,
      estimatedMinutes: summary.estimatedMinutes
    }))
    .sort((a, b) => a.project.localeCompare(b.project, 'ja'))

  const categoryActuals: CategoryMonthlyActual[] = Array.from(categorySummaryMap.entries())
    .map(([key, summary]) => {
      const [project, category] = key.split('\u0000')
      return {
        project,
        category,
        actualMinutes: summary.actualMinutes,
        estimatedMinutes: summary.estimatedMinutes
      }
    })
    .sort((a, b) => {
      const comparedProject = a.project.localeCompare(b.project, 'ja')
      if (comparedProject !== 0) return comparedProject
      return a.category.localeCompare(b.category, 'ja')
    })

  const titleActuals: TitleMonthlyActual[] = Array.from(titleSummaryMap.entries())
    .map(([key, summary]) => {
      const [project, category, title] = key.split('\u0000')
      return {
        project,
        category,
        title,
        actualMinutes: summary.actualMinutes,
        estimatedMinutes: summary.estimatedMinutes
      }
    })
    .sort((a, b) => {
      const comparedProject = a.project.localeCompare(b.project, 'ja')
      if (comparedProject !== 0) return comparedProject
      const comparedCategory = a.category.localeCompare(b.category, 'ja')
      if (comparedCategory !== 0) return comparedCategory
      return a.title.localeCompare(b.title, 'ja')
    })

  return {
    period,
    periodUnit,
    projectActuals,
    categoryActuals,
    titleActuals
  }
}

// lowdb を利用したタスク保存サービス（ログインユーザーは永続、ゲストはセッション限定）
export const createTaskStoreService = (
  dependencies: TaskStoreServiceDependencies
): TaskStoreService => {
  const getNow = dependencies.getNow ?? (() => new Date())
  const createId = dependencies.createId ?? (() => crypto.randomUUID())
  const userDbMap = new Map<string, Low<TaskSchema>>()
  const guestDirectoryPath = path.join(os.tmpdir(), 'my-dashboard-app', `guest-${process.pid}`)
  const guestFilePath = path.join(guestDirectoryPath, TASK_FILE_NAME)
  let guestDb: Low<TaskSchema> | null = null

  const resolveUserId = (): string => {
    const currentUser = dependencies.getCurrentUser()
    if (!currentUser?.email) return GUEST_USER_ID
    return currentUser.email
  }

  const getDbByUserId = async (userId: string): Promise<Low<TaskSchema>> => {
    if (userId === GUEST_USER_ID) {
      if (!guestDb) {
        await fs.mkdir(guestDirectoryPath, { recursive: true })
        guestDb = createDb(guestFilePath)
      }
      return guestDb
    }

    const existing = userDbMap.get(userId)
    if (existing) {
      return existing
    }

    const filePath = path.join(getUserSettingsDir(userId), TASK_FILE_NAME)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    const db = createDb(filePath)
    userDbMap.set(userId, db)
    return db
  }

  const getLoadedSchema = async (
    userId: string
  ): Promise<{ userId: string; db: Low<TaskSchema> }> => {
    const db = await getDbByUserId(userId)
    await db.read()
    db.data ||= createDefaultTaskSchema()
    // 旧データとの互換のため、読込時に実績フィールドを正規化する
    db.data.tasks = db.data.tasks.map((task) => normalizeTaskRecord(task))
    db.data.projects = sortUnique(db.data.projects)
    db.data.categories = sortUnique(db.data.categories)
    return { userId, db }
  }

  const getAll = async (date: string): Promise<TaskListResponse> => {
    const userId = resolveUserId()
    const normalizedDate = normalizeDate(date)
    const { db } = await getLoadedSchema(userId)
    return buildTaskListResponse(db.data, normalizedDate)
  }

  const getMonthlyProjectActuals = async (
    period: string
  ): Promise<TaskMonthlyProjectActualsResponse> => {
    const userId = resolveUserId()
    const normalizedPeriod = normalizePeriod(period)
    const { db } = await getLoadedSchema(userId)
    return buildMonthlyProjectActualsResponse(
      db.data,
      normalizedPeriod.period,
      normalizedPeriod.periodUnit
    )
  }

  const add = async (input: TaskCreateInput): Promise<Task> => {
    const userId = resolveUserId()
    const normalizedInput = sanitizeTaskCreateInput(input)
    const { db } = await getLoadedSchema(userId)
    const nowIso = getNow().toISOString()

    const task: Task = {
      id: createId(),
      userId,
      date: normalizedInput.date,
      project: normalizedInput.project,
      category: normalizedInput.category,
      title: normalizedInput.title,
      status: normalizedInput.status || 'todo',
      priority: normalizedInput.priority,
      memo: normalizedInput.memo,
      estimated: normalizedInput.estimated,
      actual: {
        minutes: normalizeMinutes(normalizedInput.actual?.minutes),
        suspendMinutes: normalizeMinutes(normalizedInput.actual?.suspendMinutes),
        suspendStartedAt: normalizeIsoValue(normalizedInput.actual?.suspendStartedAt),
        logs: normalizeActualLogs(normalizedInput.actual?.logs)
      },
      createdAt: nowIso,
      updatedAt: nowIso
    }

    db.data.tasks.push(task)
    db.data.projects = upsertMaster(db.data.projects, task.project)
    db.data.categories = upsertMaster(db.data.categories, task.category)
    await db.write()
    return task
  }

  const update = async (task: Task): Promise<Task | null> => {
    const userId = resolveUserId()
    const { db } = await getLoadedSchema(userId)
    const existingIndex = db.data.tasks.findIndex(
      (item) => item.id === task.id && item.userId === userId
    )
    if (existingIndex < 0) {
      return null
    }

    const sanitizedTask = sanitizeTaskForUpdate(task, userId)
    const existingTask = db.data.tasks[existingIndex]
    const nextTask: Task = {
      ...existingTask,
      ...sanitizedTask,
      createdAt: existingTask.createdAt,
      updatedAt: getNow().toISOString()
    }

    db.data.tasks[existingIndex] = nextTask
    db.data.projects = upsertMaster(db.data.projects, nextTask.project)
    db.data.categories = upsertMaster(db.data.categories, nextTask.category)
    await db.write()
    return nextTask
  }

  const remove = async (taskId: string): Promise<boolean> => {
    const userId = resolveUserId()
    const { db } = await getLoadedSchema(userId)
    const beforeCount = db.data.tasks.length
    db.data.tasks = db.data.tasks.filter((task) => !(task.id === taskId && task.userId === userId))
    if (db.data.tasks.length === beforeCount) {
      return false
    }
    await db.write()
    return true
  }

  const clearGuestData = async (): Promise<void> => {
    guestDb = null
    await fs.rm(guestDirectoryPath, { recursive: true, force: true })
  }

  return {
    getAll,
    getMonthlyProjectActuals,
    add,
    update,
    remove,
    clearGuestData
  }
}
