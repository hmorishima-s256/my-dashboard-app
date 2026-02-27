import { describe, expect, it } from 'vitest'
import type { Task, TaskMonthlyProjectActualsResponse } from '../../src/shared/contracts'
import {
  ALL_TASK_PRIORITY_FILTER,
  ALL_TASK_STATUS_FILTER,
  filterMonthlyCategoryActuals,
  filterMonthlyProjectActuals,
  filterMonthlyTitleActuals,
  filterTasks,
  matchesMinutesRange,
  normalizeSearchKeyword,
  parseFilterMinutesText,
  sortMonthlyProjectActuals,
  sortTasks
} from '../../src/renderer/src/lib/taskBoardSearchSort'

type TaskOverride = Omit<Partial<Task>, 'estimated' | 'actual'> & {
  estimated?: Partial<Task['estimated']>
  actual?: Partial<Task['actual']>
}

const createTask = (override: TaskOverride = {}): Task => {
  const base: Task = {
    id: 'task-1',
    userId: 'user@example.com',
    date: '2026-02-18',
    project: 'Project-A',
    category: 'Design',
    title: 'API Spec',
    status: 'todo',
    priority: '中',
    memo: '',
    estimated: {
      start: '09:00',
      end: '10:00',
      minutes: 60
    },
    actual: {
      minutes: 30,
      suspendMinutes: 0,
      suspendStartedAt: null,
      logs: []
    },
    createdAt: '2026-02-18T00:00:00.000Z',
    updatedAt: '2026-02-18T00:00:00.000Z'
  }

  return {
    ...base,
    ...override,
    estimated: {
      ...base.estimated,
      ...override.estimated
    },
    actual: {
      ...base.actual,
      ...override.actual,
      logs: override.actual?.logs ?? base.actual.logs
    }
  }
}

