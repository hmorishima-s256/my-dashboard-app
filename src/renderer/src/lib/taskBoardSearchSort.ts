import type { Task, TaskMonthlyProjectActualsResponse, TaskPriority, TaskStatus } from '../types/ui'

// TaskBoard の検索/絞り込み/ソート判定を集約する
export type MonthlySummarySortKey = 'project' | 'actualMinutes' | 'estimatedMinutes'
export type TaskTableSortKey =
  | 'createdAt'
  | 'projectCategory'
  | 'title'
  | 'status'
  | 'priority'
  | 'estimatedMinutes'
  | 'actualMinutes'
export type SortDirection = 'asc' | 'desc'
export type TaskStatusFilter = TaskStatus | 'all'
export type TaskPriorityFilter = TaskPriority | 'all'

export const ALL_TASK_STATUS_FILTER: TaskStatusFilter = 'all'
export const ALL_TASK_PRIORITY_FILTER: TaskPriorityFilter = 'all'

const TASK_STATUS_SORT_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  doing: 1,
  suspend: 2,
  done: 3,
  carryover: 4,
  finished: 5
}

const TASK_PRIORITY_SORT_ORDER: Record<TaskPriority, number> = {
  緊急: 0,
  高: 1,
  中: 2,
  低: 3
}

const normalizeNumericText = (value: string): string =>
  value
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.')
    .trim()

export const normalizeSearchKeyword = (value: string): string =>
  value.trim().toLocaleLowerCase('ja')

export const matchesSearchKeyword = (keyword: string, fields: string[]): boolean => {
  if (!keyword) return true
  return fields.some((field) => field.toLocaleLowerCase('ja').includes(keyword))
}

export const parseFilterMinutesText = (value: string): number | null => {
  const normalized = normalizeNumericText(value)
  if (!normalized) return null
  const numeric = Number(normalized)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.floor(numeric)
}

export const matchesMinutesRange = (
  minutes: number,
  min: number | null,
  max: number | null
): boolean => {
  if (min !== null && minutes < min) return false
  if (max !== null && minutes > max) return false
  return true
}

export const filterMonthlyProjectActuals = (
  projectActuals: TaskMonthlyProjectActualsResponse['projectActuals'],
  keyword: string,
  actualMin: number | null,
  actualMax: number | null,
  estimatedMin: number | null,
  estimatedMax: number | null
): TaskMonthlyProjectActualsResponse['projectActuals'] =>
  projectActuals.filter((projectActual) => {
    if (!matchesSearchKeyword(keyword, [projectActual.project])) return false
    if (!matchesMinutesRange(projectActual.actualMinutes, actualMin, actualMax)) return false
    if (!matchesMinutesRange(projectActual.estimatedMinutes, estimatedMin, estimatedMax))
      return false
    return true
  })

export const filterMonthlyCategoryActuals = (
  categoryActuals: TaskMonthlyProjectActualsResponse['categoryActuals'],
  keyword: string,
  actualMin: number | null,
  actualMax: number | null,
  estimatedMin: number | null,
  estimatedMax: number | null
): TaskMonthlyProjectActualsResponse['categoryActuals'] =>
  categoryActuals.filter((categoryActual) => {
    if (!matchesSearchKeyword(keyword, [categoryActual.project, categoryActual.category]))
      return false
    if (!matchesMinutesRange(categoryActual.actualMinutes, actualMin, actualMax)) return false
    if (!matchesMinutesRange(categoryActual.estimatedMinutes, estimatedMin, estimatedMax))
      return false
    return true
  })

export const filterMonthlyTitleActuals = (
  titleActuals: TaskMonthlyProjectActualsResponse['titleActuals'],
  keyword: string,
  actualMin: number | null,
  actualMax: number | null,
  estimatedMin: number | null,
  estimatedMax: number | null
): TaskMonthlyProjectActualsResponse['titleActuals'] =>
  titleActuals.filter((titleActual) => {
    if (
      !matchesSearchKeyword(keyword, [titleActual.project, titleActual.category, titleActual.title])
    ) {
      return false
    }
    if (!matchesMinutesRange(titleActual.actualMinutes, actualMin, actualMax)) return false
    if (!matchesMinutesRange(titleActual.estimatedMinutes, estimatedMin, estimatedMax)) return false
    return true
  })

