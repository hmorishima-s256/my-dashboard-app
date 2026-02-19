// 日付表示/入力で共通利用するユーティリティ
const pad2 = (value: number): string => String(value).padStart(2, '0')

export const formatDate = (date: Date): string =>
  `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`

export const formatInputDate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'] as const

export const formatDateFromInput = (inputDate: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(inputDate)
  if (!match) return inputDate.replace(/-/g, '/')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(year, month - 1, day)
  const isValidDate =
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  if (!isValidDate) return `${match[1]}/${match[2]}/${match[3]}`
  return `${match[1]}/${match[2]}/${match[3]}(${WEEKDAY_JP[candidate.getDay()]})`
}

export const formatDateTime = (date: Date): string =>
  `${formatDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`

export const normalizeNumericText = (value: string): string =>
  // 全角数字を半角へ寄せたうえで数字以外を除去する
  value
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, '')

export const padNumericText = (value: string, length: number): string => {
  if (!value) return value
  return value.padStart(length, '0').slice(0, length)
}
