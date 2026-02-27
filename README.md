# my-dashboard-app

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)

## Development with Dev Container

This repository includes `.devcontainer/` so you can build a reproducible environment.

### Prerequisites

- WSL2
- Rancher Desktop (`Container Engine: dockerd (moby)`)
- VS Code + Dev Containers extension

### First launch

```bash
# Open this folder in VS Code, then run:
Dev Containers: Reopen in Container
```

After the container starts, dependencies are installed automatically by `postCreateCommand`.
`gh` (GitHub CLI) is also preinstalled in the dev container image.

### Persistent data in Dev Container

The dev container uses named volumes so the following data survives container rebuilds:

- `node_modules`
- GitHub CLI auth config (`/root/.config/gh`)
- Codex auth/work data (`/root/.codex`)
- VS Code remote extensions cache (`/root/.vscode-server/extensions`)
- VS Code remote user data (`/root/.vscode-server/data/User`)

### Standard VS Code extensions in Dev Container

The dev container defines the team-standard extension set in `.devcontainer/devcontainer.json` (`customizations.vscode.extensions`).

- `dbaeumer.vscode-eslint`
- `esbenp.prettier-vscode`
- `github.vscode-pull-request-github`
- `github.vscode-github-actions`
- `redhat.vscode-yaml`
- `davidanson.vscode-markdownlint`
- `yzhang.markdown-all-in-one`
- `streetsidesoftware.code-spell-checker`
- `christian-kohler.path-intellisense`
- `EditorConfig.EditorConfig`
- `vitest.explorer`
- `openai.chatgpt`
- `mhutchie.git-graph`

Operational notes:

- At first build/rebuild, extension synchronization can take time depending on network speed.
- When named volumes are preserved, rebuild typically does not require re-downloading these extensions.
- If volumes are deleted, extensions and auth-related caches are downloaded/created again.

On first launch, authenticate once as needed:

```bash
gh auth login
```

If tokens expire (for example, GitHub PAT expiry), re-authentication is required.

### Run app in container

```bash
npm run dev
```

Electron GUI is available through the forwarded Desktop (noVNC) port `6080`.
Open the forwarded `6080` URL in your browser to see the container desktop.
For Windows installers, run `npm run build:win` on the Windows host instead of inside the Linux container.

## Credentials and Secret Files

Policy:

- Secret files are managed **outside this repository**.
- Preferred location for Google OAuth credentials is `~/my-dashboard-app/_shared/credentials.json`.
- You can override the credentials file path with `MY_DASHBOARD_CREDENTIALS_PATH`.
- Legacy fallback search (project root or parent paths) is kept for compatibility, but not recommended for team operation.

Current env usage:

- `.env` is not required for this project at this time.
- If needed in the future, use `.env.example` for shared keys and keep real `.env*` files local-only.

Tracking safety checks:

```bash
git status --short --ignored
git ls-files | rg -n "credentials\\.json|token\\.json|client_secret|service_account|\\.env" -S
```

## Task Summary, Sort, and Search

The `タスク` tab provides both daily task management and period-based aggregation.

- Sub tabs in task area
  - `タスク一覧`: list table only
  - `タスク集計`: aggregation area only
- `タスク集計` behavior
  - Switch unit: `月次 (YYYY-MM)` / `年次 (YYYY)`
  - The period input defaults to the selected date (`YYYY-MM` or `YYYY`)
  - Aggregation sections: `案件別` / `カテゴリ別` / `タスク別`
  - Each section has its own collapse toggle (`▲` / `▼`)
  - Metrics: `合計実績時間` / `合計見積時間` (hour-minute display)
- Sort
  - `案件別` table: `案件名` / `合計実績時間` / `合計見積時間` (asc/desc)
  - `タスク一覧` table: `案件/カテゴリ` / `タスク` / `ステータス` / `優先度` / `見積` / `実績`
  - Default task order remains `createdAt asc` (oldest first)
- Search and filters
  - `案件別`: keyword (`案件/カテゴリ/タスク`) + minutes range (`実績` / `見積`)
  - `カテゴリ別`: keyword (`案件/カテゴリ`) + minutes range (`実績` / `見積`)
  - `タスク別`: keyword (`案件/カテゴリ/タスク`) + minutes range (`実績` / `見積`)
  - `タスク一覧`: keyword (`案件/カテゴリ/タスク`) + `ステータス` + `優先度` + minutes range (`実績` / `見積`)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
