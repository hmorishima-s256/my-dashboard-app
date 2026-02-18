import { useState } from 'react'
import { buildIntervalMinutes, parseIntervalForInput } from '../lib/settingsUtils'
import type { AppSettings, IntervalUnit, TaskTimeDisplayMode, UserProfile } from '../types/ui'

// 設定モーダルの状態と保存処理を担当するフック
export const useDashboardSettings = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [autoFetchTime, setAutoFetchTime] = useState('')
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [autoFetchIntervalValue, setAutoFetchIntervalValue] = useState('')
  const [autoFetchIntervalUnit, setAutoFetchIntervalUnit] = useState<IntervalUnit>('minutes')
  const [taskTimeDisplayModeDraft, setTaskTimeDisplayModeDraft] = useState<TaskTimeDisplayMode>('hourMinute')
  const [taskTimeDisplayMode, setTaskTimeDisplayMode] = useState<TaskTimeDisplayMode>('hourMinute')

  const applyLoadedSettings = (loadedSettings: AppSettings): void => {
    setAutoFetchTime(loadedSettings.autoFetchTime ?? '')
    const parsedInterval = parseIntervalForInput(loadedSettings.autoFetchIntervalMinutes)
    setAutoFetchIntervalValue(parsedInterval.value)
    setAutoFetchIntervalUnit(parsedInterval.unit)
    setTaskTimeDisplayModeDraft(loadedSettings.taskTimeDisplayMode)
    setTaskTimeDisplayMode(loadedSettings.taskTimeDisplayMode)
  }

  const openSettingsModal = (): void => {
    // 保存済み値をドラフトへ写して編集開始する
    setTaskTimeDisplayModeDraft(taskTimeDisplayMode)
    setIsSettingsOpen(true)
  }

  const closeSettingsModal = (): void => {
    setIsSettingsOpen(false)
  }

  const saveSettings = async (currentUser: UserProfile | null): Promise<void> => {
    if (!currentUser || isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const savedSettings = await window.api.saveSettings({
        autoFetchTime: autoFetchTime || null,
        autoFetchIntervalMinutes: buildIntervalMinutes(autoFetchIntervalValue, autoFetchIntervalUnit),
        taskTimeDisplayMode: taskTimeDisplayModeDraft
      })
      applyLoadedSettings(savedSettings)
      closeSettingsModal()
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSavingSettings(false)
    }
  }

  const clearSettings = async (currentUser: UserProfile | null): Promise<void> => {
    if (!currentUser || isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const savedSettings = await window.api.saveSettings({
        autoFetchTime: null,
        autoFetchIntervalMinutes: null,
        taskTimeDisplayMode: taskTimeDisplayModeDraft
      })
      applyLoadedSettings(savedSettings)
      closeSettingsModal()
    } catch (error) {
      console.error('Failed to clear settings:', error)
    } finally {
      setIsSavingSettings(false)
    }
  }

  return {
    isSettingsOpen,
    autoFetchTime,
    isSavingSettings,
    autoFetchIntervalValue,
    autoFetchIntervalUnit,
    taskTimeDisplayModeDraft,
    taskTimeDisplayMode,
    setAutoFetchTime,
    setAutoFetchIntervalValue,
    setAutoFetchIntervalUnit,
    setTaskTimeDisplayModeDraft,
    applyLoadedSettings,
    openSettingsModal,
    closeSettingsModal,
    saveSettings,
    clearSettings
  }
}
