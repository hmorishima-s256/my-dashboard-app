import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UserProfile } from '../../src/shared/contracts'

const createdRoots: string[] = []

const createTempRoot = async (): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'my-dashboard-app-test-'))
  createdRoots.push(root)
  return root
}

const loadAppSettingsModule = async (rootPath: string) => {
  const sharedDirPath = path.join(rootPath, '_shared')

  vi.resetModules()
  vi.doMock('../../src/main/googleAuth', () => ({
    APP_SHARED_CONFIG_DIR: sharedDirPath,
    getUserSettingsDir: (email: string) => path.join(rootPath, encodeURIComponent(email))
  }))

  return await import('../../src/main/appSettings')
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

describe('appSettings', () => {
  it('設定ファイルが存在しない場合はデフォルト値を返す', async () => {
    const rootPath = await createTempRoot()
    const { loadAppSettings } = await loadAppSettingsModule(rootPath)

    await expect(loadAppSettings(null)).resolves.toEqual({
      autoFetchTime: null,
      autoFetchIntervalMinutes: null,
      taskTimeDisplayMode: 'hourMinute'
    })
  })

  it('未ログイン時は _shared/settings.guest.json に保存する', async () => {
    const rootPath = await createTempRoot()
    const { saveAppSettings, loadAppSettings } = await loadAppSettingsModule(rootPath)

    const saved = await saveAppSettings(null, {
      autoFetchTime: ' 09:05 ',
      autoFetchIntervalMinutes: 30,
      taskTimeDisplayMode: 'decimal'
    })

    expect(saved).toEqual({
      autoFetchTime: '09:05',
      autoFetchIntervalMinutes: 30,
      taskTimeDisplayMode: 'decimal'
    })

    const savedFilePath = path.join(rootPath, '_shared', 'settings.guest.json')
    const savedContent = JSON.parse(await fs.readFile(savedFilePath, 'utf-8')) as {
      autoFetchTime: string | null
      autoFetchIntervalMinutes: number | null
      taskTimeDisplayMode: 'hourMinute' | 'decimal'
    }
    expect(savedContent).toEqual(saved)

    await expect(loadAppSettings(null)).resolves.toEqual(saved)
  })

  it('ログイン時はユーザー別 settings.json に保存する', async () => {
    const rootPath = await createTempRoot()
    const { saveAppSettings, loadAppSettings } = await loadAppSettingsModule(rootPath)
    const user: UserProfile = {
      name: 'Test User',
      email: 'user@example.com',
      iconUrl: ''
    }

    const saved = await saveAppSettings(user, {
      autoFetchTime: '08:00',
      autoFetchIntervalMinutes: 120,
      taskTimeDisplayMode: 'hourMinute'
    })

    const savedFilePath = path.join(rootPath, encodeURIComponent(user.email), 'settings.json')
    const savedContent = JSON.parse(await fs.readFile(savedFilePath, 'utf-8')) as {
      autoFetchTime: string | null
      autoFetchIntervalMinutes: number | null
      taskTimeDisplayMode: 'hourMinute' | 'decimal'
    }
    expect(savedContent).toEqual(saved)
    await expect(loadAppSettings(user)).resolves.toEqual(saved)
  })

  it('保存時に不正値を正規化する', async () => {
    const rootPath = await createTempRoot()
    const { saveAppSettings } = await loadAppSettingsModule(rootPath)

    await expect(
      saveAppSettings(null, {
        autoFetchTime: '25:99',
        autoFetchIntervalMinutes: 0,
        taskTimeDisplayMode: 'invalid' as never
      })
    ).resolves.toEqual({
      autoFetchTime: null,
      autoFetchIntervalMinutes: null,
      taskTimeDisplayMode: 'hourMinute'
    })

    await expect(
      saveAppSettings(null, {
        autoFetchTime: '00:00',
        autoFetchIntervalMinutes: 10.8,
        taskTimeDisplayMode: 'decimal'
      })
    ).resolves.toEqual({
      autoFetchTime: '00:00',
      autoFetchIntervalMinutes: 10,
      taskTimeDisplayMode: 'decimal'
    })
  })
})