export const sortMonthlyProjectActuals = (
  projectActuals: TaskMonthlyProjectActualsResponse['projectActuals'],
  sortKey: MonthlySummarySortKey,
  sortDirection: SortDirection
): TaskMonthlyProjectActualsResponse['projectActuals'] => {
  const direction = sortDirection === 'asc' ? 1 : -1
  return [...projectActuals].sort((left, right) => {
    let comparedValue = 0
    if (sortKey === 'project') {
      comparedValue = left.project.localeCompare(right.project, 'ja')
    } else if (sortKey === 'actualMinutes') {
      comparedValue = left.actualMinutes - right.actualMinutes
    } else {
      comparedValue = left.estimatedMinutes - right.estimatedMinutes
    }
    if (comparedValue !== 0) {
      return comparedValue * direction
    }
    return left.project.localeCompare(right.project, 'ja')
  })
}

type FilterTaskParams = {
  keyword: string
  statusFilter: TaskStatusFilter
  priorityFilter: TaskPriorityFilter
  estimatedMin: number | null
  estimatedMax: number | null
  actualMin: number | null
  actualMax: number | null
}

export const filterTasks = (tasks: Task[], params: FilterTaskParams): Task[] =>
  tasks.filter((task) => {
    if (!matchesSearchKeyword(params.keyword, [task.project, task.category, task.title])) {
      return false
    }
    if (params.statusFilter !== ALL_TASK_STATUS_FILTER && task.status !== params.statusFilter) {
      return false
    }
    if (
      params.priorityFilter !== ALL_TASK_PRIORITY_FILTER &&
      task.priority !== params.priorityFilter
    ) {
      return false
    }
    if (!matchesMinutesRange(task.estimated.minutes, params.estimatedMin, params.estimatedMax)) {
      return false
    }
    if (!matchesMinutesRange(task.actual.minutes, params.actualMin, params.actualMax)) {
      return false
    }
    return true
  })

export const sortTasks = (
  tasks: Task[],
  sortKey: TaskTableSortKey,
  sortDirection: SortDirection
): Task[] => {
  const direction = sortDirection === 'asc' ? 1 : -1
  return [...tasks].sort((left, right) => {
    let comparedValue = 0
    switch (sortKey) {
      case 'createdAt': {
        comparedValue = left.createdAt.localeCompare(right.createdAt)
        break
      }
      case 'projectCategory': {
        comparedValue = left.project.localeCompare(right.project, 'ja')
        if (comparedValue === 0) {
          comparedValue = left.category.localeCompare(right.category, 'ja')
        }
        break
      }
      case 'title': {
        comparedValue = left.title.localeCompare(right.title, 'ja')
        break
      }
      case 'status': {
        comparedValue = TASK_STATUS_SORT_ORDER[left.status] - TASK_STATUS_SORT_ORDER[right.status]
        break
      }
      case 'priority': {
        comparedValue =
          TASK_PRIORITY_SORT_ORDER[left.priority] - TASK_PRIORITY_SORT_ORDER[right.priority]
        break
      }
      case 'estimatedMinutes': {
        comparedValue = left.estimated.minutes - right.estimated.minutes
        break
      }
      case 'actualMinutes': {
        comparedValue = left.actual.minutes - right.actual.minutes
        break
      }
    }

    if (comparedValue !== 0) {
      return comparedValue * direction
    }
    const createdAtCompared = left.createdAt.localeCompare(right.createdAt)
    if (createdAtCompared !== 0) {
      return createdAtCompared
    }
    return left.id.localeCompare(right.id)
  })
}
