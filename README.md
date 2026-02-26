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
