import { useEffect, useRef, useState } from 'react'
import { formatDateFromInput, formatInputDate, normalizeNumericText, padNumericText } from '../lib/dateUtils'
import type { DateFieldErrors } from '../types/ui'

type ValidationResult = {
  valid: boolean
  message: string
  fieldErrors: DateFieldErrors
}

const createDefaultFieldErrors = (): DateFieldErrors => ({ year: false, month: false, day: false })

const validateDateInputs = (nextYear: string, nextMonth: string, nextDay: string): ValidationResult => {
  const fieldErrors: DateFieldErrors = {
    year: nextYear.length !== 4,
    month: nextMonth.length !== 2,
    day: nextDay.length !== 2
  }

  if (fieldErrors.year || fieldErrors.month || fieldErrors.day) {
    return { valid: false, message: 'yyyy/mm/dd の各桁数を入力してください。', fieldErrors }
  }

  const year = Number(nextYear)
  const month = Number(nextMonth)
  const day = Number(nextDay)
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return { valid: false, message: '年月日には数字のみ入力できます。', fieldErrors }
  }

  if (month < 1 || month > 12) {
    fieldErrors.month = true
    return { valid: false, message: '月は 01 から 12 の範囲で入力してください。', fieldErrors }
  }

  if (day < 1 || day > 31) {
    fieldErrors.day = true
    return { valid: false, message: '日は 01 から 31 の範囲で入力してください。', fieldErrors }
  }

  const candidate = new Date(year, month - 1, day)
  const isValidDate =
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  if (!isValidDate) {
    fieldErrors.day = true
    return { valid: false, message: '存在しない日付です。年月日を確認してください。', fieldErrors }
  }

  return { valid: true, message: '', fieldErrors }
}

// 年月日入力の状態管理を単一責務で扱うフック
export const useDateEditor = () => {
  const [selectedDate, setSelectedDate] = useState<string>(formatInputDate(new Date()))
  const [isDateEditorOpen, setIsDateEditorOpen] = useState(false)
  const [yearInput, setYearInput] = useState<string>(selectedDate.slice(0, 4))
  const [monthInput, setMonthInput] = useState<string>(selectedDate.slice(5, 7))
  const [dayInput, setDayInput] = useState<string>(selectedDate.slice(8, 10))
  const [dateEditorError, setDateEditorError] = useState('')
  const [dateFieldErrors, setDateFieldErrors] = useState<DateFieldErrors>(createDefaultFieldErrors())

  const yearInputRef = useRef<HTMLInputElement | null>(null)
  const monthInputRef = useRef<HTMLInputElement | null>(null)
  const dayInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setYearInput(selectedDate.slice(0, 4))
    setMonthInput(selectedDate.slice(5, 7))
    setDayInput(selectedDate.slice(8, 10))
  }, [selectedDate])

  const resetDateEditorError = (): void => {
    setDateEditorError('')
    setDateFieldErrors(createDefaultFieldErrors())
  }

  const openEditor = (): void => {
    setYearInput(selectedDate.slice(0, 4))
    setMonthInput(selectedDate.slice(5, 7))
    setDayInput(selectedDate.slice(8, 10))
    resetDateEditorError()
    setIsDateEditorOpen(true)
    setTimeout(() => {
      yearInputRef.current?.focus()
      yearInputRef.current?.select()
    }, 0)
  }

  const closeEditor = (): void => {
    setYearInput(selectedDate.slice(0, 4))
    setMonthInput(selectedDate.slice(5, 7))
    setDayInput(selectedDate.slice(8, 10))
    resetDateEditorError()
    setIsDateEditorOpen(false)
  }

  const toggleEditor = (): void => {
    if (isDateEditorOpen) {
      closeEditor()
      return
    }
    openEditor()
  }

  const submitEditor = (): void => {
    const paddedYear = padNumericText(yearInput, 4)
    const paddedMonth = padNumericText(monthInput, 2)
    const paddedDay = padNumericText(dayInput, 2)

    setYearInput(paddedYear)
    setMonthInput(paddedMonth)
    setDayInput(paddedDay)

    const validation = validateDateInputs(paddedYear, paddedMonth, paddedDay)
    if (!validation.valid) {
      setDateEditorError(validation.message)
      setDateFieldErrors(validation.fieldErrors)
      return
    }

    setSelectedDate(`${paddedYear}-${paddedMonth}-${paddedDay}`)
    resetDateEditorError()
    setIsDateEditorOpen(false)
  }

  // 日付入力欄へ今日の日付をセットする（確定はしない）
  const setTodayInputs = (): void => {
    const today = new Date()
    setYearInput(String(today.getFullYear()))
    setMonthInput(String(today.getMonth() + 1).padStart(2, '0'))
    setDayInput(String(today.getDate()).padStart(2, '0'))
    resetDateEditorError()
  }

  const handleYearInputChange = (value: string): void => {
    const normalized = normalizeNumericText(value).slice(0, 4)
    setYearInput(normalized)
    resetDateEditorError()
    if (normalized.length === 4) {
      monthInputRef.current?.focus()
      monthInputRef.current?.select()
    }
  }

  const handleMonthInputChange = (value: string): void => {
    const normalized = normalizeNumericText(value).slice(0, 2)
    setMonthInput(normalized)
    resetDateEditorError()
    if (normalized.length === 2) {
      dayInputRef.current?.focus()
      dayInputRef.current?.select()
    }
  }

  const handleDayInputChange = (value: string): void => {
    const normalized = normalizeNumericText(value).slice(0, 2)
    setDayInput(normalized)
    resetDateEditorError()
  }

  const handleDayInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    submitEditor()
  }

  const handleSelectAllOnFocus = (event: React.FocusEvent<HTMLInputElement>): void => {
    event.currentTarget.select()
  }

  const handlePadOnBlur = (field: 'year' | 'month' | 'day'): void => {
    if (field === 'year') {
      setYearInput((previous) => padNumericText(previous, 4))
      return
    }
    if (field === 'month') {
      setMonthInput((previous) => padNumericText(previous, 2))
      return
    }
    setDayInput((previous) => padNumericText(previous, 2))
  }

  return {
    selectedDate,
    selectedDateLabel: formatDateFromInput(selectedDate),
    isDateEditorOpen,
    dateEditorError,
    dateFieldErrors,
    yearInput,
    monthInput,
    dayInput,
    yearInputRef,
    monthInputRef,
    dayInputRef,
    setSelectedDate,
    toggleEditor,
    closeEditor,
    setTodayInputs,
    submitEditor,
    handleYearInputChange,
    handleMonthInputChange,
    handleDayInputChange,
    handleDayInputKeyDown,
    handleSelectAllOnFocus,
    handlePadOnBlur
  }
}
