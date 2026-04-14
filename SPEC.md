# Flowt — Technical Specification

## 1. System Architecture

### 1.1 Process Model

Flowt follows Electron's multi-process architecture with strict security boundaries:

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│  ┌──────────┐ ┌───────────────┐ ┌──────────┐           │
│  │PtyManager│ │PreviewManager │ │CdpLogger │           │
│  │ (n PTYs) │ │(WebContents   │ │ (CDP 1.3)│           │
│  │          │ │  View)        │ │          │           │
│  └────┬─────┘ └───────┬───────┘ └────┬─────┘           │
│       │               │              │                  │
│  ┌────┴─────┐ ┌───────┴───────┐ ┌────┴─────┐           │
│  │PromptDet.│ │  ClaudeView   │ │FileWatch │           │
│  │PortDet.  │ │(WebContents   │ │(chokidar)│           │
│  │RouteTrk. │ │  View)        │ │          │           │
│  └──────────┘ └───────────────┘ └──────────┘           │
│                                                         │
│                 IPC Handlers (42 channels)               │
└─────────────────────┬───────────────────────────────────┘
                      │ contextBridge (vibeAPI)
┌─────────────────────┴───────────────────────────────────┐
│                   Renderer Process                       │
│  ┌─────────────────────────────────────────────┐        │
│  │                  App.tsx                      │        │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐     │        │
│  │  │ useTabs  │ │usePreview│ │ useLogs  │     │        │
│  │  │ useNotes │ │useTerminal│            │     │        │
│  │  └──────────┘ └──────────┘ └──────────┘     │        │
│  │                                              │        │
│  │  ┌────────────────┐  ┌──────────────────┐   │        │
│  │  │   LeftPanel    │  │   RightPanel     │   │        │
│  │  │  TerminalTabs  │  │  Preview/Claude  │   │        │
│  │  │  TerminalView  │  │  UrlBar          │   │        │
│  │  │  InputBar      │  │  LogDrawer       │   │        │
│  │  │  QuickResponse │  │  DeviceSelector  │   │        │
│  │  │  NotesPanel    │  │                  │   │        │
│  │  │  MarkdownPanel │  │                  │   │        │
│  │  └────────────────┘  └──────────────────┘   │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Security Model

- **contextIsolation: true** — renderer cannot access Node.js APIs
- **nodeIntegration: false** — no require() in renderer
- **Preload bridge** — only explicitly exposed methods via `contextBridge.exposeInMainWorld`
- **Fuses** — RunAsNode disabled, cookie encryption enabled, ASAR integrity validation enabled, NodeOptions env var disabled

### 1.3 WebContentsView Strategy

Electron's `WebContentsView` replaces the deprecated `BrowserView`. It renders as a native OS-level surface ABOVE the DOM. This has critical implications:

**Problem**: Any DOM element (dropdowns, modals, floating panels) cannot render on top of a WebContentsView.

**Solutions implemented**:
1. **Floating panels** (Notes, MDs) are constrained to the left panel area, avoiding overlap
2. **Device selector dropdown** hides the preview WebContentsView (bounds → 0,0,0,0) while open, restores on close
3. **Claude tab** hides preview and shows a separate Claude WebContentsView
4. **Layout sync** — the renderer sends rightPanelWidth, headerHeight, and footerHeight to main process so it can calculate correct WebContentsView bounds

**Two independent WebContentsViews**:
- **Preview** — created on first navigation, positioned in the right panel content area
- **Claude** — created on first Claude tab activation, loads claude.ai

---

## 2. Data Architecture

### 2.1 State Management

No external state library (no Redux, no Zustand). State is managed via React hooks in App.tsx:

```
App.tsx
├── useTabs()      → tabs[], activeTabId, addTab, removeTab, setActiveTab, renameTab, setTabActivity, reorderTabs
├── usePreview()   → url, status, activeDevice, navigate, selectDevice, updateBounds, setUrl
├── useNotes()     → content, isOpen, updateContent, toggle, close
├── useLogs()      → logs, allLogs, filter, setFilter, isOpen, toggleOpen, clearLogs
├── useState(mdOpen)
└── useRef(inputBarRef)
```

