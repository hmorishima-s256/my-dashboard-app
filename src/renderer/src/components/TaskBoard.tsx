import { useCallback, useEffect, useMemo, useState } from 'react'
import CreatableSelect from 'react-select/creatable'
import type { SingleValue, StylesConfig } from 'react-select'
import {
  calculateActualDurationMinutes,
  calculateDurationMinutes,
  calculateEndTime,
  formatMinutesAsDecimalHours,
  formatMinutesAsDecimalHoursValue,
  formatMinutesAsHourMinute,
  resumeTaskTracking,
  startTaskTracking,
  suspendTaskTracking,
  stopTaskTracking
} from '../lib/taskTimeUtils'
import { GUEST_USER_ID } from '../types/ui'
import type {
  Task,
  TaskCreateInput,
  TaskPriority,
  TaskStatus,
  TaskTimeDisplayMode,
  UserProfile
} from '../types/ui'

type TaskBoardProps = {
  selectedDate: string
  selectedDateLabel: string
  currentUser: UserProfile | null
  taskTimeDisplayMode: TaskTimeDisplayMode
}

type SelectOption = {
  label: string
  value: string
}

type DurationUnit = 'hourMinute' | 'decimalHours' | 'minutes'
type TaskModalMode = 'create' | 'edit'

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: '未着手' },
  { value: 'doing', label: '進行中' },
  { value: 'suspend', label: '中断' },
  { value: 'done', label: '完了' },
  { value: 'carryover', label: '持ち越し' },
  { value: 'finished', label: '終了' }
]

const PRIORITY_OPTIONS: TaskPriority[] = ['緊急', '高', '中', '低']

const selectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 10,
    borderColor: state.isFocused ? 'rgba(40, 200, 120, 0.9)' : 'rgba(163, 186, 226, 0.25)',
    backgroundColor: 'rgba(10, 18, 34, 0.95)',
    boxShadow: state.isFocused ? '0 0 0 1px rgba(40, 200, 120, 0.35)' : 'none'
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: 'rgba(10, 18, 34, 0.98)',
    border: '1px solid rgba(163, 186, 226, 0.25)'
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? 'rgba(40, 200, 120, 0.22)' : 'rgba(10, 18, 34, 0.98)',
    color: '#f1f6ff'
  }),
  singleValue: (base) => ({
    ...base,
    color: '#f1f6ff'
  }),
  input: (base) => ({
    ...base,
    color: '#f1f6ff'
  }),
  placeholder: (base) => ({
    ...base,
    color: '#9fb2cc'
  })
}

const buildOptionList = (values: string[]): SelectOption[] =>
  values.map((value) => ({
    value,
    label: value
  }))

const formatIsoToTime = (iso: string): string => {
  const value = new Date(iso)
  if (Number.isNaN(value.getTime())) return '--:--'
  const hour = String(value.getHours()).padStart(2, '0')
  const minute = String(value.getMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

const normalizeNumericText = (value: string): string =>
  value
    .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.')
    .trim()

const parseHourMinuteTextToMinutes = (value: string): number => {
  const normalized = normalizeNumericText(value).replace(/\s+/g, '')
  if (!normalized) return 0

  const hourMinuteMatch = /^(\d+)時間(?:(\d+)分?)?$/.exec(normalized)
  if (hourMinuteMatch) {
    const hours = Number(hourMinuteMatch[1])
    const minutes = Number(hourMinuteMatch[2] ?? '0')
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes < 0) return 0
    return Math.floor(hours * 60 + minutes)
  }

  const minuteOnlyMatch = /^(\d+)分$/.exec(normalized)
  if (minuteOnlyMatch) {
    return Math.floor(Number(minuteOnlyMatch[1]))
  }

  const hhmmMatch = /^(\d+):([0-5]?\d)$/.exec(normalized)
  if (hhmmMatch) {
    const hours = Number(hhmmMatch[1])
    const minutes = Number(hhmmMatch[2])
    return Math.floor(hours * 60 + minutes)
  }

  const numeric = Number(normalized)
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric * 60)
  }
  return 0
}

const formatDurationForList = (minutes: number, mode: TaskTimeDisplayMode): string => {
  if (mode === 'decimal') {
    return `${formatMinutesAsDecimalHours(minutes)}（${Math.max(0, Math.floor(minutes))}分）`
  }
  return `${formatMinutesAsHourMinute(minutes)}（${Math.max(0, Math.floor(minutes))}分）`
}

