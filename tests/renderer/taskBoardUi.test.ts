// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TaskBoard } from '../../src/renderer/src/components/TaskBoard'
import type {
  Task,
  TaskListResponse,
  TaskMonthlyProjectActualsResponse
} from '../../src/shared/contracts'

vi.mock('react-select/creatable', () => ({
  default: () => null
}))

type TaskApiMock = {
  taskGetAll: ReturnType<typeof vi.fn>
  taskGetMonthlyProjectActuals: ReturnType<typeof vi.fn>
  taskUpdate: ReturnType<typeof vi.fn>
  taskAdd: ReturnType<typeof vi.fn>
  taskDelete: ReturnType<typeof vi.fn>
}

const createTask = (overrides: Partial<Task> = {}): Task => {
  const base: Task = {
    id: 'task-1',
    userId: 'guest',
    date: '2026-02-18',
    project: 'Project-X',
    category: 'Category-A',
    title: 'Task-Alpha',
    status: 'todo',
    priority: '中',
    memo: '',
    estimated: {
      start: '09:00',
      end: '10:00',
      minutes: 60
    },
    actual: {
      minutes: 45,
      suspendMinutes: 0,
      suspendStartedAt: null,
      logs: []
    },
    createdAt: '2026-02-18T00:00:00.000Z',
    updatedAt: '2026-02-18T00:00:00.000Z'
  }

  return {
    ...base,
    ...overrides,
    estimated: {
      ...base.estimated,
      ...overrides.estimated
    },
    actual: {
      ...base.actual,
      ...overrides.actual,
      logs: overrides.actual?.logs ?? base.actual.logs
    }
  }
}

const taskListResponse: TaskListResponse = {
  tasks: [
    createTask(),
    createTask({
      id: 'task-2',
      project: 'Project-Y',
      category: 'Category-B',
      title: 'Task-Beta',
      status: 'done',
      estimated: {
        minutes: 30
      },
      actual: {
        minutes: 25
      }
    })
  ],
  projects: ['Project-X', 'Project-Y'],
  categories: ['Category-A', 'Category-B'],
  projectCategories: {
    'Project-X': ['Category-A'],
    'Project-Y': ['Category-B']
  },
  projectTitles: {
    'Project-X': ['Task-Alpha'],
    'Project-Y': ['Task-Beta']
  }
}

const monthlySummaryResponse: TaskMonthlyProjectActualsResponse = {
  period: '2026-02',
  periodUnit: 'month',
  projectActuals: [
    { project: 'Project-X', actualMinutes: 45, estimatedMinutes: 60 },
    { project: 'Project-Y', actualMinutes: 25, estimatedMinutes: 30 }
  ],
  categoryActuals: [
    { project: 'Project-X', category: 'Category-A', actualMinutes: 45, estimatedMinutes: 60 },
    { project: 'Project-Y', category: 'Category-B', actualMinutes: 25, estimatedMinutes: 30 }
  ],
  titleActuals: [
    {
      project: 'Project-X',
      category: 'Category-A',
      title: 'Task-Alpha',
      actualMinutes: 45,
      estimatedMinutes: 60
    },
    {
      project: 'Project-Y',
      category: 'Category-B',
      title: 'Task-Beta',
      actualMinutes: 25,
      estimatedMinutes: 30
    }
  ]
}

