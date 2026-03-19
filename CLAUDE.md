# VibeTerminal

Mac-only Electron terminal emulator purpose-built for Claude Code workflows.

## Quick Start

```bash
npm install
npm start        # Dev mode
npm test         # Run unit tests
npm run package  # Build for distribution
```

## Architecture

- **Electron Forge** with webpack-typescript template
- **Main process**: `src/main/` — PTY management, preview WebContentsView, CDP logging, file watching
- **Renderer**: `src/renderer/` — React UI with xterm.js terminal
- **Preload**: `src/preload/` — typed IPC bridge (`window.vibeAPI`)
- **Shared**: `src/shared/` — IPC channel constants and type definitions

## Key Patterns

- `node-pty` is externalized in webpack (`webpack.main.config.ts`) — it can't be bundled
- `WebContentsView` renders ABOVE all DOM content — floating panels (Notes, MDs) anchor to the left panel to avoid z-order conflicts
- The device selector temporarily hides the WebContentsView when its dropdown is open
- xterm.js `Terminal.open()` can only be called once — tabs use CSS `display: none/block`, not mount/unmount
- `fix-path` is called at startup to inherit the user's $PATH (Electron GUI apps get minimal PATH)
- PTY shell CWD is detected via `lsof -a -p PID -d cwd` on macOS
- Screenshots are saved to `<project>/.vibeterminal/` so Claude Code can access them

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # App entry, window creation
│   ├── pty-manager.ts
│   ├── preview-manager.ts
│   ├── cdp-logger.ts
│   ├── file-watcher.ts
│   ├── prompt-detector.ts
│   ├── ipc-handlers.ts
│   └── menu.ts
├── renderer/       # React UI
│   ├── App.tsx
│   ├── hooks/      # useTerminal, useTabs, usePreview, useNotes, useLogs
│   ├── components/ # layout/, terminal/, preview/, logger/, panels/, shared/
│   └── styles/     # tokens.css, global.css
├── shared/         # IPC channels + types
└── preload/        # contextBridge API
```

## Testing

```bash
npm test
```

Tests live in `tests/unit/`. Currently covers port-detector and route-tracker.

## Design Tokens

```
Background: #0A0A0A / #0F0F0F / #1F1F1F
Border: #2a2a2a
Text: #FAFAFA / #6B7280 / #4B5563
Accents: green #10B981, yellow #F59E0B, red #EF4444, cyan #06B6D4
Font: JetBrains Mono, 13px terminal / 11-12px UI
```
