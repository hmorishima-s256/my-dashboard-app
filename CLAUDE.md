# CLAUDE.md

このファイルは Claude Code がプロジェクトを理解するためのガイドです。

## やり取りの言語

原則として**日本語**でやり取りする。

## プロジェクト概要

Google Calendar の予定とタスク予実管理を 1 画面で扱うローカルファーストなデスクトップダッシュボード。

- **技術スタック**: Electron + React 19 + TypeScript + electron-vite
- **ビルド配布**: electron-builder
- **Google 連携**: googleapis (OAuth, Calendar API)
- **ローカル永続化**: lowdb (JSON ファイル)
- **テスト**: vitest + @testing-library/react

## よく使うコマンド

```bash
npm run dev            # 開発サーバー起動（Electron + Vite）
npm run test           # テスト実行（vitest run）
npm run test:watch     # テストウォッチモード
npm run typecheck      # 型チェック（node + web 両方）
npm run lint           # ESLint
npm run format:check   # Prettier フォーマット確認
npm run format         # Prettier フォーマット適用
npm run build          # typecheck 後にビルド
npm run build:win      # Windows 向けビルド
```

## マージ前チェック（DoD）

```bash
npm run format        # フォーマット自動修正
npm run lint
npm run typecheck
npm run test
```

テスト基準: **13 test files / 59 tests** がすべて passed であること。

## ディレクトリ構成

```
src/
  main/          # Main Process（バックエンド）
    index.ts               # Composition Root
    appSettings.ts         # 設定読込/保存
    googleAuth.ts          # OAuth・ユーザー情報・カレンダー取得
    ipc/
      registerMainIpcHandlers.ts
      handlers/            # calendar / settings / task / auth ハンドラ
    services/
      autoFetchScheduler.ts
      calendarPublisher.ts
      taskStore.ts
      autoLaunch.ts
  preload/       # IPC ブリッジ（window.api を公開）
  renderer/src/  # Renderer（React UI）
    App.tsx
    components/  # 表示コンポーネント
    hooks/       # 状態管理・ユースケース
    lib/         # 純粋関数ユーティリティ
    types/
  shared/
    contracts.ts # Main/Preload/Renderer の共通契約型
tests/
  main/          # Main Process テスト
  renderer/      # Renderer ユーティリティテスト
doc/             # 設計・仕様ドキュメント（日本語）
```

## アーキテクチャ上の重要ルール

- Renderer は Node API に直接アクセスしない（`window.api` 経由のみ）
- 認証情報（token.json）は Main だけで扱う
- IPC を追加・変更したら `src/shared/contracts.ts` / `src/preload/index.ts` / `src/preload/index.d.ts` / `src/main/ipc/handlers/*.ts` / `doc/05_IPC仕様.md` をすべて同時に更新する
- 共通契約型は `src/shared/contracts.ts` に一元管理する

## データ保存場所

- ルート: `~/my-dashboard-app/`
- 共通: `_shared/` （current-user.json, settings.guest.json, credentials.json など）
- ユーザー別: `<url-encoded-email>/` （token.json, user-profile.json, settings.json, tasks.json）
- Google OAuth クレデンシャルは `~/my-dashboard-app/_shared/credentials.json` が推奨（リポジトリ外）

## 設計方針

- 1 モジュール 1 責務（UNIX 哲学）
- I/O と UI ロジックを分離
- 型契約で IPC 不整合を防止
- 純粋関数はユニットテスト、Main は依存注入でテスト

## GitHub 運用ルール

このプロジェクトは個人開発ツール。チーム向けの承認フローは不要。

### ブランチ戦略

- `main`: 機能・実装・ドキュメントが揃ったときのみマージ
- `development`: 日々の統合先。CI が通れば積極的にマージしてよい
- 作業ブランチは必ず `development` から切る
- 命名: `feat/*` / `fix/*` / `chore/*` / `docs/*`

### development へのマージフロー

以下をすべて満たしたら自動承認・即マージしてよい（人のレビュー待ち不要）:

1. `npm run format && npm run lint && npm run typecheck && npm run test` が全パス
2. CI（GitHub Actions）が通過
3. `npm run dev` で起動して Electron Skill（agent-browser）で動作確認済み

```bash
# ブランチ作成
git switch development && git pull --ff-only
git switch -c feat/xxxx

# --- 実装 ---

# DoD チェック
npm run format && npm run lint && npm run typecheck && npm run test

# PR 作成 → CI 確認 → 自動承認マージ
gh pr create --base development --fill
gh pr checks --watch
gh pr review --approve
gh pr merge --squash --delete-branch
git switch development && git pull --ff-only
```

### main へのマージフロー

機能・ドキュメント（`doc/`）が一通り揃ったタイミングで手動で判断する。

```bash
gh pr create --base main --head development --fill
gh pr checks --watch
gh pr merge --merge
git switch main && git pull --ff-only
git switch development && git pull --ff-only
```

### Electron Skill による動作確認

```bash
# デバッグポート付きで起動
npm run dev -- --remote-debugging-port=9222

# 別ターミナルで接続・確認
agent-browser connect 9222
agent-browser snapshot -i
agent-browser screenshot check.png
```

## 実装ルール

- TypeScript の型安全性を優先。`as any` / 二段キャスト / `@ts-ignore` の安易な使用は禁止
  - 例外が必要な場合は理由をコメントで明記し承認を得る
- コメントは**日本語**で記述する
- 関数・クラス・主要処理ブロックには「何をする処理か」を簡潔に書く
- 依頼されていない大規模リファクタリング（大量リネーム・移動・無関係な整形）は行わない
- 破壊的変更（IPC 契約、データ形式）時は仕様書（`doc/`）も同時に更新する

## 参考ドキュメント

作業開始時は `doc/README.md` を最初に確認する。詳細仕様は `doc/` 以下を参照：

- `01_システム概要.md`
- `02_アーキテクチャ設計.md`
- `03_機能仕様.md`
- `04_画面仕様.md`
- `05_IPC仕様.md`
- `06_データ保存仕様.md`
- `09_ファイル別実装詳細.md`
- `10_テスト仕様.md`
