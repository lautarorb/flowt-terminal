# Flowt

Mac-only Electron terminal emulator purpose-built for Claude Code workflows.

## Quick Start

```bash
npm install
npm start        # Dev mode
npm test         # Run unit tests
npm run make     # Build DMG for distribution
```

## Architecture

- **Electron Forge** with webpack-typescript template
- **Main process**: `src/main/` — PTY management, preview WebContentsView, CDP logging, file watching, prompt/port/route detection, Claude.ai view
- **Renderer**: `src/renderer/` — React UI with xterm.js terminal
- **Preload**: `src/preload/` — typed IPC bridge (`window.vibeAPI`)
- **Shared**: `src/shared/` — IPC channel constants and type definitions

## Key Patterns

- `node-pty` is externalized in webpack (`webpack.main.config.ts`) — it can't be bundled
- `node-pty` is copied into the packaged app via `packageAfterCopy` hook in `forge.config.ts` and unpacked from ASAR for native binary access
- `WebContentsView` renders ABOVE all DOM content — floating panels (Notes, Checklists, MDs) anchor to the left panel to avoid z-order conflicts
- The device selector temporarily hides the WebContentsView when its dropdown is open
- xterm.js `Terminal.open()` can only be called once — tabs use CSS `display: none/block`, not mount/unmount
- `fix-path` is called at startup to inherit the user's $PATH (Electron GUI apps get minimal PATH)
- PTY shell CWD is detected via `lsof -a -p PID -d cwd` on macOS
- Screenshots are saved to `<project>/.flowt/` so Claude Code can access them
- CDP logger attaches in background to avoid blocking first navigation
- `ERR_ABORTED` from redirects is ignored (not treated as navigation error)
- URLs default to `https://` when no protocol is specified
- Preview footer height is owned by LogDrawer — SplitLayout passes 0 to avoid overriding it
- Initial fullscreen state is sent on `did-finish-load` to ensure correct logo visibility
- CSP meta tag suppresses Electron security warnings in dev mode
- Cmd+F opens terminal search bar, Cmd+/- zooms terminal font only (not entire UI), Cmd+0 resets
- Startup checks for Full Disk Access and prompts user to grant it if missing
- PTY spawns as login shell (`--login`) with cleaned env (strips ELECTRON_* vars)
- `fit()` preserves scroll position when user is scrolled up reading history
- Image attach writes each part (text, then each file path) sequentially with 150ms async delays to avoid PTY buffer overflow; text-only messages send instantly
- ImageAnnotator supports 7 tools: pen (freehand), line, arrow, rect, circle, text, and move/resize with proportional scaling

## Project Structure

```
src/
├── main/               # Electron main process
│   ├── index.ts         # App entry, window creation, fullscreen events
│   ├── pty-manager.ts   # PTY spawning, I/O, CWD detection via lsof
│   ├── preview-manager.ts # WebContentsView positioning, device emulation
│   ├── cdp-logger.ts    # Chrome DevTools Protocol logging (incl. console.debug)
│   ├── claude-view.ts   # Claude.ai floating WebContentsView
│   ├── file-watcher.ts  # Markdown file discovery via chokidar
│   ├── prompt-detector.ts # y/n and choice detection in PTY output
│   ├── port-detector.ts # Dev server URL detection (Next, Vite, Express, etc.)
│   ├── route-tracker.ts # Framework route file detection
│   ├── ipc-handlers.ts  # All IPC channel handlers + verbose logging
│   └── menu.ts          # macOS menu with Cmd+T/Cmd+W shortcuts
├── renderer/            # React UI
│   ├── App.tsx          # Root component, hook coordination, keyboard shortcuts
│   ├── hooks/           # useTerminal (search, zoom), useTabs, usePreview, useNotes, useLogs, useChecklists
│   ├── components/
│   │   ├── layout/      # SplitLayout, LeftPanel, RightPanel
│   │   ├── terminal/    # TerminalView, TerminalTabs, InputBar, QuickResponse
│   │   ├── preview/     # PreviewFrame, UrlBar, DeviceSelector, device-presets
│   │   ├── logger/      # LogDrawer, LogFilter, LogEntry, AttachLogsModal
│   │   ├── panels/      # NotesPanel, MarkdownPanel, MarkdownFileRow, ChecklistPanel
│   │   └── shared/      # ActionButton, AttachmentThumb, ImageAnnotator (7 tools: pen, line, arrow, rect, circle, text, move)
│   ├── lib/types.ts     # TabState, TabAction, LogFilter, InputMode
│   └── styles/          # tokens.css, global.css, fonts.css
├── shared/              # IPC channels (38 channels) + types (9 exports)
└── preload/             # contextBridge API (39+ methods across 13 namespaces)
```

## Building & Distribution

```bash
npm run make                                    # Build all targets
npm run make -- --targets @electron-forge/maker-dmg  # DMG only
```

DMG output: `out/make/Flowt-VERSION-arm64.dmg`

## Testing

```bash
npm test
```

Tests live in `tests/unit/`. Covers port-detector (24 tests) and route-tracker (24 tests).

## Design Tokens

```
Background: #0A0A0A / #0F0F0F / #1F1F1F
Border: #2a2a2a
Text: #FAFAFA / #6B7280 / #4B5563
Accents: green #10B981, yellow #F59E0B, red #EF4444, cyan #06B6D4
Font: JetBrains Mono, 13px terminal / 11-12px UI
```
