# 05. IPC仕様

本アプリは Preload (`src/preload/index.ts`) で `window.api` を公開し、Renderer はこの API のみを使用して Main と通信します。

## 5.1 `window.api` 一覧

| API | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `getCalendar` | `targetDate?: string` (`yyyy-mm-dd`) | `Promise<CalendarTableRow[]>` | 指定日予定を取得 |
| `getSettings` | なし | `Promise<AppSettings>` | 現在ユーザー設定を取得 |
| `saveSettings` | `AppSettings` | `Promise<AppSettings>` | 設定を保存（正規化） |
| `taskGetAll` | `userId: string, targetDate: string` | `Promise<TaskListResponse>` | 指定日のタスク一覧 + 補完マスタ取得（案件別カテゴリ/タスク候補含む） |
| `taskAdd` | `TaskCreateInput` | `Promise<Task>` | タスク追加 |
| `taskUpdate` | `Task` | `Promise<Task \| null>` | タスク更新 |
| `taskDelete` | `taskId: string` | `Promise<boolean>` | タスク削除 |
| `getDefaultProfileIconUrl` | なし | `Promise<string>` | 共有デフォルトアイコン URL を取得 |
| `authLogin` | なし | `Promise<AuthLoginResult>` | Google ログイン実行 |
| `authLogout` | なし | `Promise<AuthLogoutResult>` | ログアウト実行 |
| `authGetCurrentUser` | なし | `Promise<UserProfile \| null>` | 現在ユーザー取得 |
| `onCalendarUpdated` | `(payload) => void` | `() => void` | 更新通知購読（解除関数返却） |

## 5.2 Main 側 IPC ハンドラ

定義箇所:

- `src/main/ipc/registerMainIpcHandlers.ts`（合成）
- `src/main/ipc/handlers/calendarHandlers.ts`
- `src/main/ipc/handlers/settingsHandlers.ts`
- `src/main/ipc/handlers/taskHandlers.ts`
- `src/main/ipc/handlers/authHandlers.ts`

- `get-calendar`
  - `targetDate` が `yyyy-mm-dd` 形式でなければ当日へフォールバック
  - 取得後に `calendar-updated` を配信
- `get-settings`
  - 現在メモリ上の設定を返却
- `save-settings`
  - 保存後に自動取得状態をリセットしスケジューラ再始動
- `get-default-profile-icon-url`
  - `_shared/electron.svg` の file URL を返却
- `task:get-all`
  - 日付バリデーション
  - 不正値は当日へフォールバック
  - タスク一覧と補完マスタを返却
    - `projects`
    - `categories`
    - `projectCategories`（案件別カテゴリ候補）
    - `projectTitles`（案件別タスク候補）
- `task:add`
  - タスク追加
- `task:update`
  - タスク更新
- `task:delete`
  - タスク削除
- `auth:get-current-user`
  - 現在ユーザー情報を返却
- `auth:login`
  - ログイン成功時にユーザー/設定反映 + 当日同期 + 画面前面化
- `auth:logout`
  - `token.json` 削除後に状態初期化、空配信

## 5.3 共有型定義

型は `src/shared/contracts.ts` で一元管理します。

- `CalendarTableRow`
- `AppSettings`
- `UserProfile`
- `AuthLoginResult`
- `AuthLogoutResult`
- `CalendarUpdatePayload`
- `Task`
- `TaskCreateInput`
- `TaskListResponse`

`src/preload/index.d.ts` は `window.api` のグローバル拡張のみ定義します。

## 5.4 通知チャネル

- チャネル名: `calendar-updated`
- ペイロード:
  - `events: CalendarTableRow[]`
  - `updatedAt: string` (ISO 8601)
  - `source: 'manual' | 'auto'`
- 送信タイミング:
  - 手動同期
  - 自動取得
  - ログアウト時クリア

## 5.5 注意事項

- Renderer は Node API を直接呼ばない
- API 追加時は以下を同時更新する
  - `src/shared/contracts.ts`（必要時）
  - `src/preload/index.ts`
  - `src/preload/index.d.ts`
  - `src/main/ipc/registerMainIpcHandlers.ts`
  - `src/main/ipc/handlers/*.ts`
