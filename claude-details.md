# Flowt — Design Decisions & Details

## Core Concept

A terminal emulator that wraps around Claude Code, adding a split-panel layout with live browser preview, console logging, a scratchpad, markdown reader, and Claude.ai integration — without intercepting or modifying the terminal session.

## Architecture Decisions

### Window Configuration
- **titleBarStyle: 'hiddenInset'** — maximizes vertical space, native Mac traffic lights embedded at (12, 12)
- **1440x900 default, 1024 min-width** — optimized for side-by-side terminal + preview
- **backgroundColor: '#0A0A0A'** — prevents white flash on startup
- **Fullscreen state** sent on `did-finish-load` to ensure logo visibility is correct on launch

### Terminal (xterm.js)
- **CSS display toggle** instead of mount/unmount for tabs — `Terminal.open()` can only be called once per instance
- **FitAddon + ResizeObserver** — terminal auto-resizes to fill container, PTY gets resize signals
- **WebLinksAddon with custom handler** — localhost URLs open in the preview panel, external URLs open in default browser
- **Tab rename** — double-click to edit, auto-selects all text for immediate replacement

### Input System
- **Single chat input bar** — compose messages, hit Enter to send to PTY via `\r` (carriage return, not `\n`)
- **Text attachments** (logs) shown as collapsible blocks above input — expand/collapse for 10+ lines
- **Image attachments** saved to `<project>/.flowt/screenshot-xxx.png`, file paths sent to PTY sequentially with 150ms delays to avoid buffer overflow (text-only messages send instantly)
- **Ctrl+C** always sends SIGINT (`\x03`) regardless of focus

### Preview (WebContentsView)
- **WebContentsView** (not BrowserView, not iframe) — Electron 30+ API, renders as native child view
- **Z-order issue**: WebContentsView renders ABOVE all DOM content. Floating panels (Notes, MDs) anchor to the left panel area only. Device selector dropdown temporarily hides the WebContentsView (setBounds to 0,0,0,0) then restores via show().
- **Device emulation** uses `enableDeviceEmulation` with calculated scale factor: `Math.min(availableWidth / deviceWidth, availableHeight / deviceHeight, 1)` to fit within the panel
- **"Responsive"** is the default (no emulation, fills available space)
- **128 device presets** across 12 categories (iPhone, iPad, Samsung, Pixel, OnePlus, Xiaomi, Motorola, OPPO, Realme, Sony, Desktop)
- **URL normalization** defaults to `https://` when no protocol is specified
- **ERR_ABORTED handling** — redirects (e.g., `https://site` → `https://site/`) rejected by `loadURL` are silently ignored instead of showing error status

### Claude.ai View
- **Separate WebContentsView** for claude.ai — renders as floating overlay in the right panel
- **Tab switching** between Preview, Claude, and Tasks — preview is hidden when Claude or Tasks tab is active
- **Reload button** appears next to Claude tab name when active
- **Bounds synced** via ResizeObserver and window resize events

