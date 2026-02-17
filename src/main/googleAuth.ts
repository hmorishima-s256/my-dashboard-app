import { shell } from 'electron'
import http from 'http'
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import { URL, pathToFileURL } from 'url'
import { google } from 'googleapis'
import { OAuth2Client } from 'google-auth-library'

type AuthClient = OAuth2Client

// 画面テーブル表示用に整形した1行分の型
export type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}

// ログイン済みユーザー情報
export type UserProfile = {
  name: string
  email: string
  iconUrl: string
}

// ログアウトAPIの戻り値
export type LogoutResult = {
  success: boolean
  message?: string
}

type OAuthClientConfig = {
  clientId: string
  clientSecret: string
  redirectUri: URL
}

type CurrentUserPointer = {
  email: string
}

// 認証スコープ（カレンダー + ユーザー情報）
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]

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

// yyyy-mm-dd 形式の日付文字列をローカル日付として解釈する
const parseTargetDate = (targetDate: string): Date => {
  const [year, month, day] = targetDate.split('-').map((value) => Number(value))
  if (!year || !month || !day) {
    throw new Error(`Invalid target date: ${targetDate}`)
  }
  return new Date(year, month - 1, day)
}

// データ保存先: C:\Users\<Windowsユーザー名>\my-dashboard-app
export const APP_LOCAL_ROOT_PATH = path.join(os.homedir(), 'my-dashboard-app')
// ユーザー共通ファイルの保存先（current-user.json など）
export const APP_SHARED_CONFIG_DIR = path.join(APP_LOCAL_ROOT_PATH, '_shared')
const CURRENT_USER_FILE_PATH = path.join(APP_SHARED_CONFIG_DIR, 'current-user.json')
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json')
const DEFAULT_PROFILE_ICON_PATH = path.join(APP_SHARED_CONFIG_DIR, 'electron.svg')

// _shared/electron.svg が存在しない場合に書き込むデフォルトSVG
const DEFAULT_PROFILE_ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" rx="28" fill="#0B1220"/>
  <circle cx="64" cy="64" r="46" stroke="#8EB6FF" stroke-width="4"/>
  <circle cx="64" cy="64" r="6" fill="#8EB6FF"/>
  <circle cx="34" cy="52" r="5" fill="#8EB6FF"/>
  <circle cx="94" cy="52" r="5" fill="#8EB6FF"/>
  <circle cx="38" cy="86" r="5" fill="#8EB6FF"/>
  <circle cx="90" cy="86" r="5" fill="#8EB6FF"/>
  <path d="M64 64L34 52" stroke="#8EB6FF" stroke-width="3"/>
  <path d="M64 64L94 52" stroke="#8EB6FF" stroke-width="3"/>
  <path d="M64 64L38 86" stroke="#8EB6FF" stroke-width="3"/>
  <path d="M64 64L90 86" stroke="#8EB6FF" stroke-width="3"/>