describe('taskBoardSearchSort', () => {
  it('検索キーワードを正規化し、分フィルタ入力を分へ変換できる', () => {
    expect(normalizeSearchKeyword('  Project-A  ')).toBe('project-a')
    expect(parseFilterMinutesText('１２．９')).toBe(12)
    expect(parseFilterMinutesText('-1')).toBeNull()
    expect(parseFilterMinutesText('')).toBeNull()
  })

  it('分フィルタの範囲判定を行える', () => {
    expect(matchesMinutesRange(60, 30, 120)).toBe(true)
    expect(matchesMinutesRange(20, 30, 120)).toBe(false)
    expect(matchesMinutesRange(140, 30, 120)).toBe(false)
    expect(matchesMinutesRange(45, null, null)).toBe(true)
  })

  it('タスクをキーワード・ステータス・優先度・時間条件で絞り込みできる', () => {
    const tasks: Task[] = [
      createTask({
        id: 'task-1',
        project: 'Project-A',
        category: 'Design',
        title: 'API Spec',
        status: 'doing',
        priority: '高',
        estimated: { minutes: 120 },
        actual: { minutes: 90 }
      }),
      createTask({
        id: 'task-2',
        project: 'Project-B',
        category: 'QA',
        title: 'UI Test',
        status: 'todo',
        priority: '中',
        estimated: { minutes: 60 },
        actual: { minutes: 30 }
      }),
      createTask({
        id: 'task-3',
        project: 'Project-C',
        category: 'Ops',
        title: 'Release',
        status: 'finished',
        priority: '緊急',
        estimated: { minutes: 180 },
        actual: { minutes: 150 }
      })
    ]

    const filtered = filterTasks(tasks, {
      keyword: normalizeSearchKeyword('project-a'),
      statusFilter: 'doing',
      priorityFilter: '高',
      estimatedMin: 100,
      estimatedMax: 180,
      actualMin: 80,
      actualMax: 100
    })

    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('task-1')
  })

  it('タスクは絞り込み条件が未指定なら全件一致する', () => {
    const tasks: Task[] = [
      createTask({ id: 'task-1', title: 'A' }),
      createTask({ id: 'task-2', title: 'B', project: 'Project-B' })
    ]

    const filtered = filterTasks(tasks, {
      keyword: '',
      statusFilter: ALL_TASK_STATUS_FILTER,
      priorityFilter: ALL_TASK_PRIORITY_FILTER,
      estimatedMin: null,
      estimatedMax: null,
      actualMin: null,
      actualMax: null
    })

    expect(filtered.map((task) => task.id)).toEqual(['task-1', 'task-2'])
  })

  it('タスク一覧を優先度・実績時間でソートできる', () => {
    const tasks: Task[] = [
      createTask({ id: 'task-a', priority: '低', actual: { minutes: 20 } }),
      createTask({ id: 'task-b', priority: '緊急', actual: { minutes: 30 } }),
      createTask({ id: 'task-c', priority: '中', actual: { minutes: 10 } })
    ]

    const sortedByPriority = sortTasks(tasks, 'priority', 'asc')
    expect(sortedByPriority.map((task) => task.id)).toEqual(['task-b', 'task-c', 'task-a'])

    const sortedByActualDesc = sortTasks(tasks, 'actualMinutes', 'desc')
    expect(sortedByActualDesc.map((task) => task.id)).toEqual(['task-b', 'task-a', 'task-c'])
  })

  it('案件別集計をキーワードと時間条件で絞り込みできる', () => {
    const projectActuals: TaskMonthlyProjectActualsResponse['projectActuals'] = [
      { project: 'Project-A', actualMinutes: 120, estimatedMinutes: 90 },
      { project: 'Project-B', actualMinutes: 30, estimatedMinutes: 180 },
      { project: 'Project-C', actualMinutes: 90, estimatedMinutes: 60 }
    ]

    const filtered = filterMonthlyProjectActuals(
      projectActuals,
      normalizeSearchKeyword('project-b'),
      20,
      40,
      100,
      200
    )

    expect(filtered).toEqual([{ project: 'Project-B', actualMinutes: 30, estimatedMinutes: 180 }])
  })

  it('カテゴリ別/タスク別集計も同条件で絞り込みできる', () => {
    const categoryActuals: TaskMonthlyProjectActualsResponse['categoryActuals'] = [
      { project: 'Project-A', category: 'Design', actualMinutes: 120, estimatedMinutes: 90 },
      { project: 'Project-B', category: 'QA', actualMinutes: 30, estimatedMinutes: 180 }
    ]
    const titleActuals: TaskMonthlyProjectActualsResponse['titleActuals'] = [
      {
        project: 'Project-A',
        category: 'Design',
        title: 'API Spec',
        actualMinutes: 120,
        estimatedMinutes: 90
      },
      {
        project: 'Project-B',
        category: 'QA',
        title: 'UI Test',
        actualMinutes: 30,
        estimatedMinutes: 180
      }
    ]

    const filteredCategory = filterMonthlyCategoryActuals(
      categoryActuals,
      normalizeSearchKeyword('qa'),
      20,
      40,
      100,
      200
    )
    const filteredTitle = filterMonthlyTitleActuals(
      titleActuals,
      normalizeSearchKeyword('ui test'),
      20,
      40,
      100,
      200
    )

    expect(filteredCategory).toEqual([
      { project: 'Project-B', category: 'QA', actualMinutes: 30, estimatedMinutes: 180 }
    ])
    expect(filteredTitle).toEqual([
      {
        project: 'Project-B',
        category: 'QA',
        title: 'UI Test',
        actualMinutes: 30,
        estimatedMinutes: 180
      }
    ])
  })

  it('案件別集計を指定カラムでソートでき、同値は案件名で安定化する', () => {
    const projectActuals: TaskMonthlyProjectActualsResponse['projectActuals'] = [
      { project: 'Project-B', actualMinutes: 90, estimatedMinutes: 60 },
      { project: 'Project-A', actualMinutes: 90, estimatedMinutes: 120 },
      { project: 'Project-C', actualMinutes: 30, estimatedMinutes: 30 }
    ]

    const sortedByActualDesc = sortMonthlyProjectActuals(projectActuals, 'actualMinutes', 'desc')
    expect(sortedByActualDesc.map((item) => item.project)).toEqual([
      'Project-A',
      'Project-B',
      'Project-C'
    ])

    const sortedByEstimatedAsc = sortMonthlyProjectActuals(
      projectActuals,
      'estimatedMinutes',
      'asc'
    )
    expect(sortedByEstimatedAsc.map((item) => item.project)).toEqual([
      'Project-C',
      'Project-B',
      'Project-A'
    ])
  })
})