const buildTimeRangeText = (
  start: string | null | undefined,
  end: string | null | undefined
): string => {
  return `${start || '--:--'} - ${end || '--:--'}`
}

const getActualRangeFromLogs = (task: Task): { start: string; end: string } => {
  if (task.actual.logs.length === 0) {
    return { start: '', end: '' }
  }
  const firstLog = task.actual.logs[0]
  const lastLog = task.actual.logs[task.actual.logs.length - 1]
  return {
    start: formatIsoToTime(firstLog.start),
    end: lastLog.end ? formatIsoToTime(lastLog.end) : ''
  }
}

const buildActualTimeRangeText = (task: Task): string => {
  const actualRange = getActualRangeFromLogs(task)
  return buildTimeRangeText(actualRange.start, actualRange.end)
}

const sortUnique = (values: string[]): string[] =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, 'ja'))

const upsertProjectScopedValue = (
  previous: Record<string, string[]>,
  project: string,
  value: string
): Record<string, string[]> => {
  const trimmedProject = project.trim()
  const trimmedValue = value.trim()
  if (!trimmedProject || !trimmedValue) return previous
  const currentList = previous[trimmedProject] ?? []
  const nextList = sortUnique([...currentList, trimmedValue])
  return {
    ...previous,
    [trimmedProject]: nextList
  }
}

