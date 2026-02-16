import path from 'path'
import fs from 'fs/promises'
import { authenticate } from '@google-cloud/local-auth'
import { google } from 'googleapis'

type AuthClient = Awaited<ReturnType<typeof authenticate>>

// 画面テーブル表示用に整形した1行分の型
export type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

// メールアドレス形式の場合は @ より前を表示名として使う
const normalizeCalendarName = (name: string): string => {
  const atIndex = name.indexOf('@')
  return atIndex > 0 ? name.slice(0, atIndex) : name
}

// JST で HH24:MM:SS 表示へ変換する
const formatJstTime = (dateTime: string): string =>
  new Date(dateTime).toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

// 認証情報の保存先
const TOKEN_PATH = path.join(process.cwd(), 'token.json')
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json')

// 保存されたトークンを読み込む
async function loadSavedCredentialsIfExist(): Promise<AuthClient | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8')
    const credentials = JSON.parse(content)
    return google.auth.fromJSON(credentials) as unknown as AuthClient
  } catch (err) {
    return null
  }
}

// 新しいトークンを取得して保存
async function saveCredentials(client: AuthClient): Promise<void> {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8')
  const keys = JSON.parse(content)
  const key = keys.installed || keys.web
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token
  })
  await fs.writeFile(TOKEN_PATH, payload)
}

// 認証をする（トークンが無ければブラウザを開く）
async function authorize(): Promise<AuthClient> {
  let client = await loadSavedCredentialsIfExist()
  if (client) {
    return client
  }

  // 新規認証
  client = await authenticate({
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    keyfilePath: CREDENTIALS_PATH
  })

  if (!client) {
    throw new Error('Authentication failed')
  }

  if (client.credentials) {
    await saveCredentials(client)
  }
  return client
}

// 今日の予定を取得するメイン関数
export async function getTodayEvents(): Promise<CalendarTableRow[]> {
  const auth = await authorize()
  const calendar = google.calendar({ version: 'v3', auth: auth as any })

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  // 新実装: 登録済みの全カレンダー(calendarList)を対象に当日予定を集約
  const calendarListRes = await calendar.calendarList.list()
  const calendars = calendarListRes.data.items || []
  const rows: CalendarTableRow[] = []

  for (const cal of calendars) {
    if (!cal.id) continue

    const res = await calendar.events.list({
      calendarId: cal.id,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    })

    const items = res.data.items || []
    for (const event of items) {
      // all-day と dateTime の両方に対応して表示用文字列へ整形
      // 非終日予定は1行目:開始時刻、2行目:終了時刻（ラベルなし）で表示する
      const startDateTime = event.start?.dateTime || ''
      const endDateTime = event.end?.dateTime || ''
      const dateTime = event.start?.date
        ? '1day'
        : startDateTime
          ? endDateTime
            ? `${formatJstTime(startDateTime)}\n${formatJstTime(endDateTime)}`
            : formatJstTime(startDateTime)
          : ''

      // summaryOverride があれば優先し、なければ summary/id を利用
      const calendarName = normalizeCalendarName(cal.summaryOverride || cal.summary || cal.id)

      rows.push({
        calendarName,
        subject: event.summary || '(no title)',
        dateTime
      })
    }
  }

  return rows
}
