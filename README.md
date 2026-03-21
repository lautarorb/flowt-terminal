# flowt

A Mac terminal emulator purpose-built for vibe coding with Claude Code.

Claude Code is already great. The terminal it lives in wasn't built for it. Flowt is. It adds no intelligence, makes no API calls, and has no opinion about your code. It's purely a better-shaped window for the way a vibe coding session actually runs.

![flowt](https://img.shields.io/badge/platform-macOS-black) ![license](https://img.shields.io/badge/license-MIT-green) ![electron](https://img.shields.io/badge/electron-41-blue)

## Features

### Side Live Preview
Embedded Chromium browser on the right, terminal on the left. Type a URL in the URL bar, hit Enter, and see your app live while you build. Everything in one window.

### One Click Screenshot Attach
Capture the current preview state and drop it as an image into your next message to Claude Code. Sent directly into the terminal as a file path Claude can read.

### Image Annotation
Click a screenshot thumbnail to draw on it before sending. Five colors (red, green, yellow, cyan, white), freehand drawing, composited onto the original image.

### One Click Debug Log Attach
Click "Add logs" and choose what to attach via a modal: filter by log type (All, Errors, Network, Console, Verbose), select record count (All, Last 25, Last 100), and optionally save your preferences.

### Custom Input Bar
Rich text field for composing messages. Shift+Enter for newlines with auto-continuation for numbered and bulleted lists. Arrow up for history. Drag-drop and paste images. Hit Enter to send everything to Claude Code's prompt.

### Device Emulation
128 device presets across 12 categories: iPhone, iPad, Samsung Galaxy, Google Pixel, OnePlus, Xiaomi, Motorola, OPPO, Realme, Sony, and Desktop viewports. Native resolution, scaled to fit the preview panel.

### Tabbed Sessions
Multiple independent shell sessions, each with a custom label. Double-click to rename, drag to reorder, Cmd+1-9 to jump between tabs. Inactive tabs show a green activity dot when they receive output.

### Browser Logger
Full Chrome DevTools Protocol logging: console output, network requests, JS errors, failed fetches — all captured in real time. Split into Browser and App tabs with sub-filters (All, Errors, Network, Console, Verbose).

### Markdown Files Panel
Auto-detects your project directory and lists all `.md` files. Expandable with rendered markdown content. Live updates via file watching. Your CLAUDE.md is always one click away.

### Notes Panel
Persistent scratchpad with syntax-highlighted keywords (`todo:`, `questions:`, `api keys:`). Formatting toolbar with bold, headings, bullet and numbered lists with auto-continuation on Enter.

### Checklists Panel
Multiple named checklists with tabs. Add items, check them off, clear done. Double-click a tab to rename. Persists across sessions.

### Claude.ai Tab
The right panel has a second tab that embeds claude.ai directly. Reference Claude's web interface without leaving the app.

### Terminal Search
Cmd+F opens a search bar to find text in the terminal scrollback buffer. Enter for next match, Shift+Enter for previous, Escape to close.

### Terminal Font Zoom
Cmd+/- changes terminal font size only (8px–28px) without affecting the rest of the UI. Cmd+0 resets to default 13px.

### Quick Response
Detects y/n prompts, numbered choices, and permission requests in terminal output. Shows clickable buttons for one-tap answers.

### Clickable Terminal Links
Localhost URLs in terminal output (`localhost:3000`, `127.0.0.1:8080/path`) are clickable and open directly in the preview panel. External URLs open in your default browser.

## Install

### From DMG
Download the latest `.dmg` from [Releases](https://github.com/lautarorb/flowt-terminal/releases), open it, and drag Flowt to Applications.

**Important:** Flowt needs Full Disk Access to let CLI tools access your project folders. On first launch, you'll be prompted to grant it via System Settings → Privacy & Security → Full Disk Access.

### From Source
```bash
git clone https://github.com/lautarorb/flowt-terminal.git
cd flowt-terminal
npm install
npm start
```

## Build

```bash
npm run make                                          # All targets
npm run make -- --targets @electron-forge/maker-dmg   # DMG only
```

Output: `out/make/Flowt-VERSION-arm64.dmg`

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+T | New tab |
| Cmd+W | Close tab |
| Cmd+1-9 | Jump to tab |
| Cmd+Shift+[ / ] | Previous / next tab |
| Cmd+F | Search terminal |
| Cmd+= / Cmd+- | Zoom terminal font |
| Cmd+0 | Reset terminal font |
| Ctrl+C | Send SIGINT |
| Shift+Enter | Newline in input bar |
| Enter | Send message |
| Escape | Close search / close panel |

## Tech Stack

| | |
|---|---|
| Runtime | Electron 41, Node.js |
| Frontend | React 19, TypeScript 5.4 |
| Terminal | xterm.js 6, node-pty 1.1 |
| Preview | WebContentsView + Chrome DevTools Protocol |
| Build | Electron Forge + Webpack |
| Tests | Jest 30, ts-jest |

## What Flowt Is Not

Flowt does not call the Anthropic API. It does not suggest commands, autocomplete prompts, or interpret your terminal output. It has zero awareness of your code or conversations. All of that is Claude Code's job.

If you closed Flowt and opened iTerm2, Claude Code would behave identically. Flowt just removes the friction from everything around it.

## Requirements

- macOS (Intel or Apple Silicon)
- Node.js 18+ (for building from source)
- Full Disk Access permission (for accessing project directories)

## License

MIT

## Author

[Lautaro Rodriguez Barreiro](mailto:)

---

*Built with Claude Code.*
