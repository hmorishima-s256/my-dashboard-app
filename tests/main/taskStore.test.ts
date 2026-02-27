import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TaskCreateInput, UserProfile } from '../../src/shared/contracts'

const createdRoots: string[] = []

const createTempRoot = async (): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'my-dashboard-task-store-test-'))
  createdRoots.push(root)
  return root
}

const loadTaskStoreModule = async (
  rootPath: string
): Promise<typeof import('../../src/main/services/taskStore')> => {
  vi.resetModules()
  vi.doMock('../../src/main/googleAuth', () => ({
    getUserSettingsDir: (email: string) => path.join(rootPath, encodeURIComponent(email))
  }))
  return await import('../../src/main/services/taskStore')
}

afterEach(async () => {
  vi.resetModules()
  vi.doUnmock('../../src/main/googleAuth')
  await Promise.all(
    createdRoots.splice(0, createdRoots.length).map(async (rootPath) => {
      await fs.rm(rootPath, { recursive: true, force: true })
    })
  )
})

const createTaskInput = (override: Partial<TaskCreateInput> = {}): TaskCreateInput => ({
  date: override.date ?? '2026-02-18',
  project: override.project ?? '案件A',
  category: override.category ?? '設計',
  title: override.title ?? '詳細設計書修正',
  priority: override.priority ?? '中',
  memo: override.memo ?? '確認あり',
  estimated: {
    start: override.estimated?.start ?? '09:00',
    end: override.estimated?.end ?? '10:00',
    minutes: override.estimated?.minutes ?? 60
  },
  actual: override.actual
})

describe('taskStoreService', () => {
  it('ログインユーザーのタスクを追加・取得できる', async () => {
    const rootPath = await createTempRoot()
    const { createTaskStoreService } = await loadTaskStoreModule(rootPath)
    const user: UserProfile = { name: 'Test', email: 'user@example.com', iconUrl: '' }
    let now = new Date('2026-02-18T00:00:00.000Z')

    const taskStore = createTaskStoreService({
      getCurrentUser: () => user,
      createId: () => 'task-1',
      getNow: () => now
    })

    const added = await taskStore.add(createTaskInput())
    expect(added.id).toBe('task-1')
    expect(added.userId).toBe(user.email)

    const response = await taskStore.getAll('2026-02-18')
    expect(response.tasks).toHaveLength(1)
    expect(response.projects).toEqual(['案件A'])
    expect(response.categories).toEqual(['設計'])
    expect(response.projectCategories).toEqual({ 案件A: ['設計'] })
    expect(response.projectTitles).toEqual({ 案件A: ['詳細設計書修正'] })

    const filePath = path.join(rootPath, encodeURIComponent(user.email), 'tasks.json')
    await expect(fs.access(filePath)).resolves.toBeUndefined()

    now = new Date('2026-02-18T01:00:00.000Z')
    const updated = await taskStore.update({ ...added, status: 'done' })
    expect(updated?.status).toBe('done')
    expect(updated?.updatedAt).toBe('2026-02-18T01:00:00.000Z')
  })

  it('タスク削除ができる', async () => {
    const rootPath = await createTempRoot()
    const { createTaskStoreService } = await loadTaskStoreModule(rootPath)
    const user: UserProfile = { name: 'Test', email: 'delete@example.com', iconUrl: '' }

    const taskStore = createTaskStoreService({
      getCurrentUser: () => user,
      createId: () => 'task-delete',
      getNow: () => new Date('2026-02-18T00:00:00.000Z')
    })

    const added = await taskStore.add(createTaskInput())
    await expect(taskStore.remove(added.id)).resolves.toBe(true)
    await expect(taskStore.remove(added.id)).resolves.toBe(false)
    await expect(taskStore.getAll('2026-02-18')).resolves.toEqual({
      tasks: [],
      projects: ['案件A'],
      categories: ['設計'],
      projectCategories: {},
      projectTitles: {}
    })
  })

  it('月次の案件別実績時間を集計できる', async () => {
    const rootPath = await createTempRoot()
    const { createTaskStoreService } = await loadTaskStoreModule(rootPath)
    const user: UserProfile = { name: 'Test', email: 'summary@example.com', iconUrl: '' }
    let idCounter = 0

    const taskStore = createTaskStoreService({
      getCurrentUser: () => user,
      createId: () => `task-summary-${idCounter++}`,
      getNow: () => new Date('2026-02-18T00:00:00.000Z')
    })

    await taskStore.add(
      createTaskInput({
        date: '2026-02-01',
        project: '案件A',
        title: '集計A1',
        actual: { minutes: 30 }
      })
    )
    await taskStore.add(
      createTaskInput({
        date: '2026-02-15',
        project: '案件A',
        title: '集計A2',
        actual: { minutes: 60 }
      })
    )
    await taskStore.add(
      createTaskInput({
        date: '2026-02-20',
        project: '案件B',
        title: '集計B1',
        actual: { minutes: 45 }
      })
    )
    await taskStore.add(
      createTaskInput({
        date: '2026-03-01',
        project: '案件C',
        title: '集計C1',
        actual: { minutes: 120 }
      })
    )

    await expect(taskStore.getMonthlyProjectActuals('2026-02')).resolves.toEqual({
      month: '2026-02',
      projectActuals: [
        { project: '案件A', actualMinutes: 90 },
        { project: '案件B', actualMinutes: 45 }
      ]
    })
  })

  it('ゲストユーザーはアプリ終了時クリアを想定した削除処理ができる', async () => {
    const rootPath = await createTempRoot()
    const { createTaskStoreService } = await loadTaskStoreModule(rootPath)

    const taskStore = createTaskStoreService({
      getCurrentUser: () => null,
      createId: () => 'guest-task-1',
      getNow: () => new Date('2026-02-18T00:00:00.000Z')
    })

    await taskStore.add(createTaskInput())
    await expect(taskStore.getAll('2026-02-18')).resolves.toMatchObject({
      tasks: [{ id: 'guest-task-1', userId: 'guest' }]
    })

    await taskStore.clearGuestData()
    await expect(taskStore.getAll('2026-02-18')).resolves.toEqual({
      tasks: [],
      projects: [],
      categories: [],
      projectCategories: {},
      projectTitles: {}
    })
  })
})
