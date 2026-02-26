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