**Rationale**: The app has ~5 independent state domains with no complex cross-domain interactions. Prop drilling through 2-3 component levels is simpler than introducing a state management library. Each hook encapsulates its own IPC listeners and cleanup.

### 2.2 Tab State Machine

```typescript
type TabAction =
  | { type: 'ADD_TAB'; tab: TabState }
  | { type: 'REMOVE_TAB'; id: string }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'RENAME_TAB'; id: string; title: string }
  | { type: 'SET_ACTIVITY'; id: string; hasActivity: boolean }
  | { type: 'REORDER_TABS'; fromIndex: number; toIndex: number }
```

Managed via `useReducer`. Tab IDs are formatted as `tab-{N}-{timestamp}`. The reducer guarantees at least one tab always exists (REMOVE_TAB auto-activates adjacent tab, won't remove the last tab).

### 2.3 Persistence

| Data | Storage | Lifecycle |
|------|---------|-----------|
| Notes content | electron-store (`notes` key) | Persists across sessions, debounced 1s save |
| Tab state | React state only | Lost on app restart |
| Terminal history | Input bar local state | Lost on app restart |
| Preview URL | React state only | Lost on app restart |
| Log entries | React state (max 500) | Lost on app restart |
| Screenshots | Filesystem (`<project>/.flowt/`) | Persists until deleted |

### 2.4 IPC Communication Patterns

Three patterns used across 36 channels:

| Pattern | Direction | Use Case |
|---------|-----------|----------|
| `invoke` / `handle` | Renderer → Main → Renderer | Request-response: PTY_CREATE, PREVIEW_NAVIGATE, NOTES_LOAD, MD_FILES_READ |
| `send` / `on` | Renderer → Main | Fire-and-forget: PTY_WRITE, PTY_RESIZE, NOTES_SAVE, PREVIEW_SET_BOUNDS |
| `send` / `on` | Main → Renderer | Event broadcast: PTY_DATA, PTY_EXIT, LOG_ENTRY, PREVIEW_STATUS |

All renderer-side listeners return an unsubscribe function for cleanup in `useEffect`.

### 2.5 IPC Channel Reference

**PTY (6 channels)**:
- `pty:create` — invoke: spawn shell, returns tabId
- `pty:data` — main→renderer: PTY output chunk
- `pty:write` — send: write to PTY stdin
- `pty:resize` — send: resize PTY (cols, rows)
- `pty:destroy` — send: kill PTY process
- `pty:exit` — main→renderer: PTY exited (tabId, exitCode)

**Preview (8 channels)**:
- `preview:navigate` — invoke: load URL in WebContentsView
- `preview:set-bounds` — send: show/hide preview (0,0,0,0 = hide)
- `preview:sync-layout` — send: update rightPanelWidth, headerHeight, footerHeight
- `preview:set-device` — send: enable/disable device emulation
- `preview:status` — main→renderer: idle/loading/loaded/error
- `preview:url-changed` — main→renderer: URL after navigation/redirect
- `preview:go-back` — send: navigate back
- `preview:reload` — send: reload current page
- `preview:capture` — invoke: screenshot of preview, returns dataURL

**Detection (3 channels)**:
- `port:detected` — main→renderer: dev server URL detected
- `route:detected` — main→renderer: framework route detected
- `prompt:detected` — main→renderer: interactive prompt detected

**Logs (3 channels)**:
- `log:entry` — main→renderer: new log entry from CDP
- `log:clear` — send: clear log buffer
- `log:get-response-body` — invoke: get network response body by requestId

**Notes (2 channels)**:
- `notes:load` — invoke: read from electron-store
- `notes:save` — send: write to electron-store

**Markdown Files (4 channels)**:
- `md:list` — invoke: list .md files in project
- `md:read` — invoke: read file content
- `md:watch` — invoke: start watching directory
- `md:changed` — main→renderer: file list changed

**App (3 channels)**:
- `app:get-cwd` — invoke: get shell CWD via lsof
- `app:capture-page` — invoke: screenshot of entire app window
- `app:save-temp-image` — invoke: save base64 image to .flowt/

**Claude (4 channels)**:
- `claude:show` — send: show Claude view with bounds
- `claude:hide` — send: hide Claude view
- `claude:set-bounds` — send: update Claude view bounds
- `claude:reload` — send: reload claude.ai

---

## 3. Component Architecture

### 3.1 Layout Hierarchy

```
App
└── SplitLayout (draggable divider, min 400px left / 300px right)
    ├── LeftPanel
    │   ├── TerminalTabs (40px, -webkit-app-region: drag)
    │   │   ├── Logo (visible only in fullscreen)
    │   │   ├── Tab buttons (draggable for reorder, double-click to rename)
    │   │   ├── + button (add tab)
    │   │   └── MDs / Notes buttons (pinned right)
    │   ├── Terminal area (flex: 1)
    │   │   ├── TerminalView × N (CSS display toggle)
    │   │   ├── NotesPanel (floating overlay)
    │   │   └── MarkdownPanel (floating overlay)
    │   ├── QuickResponse (absolute positioned above InputBar)
    │   └── InputBar (~68px, borderTop)
    │       ├── Text attachments (collapsible)
    │       ├── Image thumbnails
    │       ├── Textarea (auto-resize, max 120px)
    │       └── SS / Send buttons
    │
    └── RightPanel
        ├── Tab bar (40px): Preview | Claude [reload]
        ├── Preview content (flex: 1, display toggle)
        │   ├── UrlBar (40px): ← ↻ ● [input] [device selector]
        │   ├── PreviewFrame (flex: 1, placeholder when no URL)
        │   ├── Action buttons (36px): Add logs | Add screenshot
        │   └── LogDrawer (30px header when closed, resizable when open)
        │       ├── Drag handle (6px, visible when open)
        │       ├── Header: // console ▲ | filters | 🗑
        │       └── Log entries (scrollable, 80-600px)
        │
        └── Claude content (flex: 1, display toggle)
            └── Placeholder div for Claude WebContentsView
```

### 3.2 Layout Alignment System

The left and right panels share the same total height. For visual alignment of the bottom edges:

```
Left panel footer:  InputBar = ~68px
Right panel footer: Action buttons (36px) + border (1px) + LogDrawer header (30px) + border (1px) = 68px
```

The preview WebContentsView bounds are calculated as:
```
x = windowWidth - rightPanelWidth
y = headerHeight (80px = tabs + url bar)
width = rightPanelWidth
height = windowHeight - headerHeight - footerHeight
```

**Ownership rule**: `footerHeight` is owned exclusively by LogDrawer. SplitLayout passes `0` for footerHeight in `syncLayout()` to avoid overriding LogDrawer's value during drag.

### 3.3 Terminal Tab Lifecycle

```
1. addTab() → creates TabState { id: "tab-N-timestamp", title: "Terminal N", hasActivity: false }
2. useTerminal hook → creates xterm.js Terminal instance, stores in Map
3. Terminal.open(containerRef) → called ONCE, never again
4. IPC pty:create → spawns shell in main process
5. Tab switching → CSS display:none/block (not mount/unmount)
6. PTY data → pty:data IPC → terminal.write(data) + activity dot if inactive
7. Tab close → confirm dialog → pty:destroy IPC → remove TabState
8. Rename → double-click → contentEditable span → selectAll → blur/Enter to save
```

---

## 4. Detection Systems

### 4.1 Port Detector

Scans PTY output for dev server URLs. Framework-specific patterns are checked first for accuracy, then a generic localhost pattern as fallback.

**Framework patterns**:
| Framework | Pattern | Example Match |
|-----------|---------|---------------|
| Next.js | `started server on 0.0.0.0:PORT` | `ready started server on 0.0.0.0:3000` |
| Vite | `VITE vX.X ready.*localhost:PORT` | `VITE v5.0.0 ready in 200ms -- localhost:5173` |
| Express | `listening on port PORT` | `Server listening on port 4000` |
| Nuxt | `Nuxt ready on localhost:PORT` | `Nuxt ready on http://localhost:3000` |
| SvelteKit | `SvelteKit.*localhost:PORT` | `SvelteKit v2.0.0 localhost:5173` |
| Remix | `remix.*localhost:PORT` | `remix dev http://localhost:3000` |

**Safeguards**: 1000-char buffer limit, 500ms debounce, URL deduplication.

**Status**: Code exists but is NOT wired to PTY output. Detection events are not emitted in production.

### 4.2 Route Tracker

Maps file paths to framework routes when editing patterns are detected in PTY output.

**Framework support**:
| Framework | File Pattern | Route Example |
|-----------|-------------|---------------|
| Next.js App Router | `app/users/[id]/page.tsx` | `/users/:id` |
| Next.js Pages | `pages/users/[id].tsx` | `/users/:id` |
| Remix | `routes/users.$id.tsx` | `/users/:id` |
| Nuxt | `pages/users/[id].vue` | `/users/:id` |
| SvelteKit | `routes/about/+page.svelte` | `/about` |

**Auto-detection**: Scans `package.json` dependencies to determine which framework is in use.

**Status**: Code exists but is NOT wired to PTY output.

### 4.3 Prompt Detector

Scans PTY output for interactive prompts and generates clickable quick-response options.

**Patterns**:
| Input | Detected Options |
|-------|-----------------|
| `(y/n)`, `(Y/n)`, `[yes/no]` | ['Y', 'N'] or ['yes', 'no'] |
| `Allow?`, `Do you want to proceed?` | ['Y', 'N'] |
| `(1/2/3)` | ['1', '2', '3'] |
| `Select...:`, `Choose...:` | ['1', '2', '3'] (heuristic) |

**Safeguards**: 300-char per-tab buffer, 2s debounce per tab.

**Status**: Active — wired to PTY output via PtyManager.

---

## 5. CDP Logger

### 5.1 Protocol Version

Uses Chrome DevTools Protocol v1.3 via `webContents.debugger.attach('1.3')`.

### 5.2 Enabled Domains

```
Runtime.enable  → console API calls, exceptions
Network.enable  → requests, responses, failures
Log.enable      → browser-level log entries
```

### 5.3 Event Processing

| CDP Event | LogEntry Type | Data Extracted |
|-----------|--------------|----------------|
| `Runtime.consoleAPICalled` | log/warn/error/info | args joined as message |
| `Runtime.exceptionThrown` | error | exception description + stack trace |
| `Network.requestWillBeSent` | network-request | method, URL, requestId |
| `Network.responseReceived` | network-response | status code, URL, requestId |
| `Network.loadingFailed` | network-error | errorText, requestId |

### 5.4 Attachment Lifecycle

```
1. First PREVIEW_NAVIGATE → previewManager.create() → cdpLogger.attach() (background, non-blocking)
2. attach() → debugger.attach('1.3') → enable Runtime + Network + Log
3. Navigation → did-navigate event → reattach() to re-enable domains
4. Debugger detach event → this.attached = false (ready for reattach)
```

**Critical design decision**: `cdpLogger.attach()` runs in the background (`catch(() => {})`) to avoid blocking the first navigation. Previously, `await cdpLogger.attach()` caused the first URL entry to appear to do nothing while CDP domains were being enabled.

### 5.5 Log Filtering

| Filter | Matches |
|--------|---------|
| All | Everything |
| Errors | type === 'error' \|\| type === 'network-error' |
| Network | type.startsWith('network-') |
| Console | type in ['log', 'warn', 'error', 'info'] |

---

## 6. User Flows

### 6.1 First Launch

```
1. Electron creates BrowserWindow (1440x900, hiddenInset titlebar)
2. PtyManager, PreviewManager, CdpLogger, FileWatcher, ClaudeView instantiated
3. IPC handlers registered
4. Renderer loads → App.tsx mounts
5. useTabs creates initial tab "Terminal 1"
6. useTerminal creates xterm.js instance, calls PTY_CREATE
7. Shell spawns (zsh/bash), PTY_DATA flows to terminal
8. did-finish-load → sends initial fullscreen state
9. User sees terminal with blinking cursor, ready for input
```

### 6.2 Navigate to Preview URL

```
1. User types URL in UrlBar, presses Enter
2. handleKeyDown reads value from input DOM ref
3. onNavigate(val) → usePreview.navigate()
4. URL normalized (https:// prefix if no protocol)
5. setUrl(normalized) → input shows normalized URL on blur
6. IPC PREVIEW_NAVIGATE fires
7. Main process: if no view → previewManager.create() + cdpLogger.attach() (background)
8. previewManager.navigate(url) → loadURL()
9. did-start-loading → PREVIEW_STATUS 'loading'
10. loadURL may reject with ERR_ABORTED (redirect) → silently ignored
11. did-navigate → PREVIEW_URL_CHANGED + PREVIEW_STATUS 'loaded'
12. User sees page rendered in preview panel
```

### 6.3 Attach Screenshot to Message

```
1. User clicks "Add screenshot" button in RightPanel
2. IPC PREVIEW_CAPTURE → preview WebContentsView.capturePage()
3. Returns base64 dataURL
4. inputBarRef.addImage(dataUrl) → thumbnail appears in InputBar
5. User types message, hits Enter
6. IPC APP_SAVE_TEMP_IMAGE → saves PNG to <project>/.flowt/screenshot-xxx.png
7. File path appended to message parts array
8. Each part (text, then each file path) written to PTY sequentially with 150ms async delays to avoid PTY buffer overflow; text-only messages send instantly
9. \r (Enter) sent after all parts are written (200ms after last part)
10. Claude Code receives message + file paths, reads the images
```

### 6.4 Attach Logs to Message

```
1. User clicks "Add logs" button in RightPanel
2. allLogs formatted as text: "[type] message\n  stackTrace"
3. inputBarRef.appendText(text) → CollapsibleText appears above input
4. If >10 lines, shows collapsed (3 lines) with expand toggle
5. User hits Enter → text prepended to message, sent to PTY
```

### 6.5 Device Emulation

```
1. User clicks device selector button (shows current device name or "Responsive")
2. Dropdown opens → preview WebContentsView hidden (bounds → 0,0,0,0)
3. User selects a preset (e.g., "iPhone 14 Plus")
4. IPC PREVIEW_SET_DEVICE → previewManager.setDeviceEmulation(preset)
5. Scale calculated: min(containerWidth/deviceWidth, containerHeight/deviceHeight, 1)
6. WebContentsView bounds centered within container at scaled size
7. webContents.enableDeviceEmulation({ screenSize, viewSize, deviceScaleFactor, scale })
8. Dropdown closes → preview WebContentsView shown with device bounds
```

### 6.6 Quick Response to Prompt

```
1. Shell output contains "(y/n)" pattern
2. PromptDetector.feed() matches pattern, emits PromptDetection { options: ['Y', 'N'] }
3. IPC PROMPT_DETECTED → renderer
4. QuickResponse component shows buttons: [Y] [N]
5. User clicks [Y]
6. PTY_WRITE sends "Y\r" to terminal
7. Buttons auto-dismiss
```

---

## 7. Build & Distribution

### 7.1 Build Pipeline

```
npm start     → electron-forge start → webpack dev server (port 9000) → Electron launch
npm run package → electron-forge package → .app bundle in out/
npm run make   → electron-forge make → platform-specific installers
```

### 7.2 Webpack Configuration

**Main process** (`webpack.main.config.ts`):
- Entry: `src/main/index.ts`
- External: `node-pty` as `commonjs node-pty` (native module, can't be bundled)
- Loaders: ts-loader (transpileOnly), node-loader, asset-relocator-loader

**Renderer** (`webpack.renderer.config.ts`):
- Entry: `src/renderer/index.tsx` (via Forge plugin)
- Loaders: ts-loader, style-loader + css-loader, asset/resource for fonts and images
- Preload: `src/preload/index.ts` (separate entry point)

**Type checking**: ForkTsCheckerWebpackPlugin runs in background (not blocking builds).

### 7.3 Native Module Handling

`node-pty` requires native compilation against Electron's Node ABI:
1. `@electron-forge/plugin-auto-unpack-natives` — rebuilds native modules during packaging
2. Webpack external declaration — prevents webpack from trying to bundle the .node file
3. ASAR unpacking — native .node files extracted from asar archive at runtime

### 7.4 Electron Fuses (Security)

```
RunAsNode: false                        — prevents ELECTRON_RUN_AS_NODE
EnableCookieEncryption: true            — encrypts cookies on disk
EnableNodeOptionsEnvironmentVariable: false — blocks NODE_OPTIONS injection
EnableNodeCliInspectArguments: false     — blocks --inspect debugging
EnableEmbeddedAsarIntegrityValidation: true — validates asar integrity
OnlyLoadAppFromAsar: true               — prevents loading from filesystem
```

### 7.5 Platform Makers

| Maker | Platform | Output |
|-------|----------|--------|
| MakerSquirrel | Windows | NSIS installer |
| MakerZIP | macOS | ZIP archive |
| MakerRpm | Linux | RPM package |
| MakerDeb | Linux | DEB package |

---

## 8. Testing

### 8.1 Test Infrastructure

- **Framework**: Jest 30.3 + ts-jest 29.4
- **Environment**: Node (not jsdom — tests are for main process modules)
- **Location**: `tests/unit/`
- **Coverage**: Port detector (18 tests), Route tracker (22 tests)

### 8.2 Port Detector Tests

Tests cover:
- Framework-specific URL detection (Next.js, Vite, Express, Nuxt, SvelteKit)
- Generic localhost URL extraction
- Full path preservation (`http://localhost:3000/api/users`)
- Streaming input (data split across multiple chunks)
- Debounce behavior (500ms window)
- Duplicate URL suppression
- Buffer size limiting (>1000 chars)
- False positive prevention (non-server output)

### 8.3 Route Tracker Tests

Tests cover:
- Next.js App Router: static routes, dynamic `[id]`, route groups `(group)`, root page
- Next.js Pages Router: index pages, dynamic routes, nested paths
- Remix: dot-separated routes, `$param` parameters, `_index`
- Nuxt: Vue file routes, dynamic `[id]`
- SvelteKit: `+page.svelte` routes, dynamic segments, route groups
- Non-page file filtering (layouts, components)
- PTY output pattern matching ("Editing file.tsx", "Wrote file.tsx")

### 8.4 Untested Areas

- PTY management (integration-heavy, requires real shell)
- React components (would need jsdom/testing-library)
- IPC handlers (would need Electron test harness)
- Preview/CDP logging (requires WebContentsView)
- Prompt detection (could be unit tested, not yet)

---

## 9. Type System

### 9.1 Shared Types (Main ↔ Renderer)

```typescript
interface TabInfo { id: string; title: string; hasActivity: boolean; isActive: boolean }
interface DevicePreset { name: string; width: number; height: number; deviceScaleFactor: number; category?: string }
interface LogEntry { id: string; type: LogEntryType; message: string; timestamp: number; stackTrace?: string; url?: string; method?: string; statusCode?: number; requestId?: string }
interface PortDetection { port: number; url: string; framework?: string }
interface PromptDetection { tabId: string; options: string[]; rawText: string }
interface RouteDetection { route: string; filePath: string; framework: string }
interface PreviewBounds { x: number; y: number; width: number; height: number }
interface MdFileInfo { path: string; name: string; relativePath: string }
type PreviewStatus = 'idle' | 'loading' | 'loaded' | 'error'
```

### 9.2 Renderer Types

```typescript
type InputMode = 'chat' | 'terminal'
interface TabState { id: string; title: string; hasActivity: boolean }
type TabAction = ADD_TAB | REMOVE_TAB | SET_ACTIVE | RENAME_TAB | SET_ACTIVITY | REORDER_TABS
type LogFilter = 'all' | 'errors' | 'network' | 'console'
```

### 9.3 Preload API Type

The full `VibeAPI` type is inferred from the preload object and declared globally on `Window`. This ensures type safety across the IPC boundary without manual type duplication.

---

## 10. Design System

### 10.1 Color Palette

```css
--bg-primary:    #0A0A0A   /* Deep black — terminal, main backgrounds */
--bg-secondary:  #0F0F0F   /* Slightly lighter — panels, tab bar, input */
--bg-tertiary:   #1F1F1F   /* Hover states, nested elements */
--border:        #2a2a2a   /* All borders and dividers */
--text-primary:  #FAFAFA   /* Main text, active tabs */
--text-secondary:#6B7280   /* Secondary text, inactive tabs */
--text-muted:    #4B5563   /* Hints, placeholders, disabled */
--accent-green:  #10B981   /* Success, active, send button, activity dot */
--accent-yellow: #F59E0B   /* Warnings, notes keywords */
--accent-red:    #EF4444   /* Errors, close buttons, log clear hover */
--accent-cyan:   #06B6D4   /* Links, MDs button, log attach */
```

### 10.2 Typography

```css
--font-mono: 'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace
--font-size-terminal: 13px  /* Terminal text */
--font-size-ui: 12px        /* General UI */
--font-size-sm: 11px        /* Small labels, buttons */
--line-height-terminal: 1.8
```

### 10.3 Spacing & Dimensions

```css
--tab-height: 40px
--input-height: 48px        /* Declared but InputBar uses ~68px actual */
--url-bar-height: 36px
--log-max-height: 200px
```

### 10.4 Interaction Patterns

- **Hover**: background → `--bg-tertiary`, or color brightens
- **Drag handles**: `--border` color → `--accent-green` on hover
- **Close buttons**: `--text-muted` → `--accent-red` on hover
- **Clear (trash) button**: `--text-muted` → `#b91c1c` (dark red) on hover
- **Active tabs**: `--bg-primary` background with bottom border
- **Scrollbars**: 3px wide, rounded, subtle on hover
- **Selection**: green with 30% opacity

---

## 11. Known Issues & Technical Debt

1. **`--input-height` token mismatch** — declared as 48px but InputBar renders ~68px. The token is unused by InputBar itself.
2. **Port detector / Route tracker** — fully implemented but disconnected from PTY output. Could be re-enabled with a user preference.
3. **CDP reattach** — after `did-navigate`, `reattach()` tries `dbg.attach('1.3')` which throws if already attached. The catch silently returns, leaving `this.attached = false`. Logging may stop working after the first redirect.
4. **Single window** — no multi-window support. Opening a second window would require separate manager instances.
5. **No error recovery for preview** — if WebContentsView crashes, the view stays blank with no recovery UI.
6. **Max 500 logs** — older entries dropped silently. No persistence or export.
7. **Notes not project-scoped** — a single global note, not per-project. Stored in electron-store's default location.
8. **macOS only** — CWD detection via `lsof` is macOS-specific. `fix-path` is macOS-specific. Traffic light positioning is macOS-specific.