### Console Logger (CDP)
- Attaches to preview via `webContents.debugger` using Chrome DevTools Protocol
- **Non-blocking attachment** — `cdpLogger.attach()` runs in background to avoid blocking first navigation
- Captures: `Runtime.consoleAPICalled`, `Runtime.exceptionThrown`, `Network.requestWillBeSent`, `Network.responseReceived`, `Network.loadingFailed`
- Re-enables domains after navigation (`did-navigate` event)
- Max 500 log entries retained
- **Clear button** — trash icon that turns dark red (#b91c1c) on hover

### Layout Alignment
- **Footer height ownership** — LogDrawer is the sole owner of `footerHeight` in the preview layout. SplitLayout passes `0` for footerHeight in `syncLayout()` to avoid overriding LogDrawer's value when dragging the split divider.
- **Footer = 68px** when drawer is closed (36px action buttons + 1px border + 30px header + 1px border), matching the InputBar height on the left panel for visual alignment.
- **Preview bounds** recalculated on window resize, split drag, and log drawer resize.

### Port Detection
- Originally auto-detected dev server ports from PTY output and navigated the preview
- **Removed from auto-navigation**: user found auto-navigation unreliable. Now relies on clicking terminal links (intercepted by WebLinksAddon) or manual URL entry
- Port detector and route tracker code still exists in `src/main/` but is not wired to PTY output
- Supports: Next.js, Vite, Express, Nuxt, SvelteKit, Remix, generic localhost patterns

### Prompt Detection
- Scans PTY output for `(y/n)`, `(Y/n)`, `[yes/no]`, `Allow?`, `Choose:` patterns
- Shows clickable quick-response buttons above the input bar
- Auto-dismisses after 10s or on new PTY output
- Per-tab buffers with 300 char limit, 2s debounce

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
- Confirmation dialog on close: "This will terminate the running process."
- Tab activity dot (green) for unseen output on inactive tabs
- Double-click to rename with auto-select all text
- Drag to reorder

### Screenshots
- Saved to `<project-cwd>/.flowt/` directory (detected from shell's CWD)
- This keeps them accessible to Claude Code which can read files from the project
- Add `.flowt` to `.gitignore`

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
| @xterm/addon-fit | Auto-resize terminal to container |
| @xterm/addon-search | Ctrl+F search in terminal |
| @xterm/addon-web-links | Clickable URLs in terminal output |
| react/react-dom | UI framework |
| fix-path | Fix $PATH in macOS GUI Electron apps |
| electron-store | Persist notes and checklists across sessions |
| chokidar | Watch .md files and project-implementation.md for live updates |
| marked | Render markdown in the MDs panel |
| @electron-forge/maker-dmg | Build macOS DMG installer |

### Image Annotator
- Full annotation overlay on screenshot attachments before sending
- Canvas-based: mouse events on a transparent canvas overlaying the image
- **7 tools**: pen (freehand), line, arrow, rect, circle, text, and move/resize
- 5 predefined colors: red (#EF4444), green (#10B981), yellow (#F59E0B), cyan (#06B6D4), white (#FFFFFF)
- Stroke width scales with image resolution (`canvasWidth / 200`, min 3px)
- Shape resizing with proportional scaling of line width and font size
- Shape movement with (dx, dy) translation
- Selection feedback: cyan dashed box with corner handles
- Keyboard shortcuts: Delete/Backspace to remove shape, Cmd/Ctrl+Z to undo
- Text input: click to place, type, Enter to submit, Escape to cancel
- Save composites original image + all annotations into a single PNG dataURL that replaces the attachment
- Image has `pointer-events: none` and `draggable={false}` to prevent browser drag interference

### Checklists Panel
- Tabbed checklist system accessible from "Checklists" button in the terminal tab bar
- Multiple named checklists with add/remove/rename (double-click tab to rename)
- Items: add via input at bottom, toggle with checkbox, remove on hover × button
- "Clear done" button appears when any items are checked
- Persisted via electron-store under dedicated `checklists` key (separate from notes)
- Checkboxes styled: transparent background, gray border, green SVG checkmark when done
- Mutual exclusion: opening Checklists closes Notes and MDs panels

### Notes Formatting
- Toolbar in notes header: Bold (**), Heading (#/##/###), Bullet (-), Numbered (1.)
- Auto-continuation on Enter: pressing Enter on a `- ` or `1. ` line auto-inserts the next prefix
- Empty list item on Enter removes the prefix (exits list mode)
- Heading cycles: # → ## → ### → plain text
- Overlay highlights: `**bold**` renders bold, `# headings` render bold + larger font

### Attach Logs Modal
- Clicking "Add logs" opens a modal instead of directly attaching all logs
- Log type filter: All, Errors, Network, Console, Verbose (with icons)
- Record count: All records, Last 25, Last 100
- "Always remember my selection" checkbox persisted to localStorage
- Only browser logs included — app verbose logs are excluded at the source
- Dynamic button text: "Attach N logs" shows the count

### Log Drawer Tabs
- Split into Browser and App tabs
- Browser tab: preview site logs with All/Errors/Network/Console/Verbose filters on separate row
- App tab: Flowt internal verbose logs (PTY, preview, CDP, screenshots, Claude events)
- Verbose browser filter shows `console.debug()` calls from the preview site
- Tabs only visible when drawer is open; closed state shows error count badge

### DMG Packaging
- `@electron-forge/maker-dmg` with ULFO format
- `packageAfterCopy` hook copies `node-pty` into packaged app's `node_modules/`
- ASAR unpack pattern: `**/node_modules/{node-pty,nan}/**` ensures native `.node` binaries are accessible
- CSP meta tag added to suppress Electron security warnings in dev mode

### Terminal Search
- Cmd+F opens a search bar floating top-right of the terminal
- Uses xterm.js SearchAddon for buffer search
- Enter for next match, Shift+Enter for previous, Escape to close
- Highlights matches in the terminal buffer

### Terminal Font Zoom
- Cmd+/Cmd- changes terminal and compose bar font size (CSS variable `--font-size-terminal` synced with xterm)
- Range: 8px to 28px, default 13px
- Cmd+0 resets to default
- Overrides Electron's default zoom behavior via custom menu items
- Automatically refits the terminal after font size change

### App Font Zoom
- Cmd+Option+/Cmd+Option- scales all three CSS font variables (`--font-size-terminal`, `--font-size-ui`, `--font-size-sm`)
- Range: -4px to +8px offset from defaults
- Cmd+Option+0 resets all to defaults

### Copy Last Claude Message
- Small Copy icon button at bottom-right of terminal viewport during Claude Code sessions
- Detection: xterm buffer scan every 1.5s for `? for shortcuts` or `esc to interrupt` strings (Claude TUI footer markers); flag clears naturally when xterm switches back from the alternate buffer
- Action: writes `/copy\r` to the PTY — leverages Claude Code's built-in `/copy` slash command, which copies the most recent response to the system clipboard (with an interactive picker if the response contains code blocks)
- Cmd+Option+V keyboard shortcut wired alongside the button (matches on `e.code === 'KeyV'` because Option transforms the key character on macOS)
- Visual: light gray text → primary on hover, semi-transparent dark background with backdrop blur, matching Flowt action button language

### Scroll Position Preservation
- `fit()` saves and restores viewport position when user is scrolled up
- Prevents jump-to-top during resize while reading history
- Only sends PTY resize when cols/rows actually change

### Full Disk Access Check
- On startup, attempts to read ~/Desktop to test file access permissions
- If denied, shows a dialog explaining the requirement with a button to open System Settings → Privacy & Security → Full Disk Access
- User can skip with "Continue Anyway" but CLI tools may fail in protected directories

### PTY Environment
- Spawns as login shell (`--login`) to source user's PATH config
- Strips `ELECTRON_*`, `CHROME_*`, `GOOGLE_*`, and `NODE_OPTIONS` from env
- Preserves all other env vars for MCP servers, hooks, and CLI tools
- Sets `TERM_PROGRAM=Flowt`

### Tasks Panel — MD Persistence
- Source of truth is `project-implementation.md` in the terminal's CWD (detected via lsof)
- **Parser** (`task-md-parser.ts`): splits by `---` separator, extracts `##` titles, `**Status:**`/`**Category:**`/`**ID:**` fields, body between ID and `### Feedback`, comment/feedback entries with timestamps
- **Writer** (`task-md-writer.ts`): serializes tasks back to MD format, recalculates header summary counts, atomic writes (temp file → rename)
- **File watcher**: dedicated chokidar instance on `project-implementation.md`, skips self-triggered writes via a 500ms flag
- **CWD polling**: every 2s checks if terminal CWD changed, reloads tasks if new directory
- **Two-way sync**: UI changes write to MD immediately (300ms debounce), external changes (Claude Code, text editors) reload the panel
- **ID generation**: `task-001`, `task-002`, etc. — increments from highest existing ID, zero-padded to 3 digits
- **Send to terminal**: auto-adds "Sent to terminal" comment with timestamp, changes status to `in_progress` if `todo`
- **Feedback section**: separate from comments, yellow-accented in UI, `### Feedback` section in MD
- **CSV import**: modal with drag-and-drop zone, downloadable template, parses title/description/status/category columns
- **Error states**: not_found (empty message + prompt to create first task), error (message + retry button), parse_error (message)
- 47 unit tests: 31 parser tests, 16 writer/round-trip tests

## Known Limitations

- WebContentsView z-order means floating UI can't overlap the preview area
- Device emulation scale can make small text hard to read on large device presets
- Shell CWD detection via lsof is macOS-only
- Screenshots are PNG only
- No image preview in Claude Code's terminal input (file path is sent, Claude reads it)
- Port detector and route tracker exist in code but are not wired to auto-navigate
- Claude.ai view depends on being logged in via browser cookies
