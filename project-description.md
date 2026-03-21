# Flowt

A Mac terminal emulator built for Claude Code workflows. The premise is simple: Claude Code is already a great vibe coding tool, but the terminal interface it lives in was not designed around that workflow. Flowt is. It adds no intelligence, makes no API calls, and has no opinion about your code. It is purely a better-shaped window for the way a vibe coding session actually runs.

## Layout

The app is a single window split into two panels with a draggable divider.

The left panel is the terminal. This is where Claude Code runs, where you type, where output appears. It is a full PTY terminal, same as iTerm2 or any other emulator. Nothing is intercepted, modified, or processed between you and the shell.

The right panel has two tabs: Preview and Claude. The Preview tab is an embedded browser view with a URL bar, device emulation selector, action buttons, and a structured log drawer. The Claude tab embeds claude.ai directly in the app with a reload button.

At the bottom of the Preview tab sit two action buttons — "Add logs" and "Add screenshot" — that let you attach browser context to your next message to Claude Code. Below that is a structured log drawer, collapsible, that captures everything happening inside the embedded browser in real time.

## Tabs

Multiple tabs sit at the top of the terminal panel. Each tab is an independent shell session. You can have as many open simultaneously as you need.

Each tab has a custom display label you set yourself: Front end, Back end, Design, Auth, whatever fits your mental model of the session. The label is purely cosmetic, it has no effect on the shell. Double-click any tab to rename it — the existing text is automatically selected so you can immediately type a replacement. The underlying session keeps running regardless.

Tabs scroll horizontally when there are many open. Tabs can be reordered by dragging. The MDs and Notes buttons are pinned on the right side of the tab bar, always visible regardless of how many tabs exist. Closing a tab shows a confirmation dialog since it terminates the running process. Inactive tabs with new output show a green activity dot.

Keyboard shortcuts: Cmd+1-9 to jump to a tab, Cmd+Shift+[ and ] to move between adjacent tabs, Cmd+T for new tab, Cmd+W to close.

## Live Preview

The preview panel is an embedded Chromium browser (Electron WebContentsView). You navigate to any URL by typing in the URL bar and pressing Enter. URLs without a protocol prefix default to `https://`. Any localhost URL clicked in the terminal output opens in the preview instead of an external browser.

A device emulation selector offers 128 presets across 12 categories: iPhone, iPad, Samsung Galaxy S/A/Z, Google Pixel, OnePlus, Xiaomi, Motorola, OPPO, Realme, Sony, and Desktop viewports. The emulated viewport renders at the device's native resolution but is scaled down to fit within the preview panel, so you always see the full page. "Responsive" (no emulation, fills available space) is the default.

Navigation controls include back, reload, and a status dot that shows idle (gray), loading (gray), loaded (green), or error (red).

## Claude.ai Tab

The Claude tab in the right panel embeds claude.ai directly, letting you reference Claude's web interface without leaving the app. A reload button appears next to the tab name when active. The Claude view uses a separate WebContentsView that is shown/hidden based on tab selection.

## Input Bar

At the bottom of the terminal panel sits a dedicated chat input bar. It behaves like a rich text field, not a standard terminal prompt. You can compose your message, use Shift+Enter for newlines (with auto-continuation for numbered and bulleted lists), and review everything before sending. Hit Enter and the full message goes to Claude Code's prompt.

You can also click directly into the terminal area to type into Claude Code's native `❯` prompt, which has full autocomplete, shortcuts, and all built-in features. The chat input bar is for composing longer messages or sending messages with attachments.

Ctrl+C always sends SIGINT to the terminal regardless of where your focus is. Arrow up in an empty input recalls previous messages from history.

Cmd+F opens a search bar in the terminal to find text in the scrollback buffer. Enter finds next, Shift+Enter finds previous, Escape closes the search.

Cmd+ and Cmd- change the terminal font size only (8px min, 28px max) without affecting the rest of the UI. Cmd+0 resets to the default 13px.

## Screenshot Attach

