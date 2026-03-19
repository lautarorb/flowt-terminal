# VibeTerminal — Design Decisions & Details

## Core Concept

A terminal emulator that wraps around Claude Code, adding a split-panel layout with live browser preview, console logging, a scratchpad, and markdown reader — without intercepting or modifying the terminal session.

## Architecture Decisions

### Window Configuration
- **titleBarStyle: 'hiddenInset'** — maximizes vertical space, native Mac traffic lights embedded at (12, 12)
- **1440x900 default, 1024 min-width** — optimized for side-by-side terminal + preview
- **backgroundColor: '#0A0A0A'** — prevents white flash on startup

### Terminal (xterm.js)
- **CSS display toggle** instead of mount/unmount for tabs — `Terminal.open()` can only be called once per instance
- **FitAddon + ResizeObserver** — terminal auto-resizes to fill container, PTY gets resize signals
- **WebLinksAddon with custom handler** — localhost URLs open in the preview panel, external URLs open in default browser
- **No terminal mode input bar** — removed in favor of letting users click directly into Claude Code's native `❯` prompt, which has full autocomplete/shortcuts support. Only the chat compose bar remains.

### Input System
- **Single chat input bar** — compose messages, hit Enter to send to PTY via `\r` (carriage return, not `\n`)
- **Text attachments** (logs) shown as collapsible blocks above input — expand/collapse for 10+ lines
- **Image attachments** saved to `<project>/.vibeterminal/screenshot-xxx.png`, file path sent to PTY so Claude Code can read them
- **Ctrl+C** always sends SIGINT (`\x03`) regardless of focus

### Preview (WebContentsView)
- **WebContentsView** (not BrowserView, not iframe) — Electron 30+ API, renders as native child view
- **Z-order issue**: WebContentsView renders ABOVE all DOM content. Floating panels (Notes, MDs) anchor to the left panel area only. Device selector dropdown temporarily hides the WebContentsView (setBounds to 0,0,0,0) then restores via resize event.
- **Device emulation** uses `enableDeviceEmulation` with calculated scale factor: `Math.min(availableWidth / deviceWidth, availableHeight / deviceHeight, 1)` to fit within the panel
- **"Responsive"** is the default (no emulation, fills available space)

### Console Logger (CDP)
- Attaches to preview via `webContents.debugger` using Chrome DevTools Protocol
- Captures: `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Network.requestWillBeSent`, `Network.responseReceived`, `Network.loadingFailed`
- Re-enables domains after navigation (`did-navigate` event)
- Max 500 log entries retained

### Port Detection (removed from auto-navigation)
- Originally auto-detected dev server ports from PTY output and navigated the preview
- **Removed**: user found auto-navigation unreliable. Now relies on clicking terminal links (intercepted by WebLinksAddon) or manual URL entry
- Port detector and route tracker code still exists in `src/main/` but is not wired to PTY output

### Prompt Detection
- Scans PTY output for `(y/n)`, `(Y/n)`, `[yes/no]`, `Allow?`, `Choose:` patterns
- Shows clickable quick-response buttons above the input bar
- Auto-dismisses after 10s or on new PTY output

### Markdown Panel
- Detects project folder from the **shell's actual CWD** (via `lsof -a -p PID -d cwd` on macOS), not Electron's process.cwd()
- Recursively scans for `.md` files, ignores node_modules/.git/dist/build/.next
- Uses chokidar for live watching, marked for rendering
- Shows detected path in panel header

### Notes Panel
- Plain textarea with highlighted overlay technique: transparent-text textarea handles editing, overlay `<pre>` renders colored keywords
- Keywords: `todo:` (green), `questions:` (yellow), `api keys:` (cyan)
- Persisted via electron-store, debounced save (1s)

### Tab System
- Tabs scroll horizontally when overflow, MDs/Notes buttons pinned on right with separator
- Close button always visible (60% opacity), turns red on hover
- Confirmation dialog on close: "This will terminate the process and notes will be lost."
- Tab activity dot (green) for unseen output on inactive tabs

### Screenshots
- Saved to `<project-cwd>/.vibeterminal/` directory (detected from shell's CWD)
- This keeps them accessible to Claude Code which can read files from the project
- Add `.vibeterminal` to `.gitignore`

### Native Module Handling
- `node-pty` declared as webpack external (`commonjs node-pty`) in `webpack.main.config.ts`
- `@electron-forge/plugin-auto-unpack-natives` handles rebuilding against Electron's Node ABI
- `fix-path` imported dynamically at startup to fix macOS GUI app PATH issue

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| --bg-primary | #0A0A0A | Main backgrounds, terminal |
| --bg-secondary | #0F0F0F | Panels, input bars, tab bar |
| --bg-tertiary | #1F1F1F | Hover states, buttons |
| --border | #2a2a2a | All borders |
| --text-primary | #FAFAFA | Main text |
| --text-secondary | #6B7280 | Secondary text, inactive tabs |
| --text-muted | #4B5563 | Hints, placeholders |
| --accent-green | #10B981 | Active states, success, send button |
| --accent-yellow | #F59E0B | Warnings, notes keywords |
| --accent-red | #EF4444 | Errors, close buttons |
| --accent-cyan | #06B6D4 | Links, device selector, MDs button |

## Dependencies & Rationale

| Package | Why |
|---------|-----|
| node-pty | PTY emulation for real terminal sessions |
| @xterm/xterm | Terminal rendering in the browser |
| react/react-dom | UI framework |
| fix-path | Fix $PATH in macOS GUI Electron apps |
| electron-store | Persist notes across sessions |
| chokidar | Watch .md files for live updates |
| marked | Render markdown in the MDs panel |

## Known Limitations

- WebContentsView z-order means floating UI can't overlap the preview area
- Device emulation scale can make small text hard to read on large device presets
- Shell CWD detection via lsof is macOS-only
- Screenshots are PNG only
- No image preview in Claude Code's terminal input (file path is sent, Claude reads it)
