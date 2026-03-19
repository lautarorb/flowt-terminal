# Vibe Terminal

A Mac terminal emulator built for Claude Code workflows. The premise is simple: Claude Code is already a great vibe coding tool, but the terminal interface it lives in was not designed around that workflow. Vibe Terminal is. It adds no intelligence, makes no API calls, and has no opinion about your code. It is purely a better-shaped window for the way a vibe coding session actually runs.

## Layout

The app is a single window split into two panels.

The left panel is the terminal. This is where Claude Code runs, where you type, where output appears. It is a full PTY terminal, same as iTerm2 or any other emulator. Nothing is intercepted, modified, or processed between you and the shell.

The right panel is the live preview. It is an embedded browser view with a URL bar at the top. You can type any address manually, or click any localhost link that appears in the terminal output and it opens directly in the preview panel. External URLs open in your default browser.

At the bottom of the right panel sit two action buttons — "Add logs" and "Add screenshot" — that let you attach browser context to your next message to Claude Code. Below that is a structured log drawer, collapsible, that captures everything happening inside the embedded browser in real time.

## Tabs

Multiple tabs sit at the top of the terminal panel. Each tab is an independent shell session. You can have as many open simultaneously as you need.

Each tab has a custom display label you set yourself: Front end, Back end, Design, Auth, whatever fits your mental model of the session. The label is purely cosmetic, it has no effect on the shell. Double-click any tab to rename it. The underlying session keeps running regardless.

Tabs scroll horizontally when there are many open. The MDs and Notes buttons are pinned on the right side of the tab bar, always visible regardless of how many tabs exist. Closing a tab shows a confirmation dialog since it terminates the running process.

## Live Preview

The preview panel is an embedded Chromium browser (Electron WebContentsView). You navigate to any URL by typing in the URL bar or by clicking localhost links directly in the terminal output. Any URL containing `localhost` or `127.0.0.1` — with or without the `http://` prefix — is recognized as a clickable link and opens in the preview instead of an external browser.

A device emulation selector lets you switch between Responsive (default, fills available space), iPhone SE, iPhone 14, iPhone 16 Pro Max, iPad Mini, and iPad Pro. The emulated viewport renders at the device's native resolution but is scaled down to fit within the preview panel, so you always see the full page.

## Input Bar

At the bottom of the terminal panel sits a dedicated chat input bar with a green border. It behaves like a rich text field, not a standard terminal prompt. You can compose your message, use Shift+Enter for newlines, and review everything before sending. Hit Enter and the full message goes to Claude Code's prompt.

You can also click directly into the terminal area to type into Claude Code's native `❯` prompt, which has full autocomplete, shortcuts, and all built-in features. The chat input bar is for composing longer messages or sending messages with attachments.

Ctrl+C always sends SIGINT to the terminal regardless of where your focus is.

## Screenshot Attach

The "Add screenshot" button on the right panel captures the current state of the preview browser and adds it as an image thumbnail in the chat input bar. You can review it before sending. Screenshots are saved to a `.vibeterminal/` folder inside your project directory so Claude Code can access the file directly.

You can also drag an image file onto the input bar, or paste an image from your clipboard. Images appear as preview thumbnails — click a thumbnail to view it fullscreen, click the × to remove it before sending.

## Debug Log Attach

The "Add logs" button takes the current browser log panel contents and attaches them to the chat input bar as a collapsible text block. If the logs are more than 10 lines, they appear in a collapsed preview showing the first 3 lines with an expand/collapse toggle. You can review, expand, or remove the attached logs before sending. Hit Enter and everything — your message, the logs, any screenshots — goes to Claude Code in one submission.

## Browser Logger

Because the preview panel is an embedded Chromium instance, the app has full programmatic access to everything happening inside it via the Chrome DevTools Protocol. The log drawer captures:

- **Console output**: every console.log, console.error, console.warn, console.info
- **Network requests**: every fetch and XHR call, including URL, method, and status code
- **JavaScript errors**: uncaught exceptions with full stack traces
- **Network failures**: failed requests with error details

All of this streams into the log drawer in real time, structured and filterable by type: Errors only, Network only, Console only, or All. A clear button resets the log panel.

## Notes Panel

A floating panel accessible from the "Notes" button in the tab bar. It is a simple scratchpad with syntax-highlighted keywords: `todo:` appears in green, `questions:` in yellow, and `api keys:` in cyan. Notes persist across sessions automatically.

## Markdown Files Panel

A floating panel accessible from the "MDs" button in the tab bar. It detects your project's working directory from the shell session and recursively scans for all `.md` files, ignoring node_modules, .git, and build directories. Each file is expandable to show its rendered markdown content. The panel updates in real time when files are added, removed, or changed.

## What It Is Not

Vibe Terminal does not call the Anthropic API. It does not suggest commands, autocomplete prompts, or interpret your terminal output. It has no awareness of what Claude Code is doing or saying. All of that is Claude Code's job. The app is intentionally transparent. If you closed Vibe Terminal and opened iTerm2, Claude Code would behave identically. Vibe Terminal just removes the friction from the surrounding workflow.

## Platform and Stack

Mac only. Built with Electron, React, node-pty for terminal emulation, and xterm.js for terminal rendering. The preview uses Electron's WebContentsView with Chrome DevTools Protocol for log capture.
