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
- **Main process**: `src/main/` — PTY management, preview WebContentsView, CDP logging, file watching, prompt/port/route detection, Claude.ai view, task MD parser/writer
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
- Cmd+F opens terminal search bar, Cmd+/- zooms terminal + compose bar font, Cmd+0 resets
- Cmd+Option+/- zooms all app fonts (terminal, UI, small text), Cmd+Option+0 resets
- Startup checks for Full Disk Access and prompts user to grant it if missing
- PTY spawns as login shell (`--login`) with cleaned env (strips ELECTRON_* vars)
- `fit()` preserves scroll position when user is scrolled up reading history
- Image attach writes each part (text, then each file path) sequentially with 150ms async delays to avoid PTY buffer overflow; text-only messages send instantly
- ImageAnnotator supports 7 tools: pen (freehand), line, arrow, rect, circle, text, and move/resize with proportional scaling
- Tasks panel is the third tab in the right panel (Preview, Claude, Tasks) with full CRUD, drag-to-reorder, drag-to-status-tab, inline markdown editing, image attachments with annotator, comments, feedback, and "send to terminal" that populates the compose bar
- Tasks persist to `project-implementation.md` in the terminal's CWD — the MD file is the single source of truth, enabling two-way sync with Claude Code and external editors
- Task MD parser/writer with atomic writes (temp file → rename) and 47 unit tests verifying round-trip fidelity
- File watcher (chokidar) detects external changes to project-implementation.md and updates the Tasks panel without full reload
- CWD polling every 2s auto-detects when user `cd`s into a project directory and loads its tasks
- "Send to terminal" auto-adds a timestamped comment ("Sent to terminal") and changes status to in_progress if it was todo
- Text attachments in InputBar support custom labels (e.g., "task details" vs "attached logs") via the `label` parameter on `appendText`
- CSV import modal with drag-and-drop upload zone and downloadable template file

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
│   ├── task-md-parser.ts # Parse project-implementation.md → task data structures
│   ├── task-md-writer.ts # Serialize task data → project-implementation.md (atomic writes)
│   ├── prompt-detector.ts # y/n and choice detection in PTY output
│   ├── port-detector.ts # Dev server URL detection (Next, Vite, Express, etc.)
│   ├── route-tracker.ts # Framework route file detection
│   ├── ipc-handlers.ts  # All IPC channel handlers + verbose logging
│   └── menu.ts          # macOS menu with Cmd+T/Cmd+W shortcuts, zoom shortcuts
├── renderer/            # React UI
│   ├── App.tsx          # Root component, hook coordination, keyboard shortcuts
│   ├── hooks/           # useTerminal (search, zoom), useTabs, usePreview, useNotes, useLogs, useChecklists, useTasks
│   ├── components/
│   │   ├── layout/      # SplitLayout, LeftPanel, RightPanel
│   │   ├── terminal/    # TerminalView, TerminalTabs, InputBar, QuickResponse
│   │   ├── preview/     # PreviewFrame, UrlBar, DeviceSelector, device-presets
│   │   ├── logger/      # LogDrawer, LogFilter, LogEntry, AttachLogsModal
│   │   ├── panels/      # NotesPanel, MarkdownPanel, MarkdownFileRow, ChecklistPanel, TasksPanel, TaskCard, TaskCardExpanded, ImportTasksModal
│   │   └── shared/      # ActionButton, AttachmentThumb, ImageAnnotator (7 tools: pen, line, arrow, rect, circle, text, move)
│   ├── lib/types.ts     # TabState, TabAction, LogFilter, InputMode
│   └── styles/          # tokens.css, global.css, fonts.css
├── shared/              # IPC channels (42 channels) + types (9 exports)
└── preload/             # contextBridge API (43+ methods across 14 namespaces)
```

## Task MD File Format

Tasks are stored in `project-implementation.md` in the project directory. Format:

```markdown
# Project Implementation

> Generated: 2026-03-31
> Spec: filename-of-the-spec.md
> Total tasks: 24 | Todo: 18 | In Progress: 1 | Done: 4 | Ideas: 3

---

## Task title here

**Status:** todo
**Category:** Phase 1
**ID:** task-001

Task description in full detail. Full markdown supported.

### Feedback
- 2026-03-31 12:00 — Feedback entry here

### Comments
- 2026-03-31 10:42 — Comment entry here

---
```

Rules: `##` is always a task title. Fields Status/Category/ID always present in that order. ID is unique (`task-001`, `task-002`, etc.), never changes. `### Feedback` and `### Comments` always present even if empty. Header summary auto-updates on status changes. `---` separator after every task.

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

Tests live in `tests/unit/`. Covers:
- port-detector (24 tests)
- route-tracker (24 tests)
- task-md-parser (31 tests) — header parsing, task extraction, feedback/comments, status normalization, edge cases
- task-md-writer (16 tests) — serialization, round-trip fidelity (parse→write→parse identical), ID generation

## Design Tokens

```
Background: #0A0A0A / #0F0F0F / #1F1F1F
Border: #2a2a2a
Text: #FAFAFA / #6B7280 / #4B5563
Accents: green #10B981, yellow #F59E0B, red #EF4444, cyan #06B6D4, blue #3B82F6
Font: JetBrains Mono, 13px terminal / 11-12px UI
```
