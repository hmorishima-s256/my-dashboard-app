# 05. IPC仕様

本アプリでは `src/preload/index.ts` で `window.api` を公開し、Renderer はそれを利用して Main と通信します。

## 5.1 API 一覧

| API | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `getCalendar` | `targetDate?: string` (`yyyy-mm-dd`) | `Promise<CalendarTableRow[]>` | 指定日の予定取得 |
| `getSettings` | なし | `Promise<AppSettings>` | 現在ユーザーの設定取得 |
| `saveSettings` | `AppSettings` | `Promise<AppSettings>` | 設定保存（正規化後） |
| `getDefaultProfileIconUrl` | なし | `Promise<string>` | 共通アイコン URL 取得（現UIでは未使用） |
| `authLogin` | なし | `Promise<AuthLoginResult>` | Google ログイン実行 |
| `authLogout` | なし | `Promise<AuthLogoutResult>` | ログアウト実行 |
| `authGetCurrentUser` | なし | `Promise<UserProfile \| null>` | 起動時のログイン状態取得 |
| `onCalendarUpdated` | `callback` | `() => void` | 予定更新通知の購読解除関数を返却 |

## 5.2 型定義

### `CalendarTableRow`

```ts
type CalendarTableRow = {
  calendarName: string
  subject: string
  dateTime: string
}
```

### `AppSettings`

```ts
type AppSettings = {
  autoFetchTime: string | null
  autoFetchIntervalMinutes: number | null
}
```

### `UserProfile`

```ts
type UserProfile = {
  name: string
  email: string
  iconUrl: string
}
```

### `AuthLoginResult`

```ts
type AuthLoginResult = {
  success: boolean
  user: UserProfile | null
  message: string
}
```

### `AuthLogoutResult`

```ts
type AuthLogoutResult = {
  success: boolean
  message?: string
}
```

### `CalendarUpdatePayload`

```ts
type CalendarUpdatePayload = {
  events: CalendarTableRow[]
  updatedAt: string
  source: 'manual' | 'auto'
}
```

## 5.3 通知チャネル

- チャネル名: `calendar-updated`
- 送信元: Main
- 受信側: Renderer
- 主な送信タイミング
  - 手動同期後
  - 自動取得後
  - ログアウト後（空配列でクリア）

## 5.4 実装上の注意

- Renderer は Node API を直接呼ばず `window.api` のみ使用
- 型定義は `src/preload/index.d.ts` で管理
- API 追加時は `index.ts` と `index.d.ts` の両方更新が必須
