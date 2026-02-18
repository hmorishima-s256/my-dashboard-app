// 日付表示/入力で共通利用するユーティリティ
const pad2 = (value: number): string => String(value).padStart(2, '0')

export const formatDate = (date: Date): string =>
  `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`

export const formatInputDate = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`

export const formatDateFromInput = (inputDate: string): string => inputDate.replace(/-/g, '/')

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