</svg>`

// メールアドレスからユーザーごとのディレクトリ名を作る
const buildUserKey = (email: string): string => encodeURIComponent(email.trim().toLowerCase())

// 設定保存で使うユーザーごとのディレクトリを返す
export const getUserSettingsDir = (email: string): string => path.join(APP_LOCAL_ROOT_PATH, buildUserKey(email))

// ユーザーごとの token/profile ファイルパス
const getTokenPath = (email: string): string => path.join(getUserSettingsDir(email), 'token.json')
const getUserProfilePath = (email: string): string => path.join(getUserSettingsDir(email), 'user-profile.json')

// 共通ディレクトリにデフォルトアイコンなどの共通ファイルを用意する
export const ensureSharedFiles = async (): Promise<void> => {
  await fs.mkdir(APP_SHARED_CONFIG_DIR, { recursive: true })

  try {
    await fs.access(DEFAULT_PROFILE_ICON_PATH)
  } catch {
    await fs.writeFile(DEFAULT_PROFILE_ICON_PATH, DEFAULT_PROFILE_ICON_SVG, 'utf-8')
  }
}

// Renderer が表示可能な file:// URL を返す
export const getDefaultProfileIconUrl = async (): Promise<string> => {
  await ensureSharedFiles()
  return pathToFileURL(DEFAULT_PROFILE_ICON_PATH).toString()
}

// OAuth 設定ファイルを読み込み、localhost redirect_uri を返す
const loadOAuthClientConfig = async (): Promise<OAuthClientConfig> => {
  const credentialsContent = await fs.readFile(CREDENTIALS_PATH, 'utf-8')
  const credentials = JSON.parse(credentialsContent) as {
    installed?: {
      client_id: string
      client_secret: string
      redirect_uris: string[]
    }
    web?: {
      client_id: string
      client_secret: string
      redirect_uris: string[]
    }
  }

  const keys = credentials.installed || credentials.web
  if (!keys) {
    throw new Error('Invalid credentials.json: installed/web section is missing')
  }

  const redirectUriRaw = keys.redirect_uris.find((uri) => {
    try {
      const parsed = new URL(uri)
      return parsed.hostname === 'localhost'
    } catch {
      return false
    }
  })

  if (!redirectUriRaw) {
    throw new Error('Invalid credentials.json: localhost redirect_uris is missing')
  }

  return {
    clientId: keys.client_id,
    clientSecret: keys.client_secret,
    redirectUri: new URL(redirectUriRaw)
  }
}

// current-user.json を読み込む
const loadCurrentUserPointer = async (): Promise<CurrentUserPointer | null> => {
  try {
    const content = await fs.readFile(CURRENT_USER_FILE_PATH, 'utf-8')
    const parsed = JSON.parse(content) as Partial<CurrentUserPointer>
    if (!parsed.email) return null
    return { email: parsed.email }
  } catch {
    return null
  }
}

// current-user.json を保存する
const saveCurrentUserPointer = async (email: string): Promise<void> => {
  await fs.mkdir(path.dirname(CURRENT_USER_FILE_PATH), { recursive: true })
  await fs.writeFile(CURRENT_USER_FILE_PATH, JSON.stringify({ email }, null, 2), 'utf-8')
}

// 保存済みトークンを読み込む
async function loadSavedCredentialsIfExist(): Promise<AuthClient | null> {
  const pointer = await loadCurrentUserPointer()
  if (!pointer?.email) {
    return null
  }

  try {
    const tokenPath = getTokenPath(pointer.email)
    const content = await fs.readFile(tokenPath, 'utf-8')
    const credentials = JSON.parse(content)
    return google.auth.fromJSON(credentials) as unknown as AuthClient
  } catch {
    return null
  }
}

// ユーザーごとの token.json を保存する
async function saveCredentials(client: AuthClient, email: string): Promise<void> {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf-8')
  const keys = JSON.parse(content)
  const key = keys.installed || keys.web
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token
  })
  const tokenPath = getTokenPath(email)
  await fs.mkdir(path.dirname(tokenPath), { recursive: true })
  await fs.writeFile(tokenPath, payload)
}

// OAuth2 API からプロフィール情報（名前/メール/アイコン）を取得
async function fetchUserProfile(client: AuthClient): Promise<UserProfile> {
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const userInfoResponse = await oauth2.userinfo.get()
  const data = userInfoResponse.data

  if (!data.email) {
    throw new Error('Failed to fetch user email from Google profile')
  }

  return {
    name: data.name || data.email,
    email: data.email,
    iconUrl: data.picture || ''
  }
}

// user-profile.json をユーザーごとのディレクトリへ保存する
async function saveUserProfile(profile: UserProfile): Promise<void> {
  const userProfilePath = getUserProfilePath(profile.email)
  await fs.mkdir(path.dirname(userProfilePath), { recursive: true })
  await fs.writeFile(userProfilePath, JSON.stringify(profile, null, 2), 'utf-8')
}

// 認証完了ページ（成功）
const buildAuthSuccessHtml = (): string => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>認証完了</title>
  <style>
    body{margin:0;display:grid;place-items:center;min-height:100vh;background:#0b1220;color:#eaf1ff;font-family:Segoe UI,system-ui,sans-serif}
    .card{width:min(560px,92vw);padding:28px;border:1px solid rgba(163,186,226,.3);border-radius:16px;background:rgba(12,20,37,.85)}
    h1{margin:0 0 10px;font-size:24px}
    p{margin:0;color:#b6c2d8;line-height:1.6}
  </style>
</head>
<body>
  <div class="card">
    <h1>ログイン完了</h1>
    <p>認証が完了しました。アプリに戻ってください。</p>
  </div>
  <script>window.close()</script>
</body>
</html>`

