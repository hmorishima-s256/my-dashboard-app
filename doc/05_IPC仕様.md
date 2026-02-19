# 05. IPC仕様

## 5.1 設計方針（なぜこの形か）

- Renderer から Main への入口を `window.api` のみに限定
- Main の機能別ハンドラへ分割して責務を明確化
- 共有型 (`src/shared/contracts.ts`) で入出力を固定し、改修時の破壊を抑制

## 5.2 Preload公開API（`window.api`）

| API | 引数 | 戻り値 | 用途 |
|---|---|---|---|
| `getCalendar` | `targetDate?: string` | `Promise<CalendarTableRow[]>` | 指定日予定を手動同期 |
| `getSettings` | なし | `Promise<AppSettings>` | 設定取得 |
| `saveSettings` | `AppSettings` | `Promise<AppSettings>` | 設定保存 |
| `getDefaultProfileIconUrl` | なし | `Promise<string>` | 共有デフォルトアイコンURL取得 |
| `taskGetAll` | `userId: string, targetDate: string` | `Promise<TaskListResponse>` | 指定日タスク取得 |
| `taskAdd` | `TaskCreateInput` | `Promise<Task>` | タスク追加 |
| `taskUpdate` | `Task` | `Promise<Task \| null>` | タスク更新 |
| `taskDelete` | `taskId: string` | `Promise<boolean>` | タスク削除 |
| `authLogin` | なし | `Promise<AuthLoginResult>` | Googleログイン |
| `authLogout` | なし | `Promise<AuthLogoutResult>` | ログアウト |
| `authGetCurrentUser` | なし | `Promise<UserProfile \| null>` | 現在ユーザー取得 |
| `onCalendarUpdated` | `callback` | `unsubscribe` | 予定更新通知購読 |

注記:
- `taskGetAll` の `userId` は後方互換のため受け取るが、Main側では現在ログインユーザーを基準に解決する。

## 5.3 Main IPCハンドラ

### `calendarHandlers`

- `get-calendar`
  - 日付が不正なら当日へフォールバック
  - `fetchAndPublishByDate(..., 'manual')` を実行

### `settingsHandlers`

- `get-settings`
- `save-settings`
  - 保存後に自動取得状態をリセットし再始動
- `get-default-profile-icon-url`

### `taskHandlers`

- `task:get-all`
  - 不正日付は当日へフォールバック
- `task:add`
- `task:update`
- `task:delete`

### `authHandlers`

- `auth:get-current-user`
- `auth:login`
  - 成功時にユーザー反映、設定再読込、自動取得再始動、当日同期
- `auth:logout`
  - `token.json` 削除後に状態初期化、空配信

## 5.4 通知チャネル

- チャネル: `calendar-updated`
- ペイロード:
  - `events: CalendarTableRow[]`
  - `updatedAt: string`
  - `source: 'manual' | 'auto'`

## 5.5 共有型（抜粋）

- `AppSettings`
- `UserProfile`
- `Task`, `TaskCreateInput`, `TaskListResponse`
- `CalendarTableRow`, `CalendarUpdatePayload`

## 5.6 変更時の更新ルール

IPCを追加/変更した場合は、以下を同時に更新する。

- `src/shared/contracts.ts`（必要時）
- `src/preload/index.ts`
- `src/preload/index.d.ts`
- `src/main/ipc/handlers/*.ts`
- `doc/05_IPC仕様.md`