// タスクの登録・一覧・計測操作を担当するコンポーネント
export const TaskBoard = ({
  selectedDate,
  selectedDateLabel,
  currentUser,
  taskTimeDisplayMode
}: TaskBoardProps): React.JSX.Element => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projectMaster, setProjectMaster] = useState<string[]>([])
  const [projectCategoryMap, setProjectCategoryMap] = useState<Record<string, string[]>>({})
  const [projectTitleMap, setProjectTitleMap] = useState<Record<string, string[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [taskModalMode, setTaskModalMode] = useState<TaskModalMode>('create')
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  const [project, setProject] = useState('')
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('中')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [memo, setMemo] = useState('')
  const [estimatedStart, setEstimatedStart] = useState('')
  const [estimatedEnd, setEstimatedEnd] = useState('')
  const [estimatedDurationInput, setEstimatedDurationInput] = useState('')
  const [estimatedDurationMinutes, setEstimatedDurationMinutes] = useState(0)
  const [estimatedDurationUnit, setEstimatedDurationUnit] = useState<DurationUnit>('hourMinute')
  const [actualStart, setActualStart] = useState('')
  const [actualEnd, setActualEnd] = useState('')
  const [suspendDurationInput, setSuspendDurationInput] = useState('')
  const [suspendDurationMinutes, setSuspendDurationMinutes] = useState(0)
  const [suspendDurationUnit, setSuspendDurationUnit] = useState<DurationUnit>('hourMinute')
  const [actualDurationInput, setActualDurationInput] = useState('')
  const [actualDurationMinutes, setActualDurationMinutes] = useState(0)
  const [actualDurationUnit, setActualDurationUnit] = useState<DurationUnit>('hourMinute')

  const currentUserId = currentUser?.email ?? GUEST_USER_ID
  const isGuest = currentUserId === GUEST_USER_ID

  const projectOptions = useMemo(() => buildOptionList(projectMaster), [projectMaster])
  const categoryOptions = useMemo(
    () => buildOptionList(project ? (projectCategoryMap[project] ?? []) : []),
    [project, projectCategoryMap]
  )
  const titleOptions = useMemo(
    () => buildOptionList(project ? (projectTitleMap[project] ?? []) : []),
    [project, projectTitleMap]
  )

  const parseDurationMinutes = (value: string, unit: DurationUnit): number => {
    const normalized = normalizeNumericText(value)
    if (!normalized) return 0

    if (unit === 'minutes') {
      const numeric = Number(normalized)
      if (!Number.isFinite(numeric) || numeric <= 0) return 0
      return Math.floor(numeric)
    }
    if (unit === 'decimalHours') {
      const numeric = Number(normalized)
      if (!Number.isFinite(numeric) || numeric <= 0) return 0
      return Math.floor(numeric * 60)
    }
    return parseHourMinuteTextToMinutes(normalized)
  }

  const formatDurationValueByUnit = (minutes: number, unit: DurationUnit): string => {
    if (minutes <= 0) return ''
    if (unit === 'hourMinute') {
      return formatMinutesAsHourMinute(minutes)
    }
    if (unit === 'decimalHours') {
      return formatMinutesAsDecimalHoursValue(minutes)
    }
    return String(minutes)
  }

  const loadTaskData = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      const response = await window.api.taskGetAll(currentUserId, selectedDate)
      setTasks(response.tasks)
      setProjectMaster(response.projects)
      setProjectCategoryMap(response.projectCategories)
      setProjectTitleMap(response.projectTitles)
    } catch (error) {
      console.error('Failed to load tasks:', error)
      setErrorMessage('タスクの読込に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }, [currentUserId, selectedDate])

  useEffect(() => {
    void loadTaskData()
  }, [loadTaskData])

  const resetForm = (): void => {
    setProject('')
    setCategory('')
    setTitle('')
    setPriority('中')
    setStatus('todo')
    setMemo('')
    setEstimatedStart('')
    setEstimatedEnd('')
    setEstimatedDurationInput('')
    setEstimatedDurationMinutes(0)
    setEstimatedDurationUnit('hourMinute')
    setActualStart('')
    setActualEnd('')
    setSuspendDurationInput('')
    setSuspendDurationMinutes(0)
    setSuspendDurationUnit('hourMinute')
    setActualDurationInput('')
    setActualDurationMinutes(0)
    setActualDurationUnit('hourMinute')
  }

  const fillFormFromTask = (task: Task): void => {
    const actualRange = getActualRangeFromLogs(task)
    setProject(task.project)
    setCategory(task.category)
    setTitle(task.title)
    setPriority(task.priority)
    setStatus(task.status)
    setMemo(task.memo)
    setEstimatedStart(task.estimated.start ?? '')
    setEstimatedEnd(task.estimated.end ?? '')
    setEstimatedDurationUnit('hourMinute')
    setEstimatedDurationMinutes(task.estimated.minutes)
    setEstimatedDurationInput(formatDurationValueByUnit(task.estimated.minutes, 'hourMinute'))
    setActualStart(actualRange.start)
    setActualEnd(actualRange.end)
    setSuspendDurationUnit('hourMinute')
    setSuspendDurationMinutes(task.actual.suspendMinutes)
    setSuspendDurationInput(formatDurationValueByUnit(task.actual.suspendMinutes, 'hourMinute'))
    setActualDurationUnit('hourMinute')
    setActualDurationMinutes(task.actual.minutes)
    setActualDurationInput(formatDurationValueByUnit(task.actual.minutes, 'hourMinute'))
  }

  // 内部は分で保持し、表示時のみ単位変換する
  const syncEndByStartAndMinutes = (nextStart: string, minutes: number): string => {
    if (!nextStart || minutes <= 0) return ''
    const calculatedEnd = calculateEndTime(nextStart, minutes)
    return calculatedEnd || ''
  }

  const syncMinutesByStartAndEnd = (nextStart: string, nextEnd: string): number => {
    if (!nextStart || !nextEnd) return 0
    return calculateDurationMinutes(nextStart, nextEnd)
  }

  const syncActualMinutesByStartAndEnd = (
    nextStart: string,
    nextEnd: string,
    nextSuspendMinutes: number
  ): number => {
    if (!nextStart || !nextEnd) return 0
    return calculateActualDurationMinutes(nextStart, nextEnd, nextSuspendMinutes)
  }

  // 実績入力の開始/終了をログ形式へ変換する
  const buildActualLogsFromInput = (): Task['actual']['logs'] => {
    if (!actualStart) return []
    const startDate = new Date(`${selectedDate}T${actualStart}:00`)
    if (Number.isNaN(startDate.getTime())) return []
    if (!actualEnd) {
      return [{ start: startDate.toISOString(), end: null }]
    }
    const endDate = new Date(`${selectedDate}T${actualEnd}:00`)
    if (Number.isNaN(endDate.getTime())) return []
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1)
    }
    return [{ start: startDate.toISOString(), end: endDate.toISOString() }]
  }

  const handleChangeEstimatedStart = (value: string): void => {
    setEstimatedStart(value)
    const calculatedEnd = syncEndByStartAndMinutes(value, estimatedDurationMinutes)
    if (calculatedEnd) {
      setEstimatedEnd(calculatedEnd)
      return
    }
    const calculatedMinutes = syncMinutesByStartAndEnd(value, estimatedEnd)
    if (calculatedMinutes > 0) {
      setEstimatedDurationMinutes(calculatedMinutes)
      setEstimatedDurationInput(formatDurationValueByUnit(calculatedMinutes, estimatedDurationUnit))
    }
  }

  const handleChangeEstimatedEnd = (value: string): void => {
    setEstimatedEnd(value)
    const calculatedMinutes = syncMinutesByStartAndEnd(estimatedStart, value)
    if (calculatedMinutes > 0) {
      setEstimatedDurationMinutes(calculatedMinutes)
      setEstimatedDurationInput(formatDurationValueByUnit(calculatedMinutes, estimatedDurationUnit))
    }
  }

  const handleChangeEstimatedDurationValue = (value: string): void => {
    setEstimatedDurationInput(value)
    const minutes = parseDurationMinutes(value, estimatedDurationUnit)
    setEstimatedDurationMinutes(minutes)
    const calculatedEnd = syncEndByStartAndMinutes(estimatedStart, minutes)
    if (calculatedEnd) {
      setEstimatedEnd(calculatedEnd)
    }
  }

  const handleChangeEstimatedDurationUnit = (nextUnit: DurationUnit): void => {
    setEstimatedDurationUnit(nextUnit)
    setEstimatedDurationInput(
      estimatedDurationMinutes > 0
        ? formatDurationValueByUnit(estimatedDurationMinutes, nextUnit)
        : ''
    )
  }

  const handleChangeActualStart = (value: string): void => {
    setActualStart(value)
    if (!value) {
      setActualDurationMinutes(0)
      setActualDurationInput('')
      return
    }
    const totalTrackedMinutes = actualDurationMinutes + suspendDurationMinutes
    const calculatedEnd = syncEndByStartAndMinutes(value, totalTrackedMinutes)
    if (calculatedEnd) {
      setActualEnd(calculatedEnd)
      return
    }
    const calculatedMinutes = syncActualMinutesByStartAndEnd(
      value,
      actualEnd,
      suspendDurationMinutes
    )
    setActualDurationMinutes(calculatedMinutes)
    setActualDurationInput(formatDurationValueByUnit(calculatedMinutes, actualDurationUnit))
  }

  const handleChangeActualEnd = (value: string): void => {
    setActualEnd(value)
    if (!value) {
      setActualDurationMinutes(0)
      setActualDurationInput('')
      return
    }
    const calculatedMinutes = syncActualMinutesByStartAndEnd(
      actualStart,
      value,
      suspendDurationMinutes
    )
    setActualDurationMinutes(calculatedMinutes)
    setActualDurationInput(formatDurationValueByUnit(calculatedMinutes, actualDurationUnit))
  }

  const handleChangeActualDurationValue = (value: string): void => {
    setActualDurationInput(value)
    const minutes = parseDurationMinutes(value, actualDurationUnit)
    setActualDurationMinutes(minutes)
    const totalTrackedMinutes = minutes + suspendDurationMinutes
    const calculatedEnd = syncEndByStartAndMinutes(actualStart, totalTrackedMinutes)
    if (calculatedEnd) {
      setActualEnd(calculatedEnd)
      return
    }
    setActualEnd('')
  }

  const handleChangeActualDurationUnit = (nextUnit: DurationUnit): void => {
    setActualDurationUnit(nextUnit)
    setActualDurationInput(
      actualDurationMinutes > 0 ? formatDurationValueByUnit(actualDurationMinutes, nextUnit) : ''
    )
  }

  const handleChangeSuspendDurationValue = (value: string): void => {
    setSuspendDurationInput(value)
    const minutes = parseDurationMinutes(value, suspendDurationUnit)
    setSuspendDurationMinutes(minutes)

    const recalculatedActualMinutes = syncActualMinutesByStartAndEnd(
      actualStart,
      actualEnd,
      minutes
    )
    setActualDurationMinutes(recalculatedActualMinutes)
    setActualDurationInput(formatDurationValueByUnit(recalculatedActualMinutes, actualDurationUnit))

    if (actualStart) {
      const recalculatedEnd = syncEndByStartAndMinutes(actualStart, actualDurationMinutes + minutes)
      if (recalculatedEnd) {
        setActualEnd(recalculatedEnd)
      }
    }
  }

  const handleChangeSuspendDurationUnit = (nextUnit: DurationUnit): void => {
    setSuspendDurationUnit(nextUnit)
    setSuspendDurationInput(
      suspendDurationMinutes > 0 ? formatDurationValueByUnit(suspendDurationMinutes, nextUnit) : ''
    )
  }

  const closeTaskModal = (): void => {
    setIsTaskModalOpen(false)
    setEditingTaskId(null)
    setErrorMessage('')
  }

  // 案件変更時はカテゴリ/タスク候補が変わるため入力をリセットする
  const handleProjectValueChange = (nextProject: string): void => {
    if (nextProject === project) {
      setProject(nextProject)
      return
    }
    setProject(nextProject)
    setCategory('')
    setTitle('')
  }

  const openCreateModal = (): void => {
    resetForm()
    setTaskModalMode('create')
    setEditingTaskId(null)
    setErrorMessage('')
    setIsTaskModalOpen(true)
  }

  const openEditModal = (task: Task): void => {
    fillFormFromTask(task)
    setTaskModalMode('edit')
    setEditingTaskId(task.id)
    setErrorMessage('')
    setIsTaskModalOpen(true)
  }

  useEffect(() => {
    if (!isTaskModalOpen) return
    const handleEsc = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeTaskModal()
    }
    window.addEventListener('keydown', handleEsc)
    return () => {
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isTaskModalOpen])

  const saveTask = async (nextTask: Task): Promise<void> => {
    try {
      const updatedTask = await window.api.taskUpdate(nextTask)
      if (!updatedTask) {
        await loadTaskData()
        return
      }
      setTasks((previous) =>
        previous.map((task) => (task.id === updatedTask.id ? updatedTask : task))
      )
      setProjectMaster((previous) => sortUnique([...previous, updatedTask.project]))
      setProjectCategoryMap((previous) =>
        upsertProjectScopedValue(previous, updatedTask.project, updatedTask.category)
      )
      setProjectTitleMap((previous) =>
        upsertProjectScopedValue(previous, updatedTask.project, updatedTask.title)
      )
    } catch (error) {
      console.error('Failed to update task:', error)
      setErrorMessage('タスクの更新に失敗しました。')
    }
  }

  const handleSubmitTaskModal = async (): Promise<void> => {
    if (isSaving) return
    const trimmedProject = project.trim()
    const trimmedTitle = title.trim()
    if (!trimmedProject || !trimmedTitle) {
      setErrorMessage('案件名とタスク名は必須です。')
      return
    }

    const estimatedMinutes = estimatedDurationMinutes
    const hasActualStart = !!actualStart
    const hasActualEnd = !!actualEnd
    if (hasActualEnd && !hasActualStart) {
      setErrorMessage('実績の終了時間を入力する場合は開始時間も入力してください。')
      return
    }
    const actualMinutes = hasActualStart && !hasActualEnd ? 0 : actualDurationMinutes
    const inputActualLogs = buildActualLogsFromInput()

    setIsSaving(true)
    setErrorMessage('')
    try {
      if (taskModalMode === 'create') {
        const input: TaskCreateInput = {
          date: selectedDate,
          project: trimmedProject,
          category: category.trim(),
          title: trimmedTitle,
          status,
          priority,
          memo: memo.trim(),
          estimated: {
            start: estimatedStart || null,
            end: estimatedEnd || null,
            minutes: estimatedMinutes
          },
          actual: {
            minutes: actualMinutes,
            suspendMinutes: suspendDurationMinutes,
            suspendStartedAt: null,
            logs: inputActualLogs
          }
        }
        await window.api.taskAdd(input)
        await loadTaskData()
        closeTaskModal()
        return
      }

      const editingTask = tasks.find((task) => task.id === editingTaskId)
      if (!editingTask) {
        setErrorMessage('編集対象のタスクが見つかりません。')
        return
      }

      await saveTask({
        ...editingTask,
        date: selectedDate,
        project: trimmedProject,
        category: category.trim(),
        title: trimmedTitle,
        status,
        priority,
        memo: memo.trim(),
        estimated: {
          start: estimatedStart || null,
          end: estimatedEnd || null,
          minutes: estimatedMinutes
        },
        actual: {
          ...editingTask.actual,
          minutes: actualMinutes,
          suspendMinutes: suspendDurationMinutes,
          suspendStartedAt: null,
          logs: inputActualLogs
        }
      })
      closeTaskModal()
    } catch (error) {
      console.error('Failed to save task:', error)
      setErrorMessage(
        taskModalMode === 'create' ? 'タスクの追加に失敗しました。' : 'タスクの更新に失敗しました。'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleStart = async (task: Task): Promise<void> => {
    const nowIso = new Date().toISOString()
    await saveTask(startTaskTracking(task, nowIso))
  }

  const handleSuspend = async (task: Task): Promise<void> => {
    const nowIso = new Date().toISOString()
    await saveTask(suspendTaskTracking(task, nowIso))
  }

  const handleResume = async (task: Task): Promise<void> => {
    const nowIso = new Date().toISOString()
    await saveTask(resumeTaskTracking(task, nowIso))
  }

  const handleFinish = async (task: Task): Promise<void> => {
    const nowIso = new Date().toISOString()
    await saveTask(stopTaskTracking(task, nowIso, 'finished'))
  }

  const handleDone = async (task: Task): Promise<void> => {
    const nowIso = new Date().toISOString()
    await saveTask(stopTaskTracking(task, nowIso, 'done'))
  }

  const handleDelete = async (taskId: string): Promise<void> => {
    try {
      await window.api.taskDelete(taskId)
      setTasks((previous) => previous.filter((task) => task.id !== taskId))
    } catch (error) {
      console.error('Failed to delete task:', error)
      setErrorMessage('タスクの削除に失敗しました。')
    }
  }

  return (
    <main className="task-board">
      <section className="task-table-card">
        <div className="task-table-header">
          <div className="task-table-title-wrap">
            <h3 className="task-table-title">タスク一覧</h3>
            <span className="task-table-subtitle">{selectedDateLabel}</span>
            {isGuest ? (
              <span className="task-form-guest-tag">ゲストモード（終了時に消えます）</span>
            ) : null}
          </div>
          <button className="task-open-modal-button" type="button" onClick={openCreateModal}>
            タスク登録
          </button>
        </div>
        {errorMessage ? <p className="task-inline-error">{errorMessage}</p> : null}
        <div className="task-table-scroll">
          <table>
            <thead>
              <tr>
                <th>案件/カテゴリ</th>
                <th>タスク</th>
                <th>ステータス</th>
                <th>優先度</th>
                <th>見積</th>
                <th>実績</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className={`task-row status-${task.status}`}>
                  <td>
                    <div className="task-cell-title">{task.project}</div>
                    <div className="task-cell-title">{task.category || '-'}</div>
                  </td>
                  <td>
                    <div className="task-cell-title">{task.title}</div>
                    <div className="task-cell-sub">{task.memo || '-'}</div>
                  </td>
                  <td>
                    <select
                      className={`task-status-select status-${task.status}`}
                      value={task.status}
                      onChange={(event) =>
                        void saveTask({ ...task, status: event.target.value as TaskStatus })
                      }
                    >
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`task-priority priority-${task.priority}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <div>{buildTimeRangeText(task.estimated.start, task.estimated.end)}</div>
                    <div>{formatDurationForList(task.estimated.minutes, taskTimeDisplayMode)}</div>
                  </td>
                  <td>
                    <div>{buildActualTimeRangeText(task)}</div>
                    <div>{formatDurationForList(task.actual.minutes, taskTimeDisplayMode)}</div>
                  </td>
                  <td>
                    <div className="task-row-actions">
                      <button type="button" onClick={() => openEditModal(task)}>
                        詳細
                      </button>
                      <button
                        className="start"
                        type="button"
                        onClick={() => void handleStart(task)}
                        disabled={task.status === 'doing' || task.status === 'suspend'}
                      >
                        開始
                      </button>
                      {task.status === 'suspend' ? (
                        <button
                          className="resume"
                          type="button"
                          onClick={() => void handleResume(task)}
                        >
                          再開
                        </button>
                      ) : (
                        <button
                          className="suspend"
                          type="button"
                          onClick={() => void handleSuspend(task)}
                          disabled={task.status !== 'doing'}
                        >
                          中断
                        </button>
                      )}
                      <button type="button" onClick={() => void handleFinish(task)}>
                        停止
                      </button>
                      <button className="done" type="button" onClick={() => void handleDone(task)}>
                        完了
                      </button>
                      <button
                        className="danger"
                        type="button"
                        onClick={() => void handleDelete(task.id)}
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && !isLoading ? (
                <tr>
                  <td colSpan={7} className="task-empty-row">
                    {selectedDateLabel} のタスクはありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {isTaskModalOpen ? (
        <div className="task-modal-overlay" onClick={closeTaskModal}>
          <div className="task-modal" onClick={(event) => event.stopPropagation()}>
            <div className="task-form-title">
              <div className="task-form-title-left">
                {taskModalMode === 'create' ? 'タスク登録' : 'タスク詳細'}
                <span className="task-form-subtitle">{selectedDateLabel}</span>
              </div>
            </div>

            <div className="task-form-grid">
              <div className="task-field task-field-half">
                <label>案件 *</label>
                <CreatableSelect
                  isClearable
                  styles={selectStyles}
                  options={projectOptions}
                  value={project ? { label: project, value: project } : null}
                  onChange={(option: SingleValue<SelectOption>) =>
                    handleProjectValueChange(option?.value ?? '')
                  }
                  onCreateOption={(value) => handleProjectValueChange(value)}
                  placeholder="案件を選択または入力"
                  formatCreateLabel={(value) => `新規作成: ${value}`}
                />
              </div>

              <div className="task-field task-field-half">
                <label>カテゴリ</label>
                <CreatableSelect
                  isClearable
                  styles={selectStyles}
                  options={categoryOptions}
                  value={category ? { label: category, value: category } : null}
                  onChange={(option: SingleValue<SelectOption>) => setCategory(option?.value ?? '')}
                  onCreateOption={(value) => setCategory(value)}
                  placeholder="カテゴリを選択または入力"
                  formatCreateLabel={(value) => `新規作成: ${value}`}
                />
              </div>

              <div className="task-field task-field-full">
                <label>タスク *</label>
                <CreatableSelect
                  isClearable
                  styles={selectStyles}
                  options={titleOptions}
                  value={title ? { label: title, value: title } : null}
                  onChange={(option: SingleValue<SelectOption>) => setTitle(option?.value ?? '')}
                  onCreateOption={(value) => setTitle(value)}
                  placeholder="タスクを選択または入力"
                  formatCreateLabel={(value) => `新規作成: ${value}`}
                />
              </div>

              <div className="task-field task-field-half">
                <label>初期ステータス</label>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as TaskStatus)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="task-field task-field-half">
                <label>優先度</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TaskPriority)}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="task-field task-field-full">
                <div className="task-group-block">
                  <div className="task-group-headline">
                    <span>予定</span>
                  </div>
                  <div className="task-group-grid">
                    <div className="task-field task-field-third">
                      <label>開始予定</label>
                      <input
                        type="time"
                        value={estimatedStart}
                        onChange={(event) => handleChangeEstimatedStart(event.target.value)}
                      />
                    </div>

                    <div className="task-field task-field-third">
                      <label>終了予定</label>
                      <input
                        type="time"
                        value={estimatedEnd}
                        onChange={(event) => handleChangeEstimatedEnd(event.target.value)}
                      />
                    </div>

                    <div className="task-field task-field-third">
                      <label>見積時間</label>
                      <div className="task-duration-input-group">
                        <input
                          type={estimatedDurationUnit === 'hourMinute' ? 'text' : 'number'}
                          inputMode={estimatedDurationUnit === 'hourMinute' ? 'text' : 'decimal'}
                          min={0}
                          step={
                            estimatedDurationUnit === 'decimalHours'
                              ? 0.01
                              : estimatedDurationUnit === 'minutes'
                                ? 1
                                : undefined
                          }
                          value={estimatedDurationInput}
                          onChange={(event) =>
                            handleChangeEstimatedDurationValue(event.target.value)
                          }
                          placeholder={
                            estimatedDurationUnit === 'hourMinute'
                              ? '6時間45分'
                              : estimatedDurationUnit === 'decimalHours'
                                ? '6.75'
                                : '405'
                          }
                        />
                        <select
                          value={estimatedDurationUnit}
                          onChange={(event) =>
                            handleChangeEstimatedDurationUnit(event.target.value as DurationUnit)
                          }
                        >
                          <option value="hourMinute">時間</option>
                          <option value="decimalHours">時間（小数）</option>
                          <option value="minutes">分</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="task-field task-field-full">
                <div className="task-group-block">
                  <div className="task-group-headline">
                    <span>実績</span>
                  </div>
                  <div className="task-group-grid">
                    <div className="task-field task-field-half">
                      <label>開始時間</label>
                      <input
                        type="time"
                        value={actualStart}
                        onChange={(event) => handleChangeActualStart(event.target.value)}
                      />
                    </div>

                    <div className="task-field task-field-half">
                      <label>終了時間</label>
                      <input
                        type="time"
                        value={actualEnd}
                        onChange={(event) => handleChangeActualEnd(event.target.value)}
                      />
                    </div>

                    <div className="task-field task-field-half">
                      <label>中断時間</label>
                      <div className="task-duration-input-group">
                        <input
                          type={suspendDurationUnit === 'hourMinute' ? 'text' : 'number'}
                          inputMode={suspendDurationUnit === 'hourMinute' ? 'text' : 'decimal'}
                          min={0}
                          step={
                            suspendDurationUnit === 'decimalHours'
                              ? 0.01
                              : suspendDurationUnit === 'minutes'
                                ? 1
                                : undefined
                          }
                          value={suspendDurationInput}
                          onChange={(event) => handleChangeSuspendDurationValue(event.target.value)}
                          placeholder={
                            suspendDurationUnit === 'hourMinute'
                              ? '0時間0分'
                              : suspendDurationUnit === 'decimalHours'
                                ? '0.00'
                                : '0'
                          }
                        />
                        <select
                          value={suspendDurationUnit}
                          onChange={(event) =>
                            handleChangeSuspendDurationUnit(event.target.value as DurationUnit)
                          }
                        >
                          <option value="hourMinute">時間</option>
                          <option value="decimalHours">時間（小数）</option>
                          <option value="minutes">分</option>
                        </select>
                      </div>
                    </div>

                    <div className="task-field task-field-half">
                      <label>実績時間</label>
                      <div className="task-duration-input-group">
                        <input
                          type={actualDurationUnit === 'hourMinute' ? 'text' : 'number'}
                          inputMode={actualDurationUnit === 'hourMinute' ? 'text' : 'decimal'}
                          min={0}
                          step={
                            actualDurationUnit === 'decimalHours'
                              ? 0.01
                              : actualDurationUnit === 'minutes'
                                ? 1
                                : undefined
                          }
                          value={actualDurationInput}
                          onChange={(event) => handleChangeActualDurationValue(event.target.value)}
                          placeholder={
                            actualDurationUnit === 'hourMinute'
                              ? '6時間45分'
                              : actualDurationUnit === 'decimalHours'
                                ? '6.75'
                                : '405'
                          }
                        />
                        <select
                          value={actualDurationUnit}
                          onChange={(event) =>
                            handleChangeActualDurationUnit(event.target.value as DurationUnit)
                          }
                        >
                          <option value="hourMinute">時間</option>
                          <option value="decimalHours">時間（小数）</option>
                          <option value="minutes">分</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="task-field task-field-full">
                <label>備考</label>
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  rows={2}
                  placeholder="必要に応じてメモを入力"
                />
              </div>
            </div>
            {errorMessage ? <p className="task-inline-error">{errorMessage}</p> : null}

            <div className="task-form-actions">
              <button
                className="task-action-button secondary"
                type="button"
                onClick={closeTaskModal}
                disabled={isSaving}
              >
                キャンセル
              </button>
              <button
                className="task-action-button secondary"
                type="button"
                onClick={resetForm}
                disabled={isSaving}
              >
                クリア
              </button>
              <button
                className="task-action-button primary"
                type="button"
                onClick={() => void handleSubmitTaskModal()}
                disabled={isSaving}
              >
                {taskModalMode === 'create' ? '登録' : '更新'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