describe('TaskBoard UI behavior', () => {
  let apiMock: TaskApiMock

  const renderTaskBoard = async (): Promise<void> => {
    render(
      createElement(TaskBoard, {
        selectedDate: '2026-02-18',
        selectedDateLabel: '2026/02/18 (Wed)',
        currentUser: null,
        taskTimeDisplayMode: 'hourMinute'
      })
    )
    await screen.findByText('Task-Alpha')
  }

  const findSummarySubsection = (title: string): HTMLElement => {
    const heading = screen.getByRole('heading', { level: 5, name: title })
    const subsection = heading.closest('.task-monthly-summary-subsection')
    if (!subsection) {
      throw new Error(`summary subsection not found: ${title}`)
    }
    return subsection as HTMLElement
  }

  beforeEach(() => {
    apiMock = {
      taskGetAll: vi.fn(async () => taskListResponse),
      taskGetMonthlyProjectActuals: vi.fn(async () => monthlySummaryResponse),
      taskUpdate: vi.fn(async (task: Task) => task),
      taskAdd: vi.fn(async () => undefined),
      taskDelete: vi.fn(async () => undefined)
    }

    Object.defineProperty(window, 'api', {
      value: apiMock,
      configurable: true,
      writable: true
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('タスク一覧/タスク集計タブを切り替えできる', async () => {
    await renderTaskBoard()

    expect(document.querySelector('#task-content-list')).not.toBeNull()
    expect(document.querySelector('#task-content-summary')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'タスク集計' }))

    expect(document.querySelector('#task-content-list')).toBeNull()
    expect(document.querySelector('#task-content-summary')).not.toBeNull()
  })

  it('集計セクションを折りたたみできる', async () => {
    await renderTaskBoard()
    fireEvent.click(screen.getByRole('tab', { name: 'タスク集計' }))

    const projectSection = findSummarySubsection('案件別集計')
    const projectToggle = within(projectSection).getByRole('button', {
      name: '案件別集計を折りたたむ'
    })

    expect(projectToggle.getAttribute('aria-expanded')).toBe('true')
    expect(within(projectSection).queryByRole('table')).not.toBeNull()

    fireEvent.click(projectToggle)

    expect(projectToggle.getAttribute('aria-expanded')).toBe('false')
    await waitFor(() => {
      expect(within(projectSection).queryByRole('table')).toBeNull()
    })
  })

  it('カテゴリ別/タスク別の条件入力が各セクションに適用される', async () => {
    await renderTaskBoard()
    fireEvent.click(screen.getByRole('tab', { name: 'タスク集計' }))

    const categorySection = findSummarySubsection('カテゴリ別集計')
    const categorySearchInput = document.querySelector(
      '#task-monthly-summary-category-search'
    ) as HTMLInputElement
    fireEvent.change(categorySearchInput, { target: { value: 'Category-B' } })

    await waitFor(() => {
      expect(within(categorySection).queryByText('Category-A')).toBeNull()
    })
    expect(within(categorySection).getByText('Category-B')).not.toBeNull()

    const titleSection = findSummarySubsection('タスク別集計')
    const titleSearchInput = document.querySelector(
      '#task-monthly-summary-title-search'
    ) as HTMLInputElement
    fireEvent.change(titleSearchInput, { target: { value: 'Task-Beta' } })

    await waitFor(() => {
      expect(within(titleSection).queryByText('Task-Alpha')).toBeNull()
    })
    expect(within(titleSection).getByText('Task-Beta')).not.toBeNull()
  })

  it('単位切替時に対象期間の初期値を現在日の年月へ維持する', async () => {
    await renderTaskBoard()
    fireEvent.click(screen.getByRole('tab', { name: 'タスク集計' }))

    const monthInput = document.querySelector(
      '#task-monthly-summary-period-month'
    ) as HTMLInputElement
    expect(monthInput.value).toBe('2026-02')

    const unitSelect = document.querySelector('#task-monthly-summary-unit') as HTMLSelectElement
    fireEvent.change(unitSelect, { target: { value: 'year' } })

    await waitFor(() => {
      const yearInput = document.querySelector(
        '#task-monthly-summary-period-year'
      ) as HTMLInputElement
      expect(yearInput.value).toBe('2026')
    })
    expect(apiMock.taskGetMonthlyProjectActuals).toHaveBeenCalledWith('guest', '2026')
  })

  it('タスク一覧でステータス変更時に更新処理が呼ばれる', async () => {
    await renderTaskBoard()

    const statusSelect = document.querySelector('.task-status-select') as HTMLSelectElement
    expect(statusSelect.value).toBe('todo')

    fireEvent.change(statusSelect, { target: { value: 'doing' } })

    await waitFor(() => {
      expect(apiMock.taskUpdate).toHaveBeenCalledTimes(1)
    })
    expect(apiMock.taskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'task-1',
        status: 'doing'
      })
    )
  })
})
