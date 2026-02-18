import type { DateFieldErrors } from '../types/ui'

type DateSelectorProps = {
  selectedDateLabel: string
  isDateEditorOpen: boolean
  dateEditorError: string
  dateFieldErrors: DateFieldErrors
  yearInput: string
  monthInput: string
  dayInput: string
  yearInputRef: React.RefObject<HTMLInputElement | null>
  monthInputRef: React.RefObject<HTMLInputElement | null>
  dayInputRef: React.RefObject<HTMLInputElement | null>
  onToggleEditor: () => void
  onCancelEditor: () => void
  onSetToday: () => void
  onSubmitEditor: () => void
  onYearInputChange: (value: string) => void
  onMonthInputChange: (value: string) => void
  onDayInputChange: (value: string) => void
  onDayInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onInputFocus: (event: React.FocusEvent<HTMLInputElement>) => void
  onInputBlurPad: (field: 'year' | 'month' | 'day') => void
}

// 日付選択 UI を担当する表示コンポーネント
export const DateSelector = ({
  selectedDateLabel,
  isDateEditorOpen,
  dateEditorError,
  dateFieldErrors,
  yearInput,
  monthInput,
  dayInput,
  yearInputRef,
  monthInputRef,
  dayInputRef,
  onToggleEditor,
  onCancelEditor,
  onSetToday,
  onSubmitEditor,
  onYearInputChange,
  onMonthInputChange,
  onDayInputChange,
  onDayInputKeyDown,
  onInputFocus,
  onInputBlurPad
}: DateSelectorProps): React.JSX.Element => {
  return (
    <div className="topbar-left">
      <button className="date-picker-button" onClick={onToggleEditor} type="button" aria-label="日付選択">
        <span className="date-picker-text">{selectedDateLabel}</span>
      </button>
      {isDateEditorOpen ? (
        <div className="date-editor-panel">
          <div className="date-editor-row">
            <input
              ref={yearInputRef}
              className={`date-editor-input year ${dateFieldErrors.year ? 'error' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={yearInput}
              onChange={(event) => onYearInputChange(event.target.value)}
              onFocus={onInputFocus}
              onBlur={() => onInputBlurPad('year')}
              aria-label="年"
              placeholder="yyyy"
            />
            <span className="date-editor-separator">/</span>
            <input
              ref={monthInputRef}
              className={`date-editor-input month ${dateFieldErrors.month ? 'error' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={monthInput}
              onChange={(event) => onMonthInputChange(event.target.value)}
              onFocus={onInputFocus}
              onBlur={() => onInputBlurPad('month')}
              aria-label="月"
              placeholder="mm"
            />
            <span className="date-editor-separator">/</span>
            <input
              ref={dayInputRef}
              className={`date-editor-input day ${dateFieldErrors.day ? 'error' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={2}
              value={dayInput}
              onChange={(event) => onDayInputChange(event.target.value)}
              onKeyDown={onDayInputKeyDown}
              onFocus={onInputFocus}
              onBlur={() => onInputBlurPad('day')}
              aria-label="日"
              placeholder="dd"
            />
          </div>
          {dateEditorError ? <p className="date-editor-error">{dateEditorError}</p> : null}
          <div className="date-editor-actions">
            <button className="date-editor-action cancel" type="button" onClick={onCancelEditor}>
              キャンセル
            </button>
            <button className="date-editor-action today" type="button" onClick={onSetToday}>
              今日
            </button>
            <button className="date-editor-action ok" type="button" onClick={onSubmitEditor}>
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