The "Add screenshot" button on the right panel captures the current state of the preview browser and adds it as an image thumbnail in the chat input bar. You can review it before sending. Screenshots are saved to a `.flowt/` folder inside your project directory so Claude Code can access the file directly.

You can also drag an image file onto the input bar, or paste an image from your clipboard. Images appear as preview thumbnails with a remove button.

## Debug Log Attach

The "Add logs" button takes the current browser log panel contents and attaches them to the chat input bar as a collapsible text block. If the logs are more than 10 lines, they appear in a collapsed preview showing the first 3 lines with an expand/collapse toggle. You can review, expand, or remove the attached logs before sending. Hit Enter and everything — your message, the logs, any screenshots — goes to Claude Code in one submission.

## Browser Logger

Because the preview panel is an embedded Chromium instance, the app has full programmatic access to everything happening inside it via the Chrome DevTools Protocol. The log drawer captures:

- **Console output**: every console.log, console.error, console.warn, console.info, console.debug
- **Network requests**: every fetch and XHR call, including URL, method, and status code
- **JavaScript errors**: uncaught exceptions with full stack traces
- **Network failures**: failed requests with error details

All of this streams into the log drawer in real time. The drawer has two tabs: **Browser** (logs from the preview site) and **App** (Flowt's internal verbose logs). The Browser tab has sub-filters: All, Errors, Network, Console, and Verbose (console.debug). A trash icon clears the log panel (turns dark red on hover). The log drawer is resizable by dragging its top edge. ERR_ABORTED errors from redirects are silently ignored.

Clicking "Add logs" opens a modal where you choose the log type, record count (All/Last 25/Last 100), and optionally save your selection for next time. Only browser logs are attached — never internal app logs.

## Quick Response

When Claude Code presents interactive prompts (y/n, numbered choices, Allow?), clickable quick-response buttons appear above the input bar for one-tap answers. They auto-dismiss after 10 seconds or on new terminal output.

## Notes Panel

A floating panel accessible from the "Notes" button in the tab bar. It is a scratchpad with syntax-highlighted keywords: `todo:` appears in green, `questions:` in yellow, and `api keys:` in cyan. A formatting toolbar offers Bold (**text**), Heading (#/##/###), Bullet list (-), and Numbered list (1.) with auto-continuation on Enter. Notes persist across sessions automatically via electron-store.

## Checklists Panel

A floating panel accessible from the "Checklists" button in the tab bar (between MDs and Notes). Supports multiple named checklists via tabs — double-click a tab to rename it. Add items via the input at the bottom, check them off with a click, and use "Clear done" to remove completed items. Checklists persist across sessions.

## Image Annotation

When you click a screenshot thumbnail in the input bar, a freehand drawing overlay opens. Choose from 5 colors (red, green, yellow, cyan, white) and draw directly on the image. Save composites your drawings onto the original image before sending to Claude Code.

## Markdown Files Panel

A floating panel accessible from the "MDs" button in the tab bar. It detects your project's working directory from the shell session (via lsof on macOS) and recursively scans for all `.md` files, ignoring node_modules, .git, and build directories. Each file is expandable to show its rendered markdown content. The panel updates in real time when files are added, removed, or changed via chokidar file watching.

## What It Is Not

Flowt does not call the Anthropic API. It does not suggest commands, autocomplete prompts, or interpret your terminal output. It has no awareness of what Claude Code is doing or saying. All of that is Claude Code's job. The app is intentionally transparent. If you closed Flowt and opened iTerm2, Claude Code would behave identically. Flowt just removes the friction from the surrounding workflow.

## Platform and Stack

Mac only. Built with Electron 41, React 19, TypeScript 5.4, node-pty for terminal emulation, xterm.js 6 for terminal rendering, and Electron Forge with webpack for building. The preview uses Electron's WebContentsView with Chrome DevTools Protocol for log capture. 128 device presets for responsive testing. 38 IPC channels across 9 namespaces. 48 unit tests covering port detection and route tracking. Distributable as a macOS DMG installer.