// 認証完了ページ（失敗）
const buildAuthFailureHtml = (message: string): string => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>認証失敗</title>
  <style>
    body{margin:0;display:grid;place-items:center;min-height:100vh;background:#1d0d16;color:#ffe8ef;font-family:Segoe UI,system-ui,sans-serif}
    .card{width:min(560px,92vw);padding:28px;border:1px solid rgba(255,172,190,.3);border-radius:16px;background:rgba(58,19,32,.9)}
    h1{margin:0 0 10px;font-size:24px}
    p{margin:0;color:#ffd2de;line-height:1.6;word-break:break-word}
  </style>
</head>
<body>
  <div class="card">
    <h1>ログイン失敗</h1>
    <p>${message}</p>
  </div>
</body>
</html>`

// ブラウザ認証を実行して OAuth クライアントを返す
const authorizeWithBrowser = async (): Promise<AuthClient> => {
  const config = await loadOAuthClientConfig()
  const oauthClient = new OAuth2Client({
    clientId: config.clientId,
    clientSecret: config.clientSecret
  })

  const redirectUri = new URL(config.redirectUri.toString())

  return await new Promise<AuthClient>((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url || '', 'http://localhost')
        if (requestUrl.pathname !== redirectUri.pathname) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(buildAuthFailureHtml('無効なコールバックURLです。'))
          return
        }

        if (requestUrl.searchParams.has('error')) {
          const errorMessage = requestUrl.searchParams.get('error') || 'Authorization rejected'
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(buildAuthFailureHtml(errorMessage))
          reject(new Error(errorMessage))
          return
        }

        const code = requestUrl.searchParams.get('code')
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(buildAuthFailureHtml('認証コードを取得できませんでした。'))
          reject(new Error('Cannot read authentication code'))
          return
        }

        const tokenResponse = await oauthClient.getToken({
          code,
          redirect_uri: redirectUri.toString()
        })
        oauthClient.setCredentials(tokenResponse.tokens)

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(buildAuthSuccessHtml())
        resolve(oauthClient)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown authentication error'
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(buildAuthFailureHtml(message))
        reject(error)
      } finally {
        server.close()
      }
    })

    server.listen(0, '127.0.0.1', async () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to start local auth server'))
        return
      }

      redirectUri.port = String(address.port)
      const authUrl = oauthClient.generateAuthUrl({
        redirect_uri: redirectUri.toString(),
        access_type: 'offline',
        prompt: 'consent',
        scope: GOOGLE_SCOPES
      })

      await shell.openExternal(authUrl)
    })
  })
}

// 起動時に保存済みプロフィールを返す（未ログイン時は null）
export async function getSavedUserProfile(): Promise<UserProfile | null> {
  const pointer = await loadCurrentUserPointer()
  if (!pointer?.email) {
    return null
  }

  try {
    const tokenPath = getTokenPath(pointer.email)
    await fs.access(tokenPath)
  } catch {
    return null
  }

  try {
    const profilePath = getUserProfilePath(pointer.email)
    const content = await fs.readFile(profilePath, 'utf-8')
    const parsed = JSON.parse(content) as Partial<UserProfile>
    if (!parsed.email) return null
    return {
      name: parsed.name || parsed.email,
      email: parsed.email,
      iconUrl: parsed.iconUrl || ''
    }
  } catch {
    return null
  }
}

// ログインを実行し、成功時にプロフィール情報を返す
export async function loginWithGoogle(): Promise<UserProfile> {
  const client = await authorizeWithBrowser()
  const profile = await fetchUserProfile(client)

  await saveCurrentUserPointer(profile.email)
  await saveUserProfile(profile)
  await saveCredentials(client, profile.email)

  return profile
}

// ログアウトを実行し、token.json のみ削除する
export async function logoutGoogle(): Promise<LogoutResult> {
  try {
    const pointer = await loadCurrentUserPointer()
    if (pointer?.email) {
      await fs.rm(getTokenPath(pointer.email), { force: true })
    }
    return { success: true }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown logout error'
    }
  }
}

// 認証済みクライアントを返す（未ログインなら null）
async function authorizeWithStoredToken(): Promise<AuthClient | null> {
  return await loadSavedCredentialsIfExist()
}

// 指定日（yyyy-mm-dd）の予定を取得するメイン関数
export async function getEventsByDate(targetDate: string): Promise<CalendarTableRow[]> {
  const auth = await authorizeWithStoredToken()
  if (!auth) {
    throw new Error('Not logged in')
  }

  const calendar = google.calendar({ version: 'v3', auth })

  const date = parseTargetDate(targetDate)
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

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

// 今日の予定を取得するメイン関数
export async function getTodayEvents(): Promise<CalendarTableRow[]> {
  const now = new Date()
  const targetDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return await getEventsByDate(targetDate)
}
