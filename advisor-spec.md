# flowt Advisor Feature Spec

## What this is

A second Claude Code instance, running headless inside flowt, that acts as a thinking partner between the founder and the main CC executor session. The founder discusses problems, decisions, and architecture with the advisor in a chat panel. When ready, the advisor drafts a message that gets sent to the main terminal where CC actually executes work.

The founder is the bridge. Nothing crosses between the two CC sessions automatically. Every send is an explicit click.

## Why this exists

Today the founder manually copies CC output, pastes it into Claude (web), iterates with that Claude until they have a clear plan or message, then copies that back into the main CC session. This loop works but the copy-paste friction breaks flow.

The advisor feature collapses that loop into the same window with two button clicks instead of four manual context switches.

## Architecture

### Hidden advisor process

When flowt opens a project, it spawns a second `claude` process via node-pty in the same working directory as the active terminal tab. The pty is hidden, no terminal UI rendered for it. Output is parsed and rendered in the Advisor chat panel.

One advisor per project (per cwd). Multiple terminal tabs in the same project share the same advisor session. Switching projects spawns a fresh advisor pty with the new cwd.

### Sandboxed tool restrictions

The advisor pty is spawned with restricted tools so it physically cannot modify source code, configs, or app files. Reading is unrestricted across the project. Writing is allowed but constrained to a dedicated sandbox folder: `.flowt/advisor-output/`.

Allowed tools:
- Read, Glob, Grep, WebSearch (full project access, read-only)
- Write, Edit (constrained to `.flowt/advisor-output/` only)

```
claude --allowedTools "Read,Glob,Grep,WebSearch,Write,Edit"
```

Path constraint is enforced via the system prompt and verified by a wrapper that intercepts Write/Edit calls and rejects any path outside the sandbox. Belt and suspenders: the prompt sets intent, the wrapper makes violation impossible.

This is enforcement, not a request. The advisor can produce specs, planning docs, MDs, and notes freely inside its sandbox. It cannot touch any file that ships in the product.

The sandbox folder is created on advisor pty spawn if it does not exist. It is gitignored by default (flowt adds it to `.gitignore` if not already present).

### System prompt injected on first turn

When the advisor pty spawns, flowt sends an initial system message before any user input:

```
You are a thinking partner for the founder of this project. The founder is using another Claude Code session in a separate terminal to execute the actual work. Your job is to help them think clearly, draft messages back to that executor session, and produce planning artifacts when asked.

You will never edit source code, configs, or any file that ships in the product. The executor CC handles all of that.

You CAN write specs, planning docs, MDs, notes, and any other planning artifacts. These must always be written inside `.flowt/advisor-output/`. Never write outside this folder. If the founder asks you to write something elsewhere, explain that you can only write in your sandbox and they can move the file later or ask the executor CC to do it.

The founder will paste outputs from the executor CC and discuss with you. Iterate with them as long as they need. When they click "Draft Message to CC", produce a single clearly delimited message ready to be sent to the executor.

Read CLAUDE.md and explore the project structure as needed for context. Wait for the founder's first message before responding.
```

CLAUDE.md does not need manual injection. The advisor is CC running in the project folder, it reads CLAUDE.md on its own.

## UX

### Advisor tab in right panel

A new tab in the right panel alongside Preview and Claude.ai. Label: "Advisor". Tab badge shows pending state if a draft is ready (small dot indicator).

### Chat panel layout

Standard chat UI rendered as markdown:
- Founder messages right-aligned
- Advisor messages left-aligned
- Draft-for-CC blocks rendered as distinct cards with a "Send to Terminal" button attached

ANSI escape codes from the pty output are stripped before rendering. Output is parsed as markdown.

### Compose box

Sticky text input at the bottom of the Advisor panel. Type and press enter to send to the advisor. Supports multi-line via Shift+Enter. Same input affordances as the main terminal compose bar (paste, history).

### Send to Advisor button

A button appears on each CC turn in the main terminal (next to the existing "copy last CC message" affordance). Click it, the full CC turn is piped into the advisor pty as a user message. Advisor responds in the chat panel.

"Last CC turn" is defined as everything from the founder's last input to the current end of CC's response. Same segmentation logic as the existing copy-last-message feature.

### Draft Message to CC button

Always visible in the advisor panel. Click it at any point in the conversation, regardless of how many turns have happened (zero, two, twenty). The advisor takes the conversation so far and produces a single delimited block formatted as the message to send to the executor CC.

The delimited block renders as a card in the chat with a "Send to Terminal" button. Clicking Send drops the block content into the main terminal's compose bar. The founder reviews and presses enter themselves.

The card is editable inline before sending. Click to edit, modify, then Send.

### Reset advisor

A small button in the Advisor panel header. Kills the current advisor pty and spawns a fresh one in the same project folder. Used when starting a new task and wanting clean context.

### Sandbox files view (optional v1, recommended v1.1)

A collapsible "Files" section in the Advisor panel that lists everything currently inside `.flowt/advisor-output/`. Click a file to open it (uses the existing markdown viewer if `.md`, otherwise opens in default editor). Provides a clear audit trail of what the advisor has produced this session.

## The flow

1. Founder works in main terminal with executor CC as normal
2. CC finishes a turn, founder wants advisor input
3. Founder clicks "Send to Advisor" on that CC turn
4. Advisor receives the turn, responds in chat panel
5. Founder iterates with advisor (zero to N turns)
6. When ready, founder clicks "Draft Message to CC"
7. Advisor produces a delimited message block in the chat
8. Block renders as a card with Send button
9. Founder optionally edits the draft inline
10. Founder clicks Send, draft drops into main terminal compose bar
11. Founder reviews and hits enter
12. Executor CC receives the message and works

## Out of scope (do not build)

These were considered and rejected. Listed explicitly so they don't get added later by accident.

- **Auto-pipe of CC turns to advisor.** Founder always clicks Send to Advisor explicitly. No automatic forwarding.
- **Auto-send of drafted CC messages.** No "send after 5 seconds if no intervention." The enter key is the human gate. Always.
- **Advisor asking CC follow-up questions directly.** Founder is always the bridge. Advisor cannot send to executor on its own.
- **Smart selection of what to send to advisor.** Last CC turn is the unit. No summarization, no filtering, no AI-decided slicing.
- **Multiple concurrent advisor conversations.** One advisor per project. Reset button gives a fresh session, but only one is active at a time.
- **Cost gating or quota gates.** Show usage if useful, but never block actions. Founder decides when to stop.
- **Advisor writing outside its sandbox.** Advisor can write planning artifacts to `.flowt/advisor-output/` only. Source code, configs, and any app file are off limits, enforced both by system prompt and by tool wrapper. Moving files out of the sandbox is a manual step or executor CC's job.

## Interaction logging for future learning

### Purpose

Capture every advisor interaction in structured form so that the founder's judgment, push-back patterns, and editing behavior can be analyzed later. The goal is to eventually answer "what would Lautaro do" by training on or referencing this data.

This is **capture only for v1**. No current consumer of the logs. No analysis pipeline, no fine-tuning, no system prompt auto-evolution. Just clean, replayable data sitting on disk for when it becomes useful.

The reasoning: capture is free now and lossless. If we wait, months of training material disappear forever. Decide what to do with it later, but never start without it.

### What gets captured

Every event in the advisor session, in order. Not just inputs and outputs. The full sequence including the founder's mid-conversation steering, redirects, push-backs, and edits. The pre-draft iteration is where most of the judgment is encoded, capturing only the final draft loses the dataset.

Event types:
- `send_to_advisor`: founder clicks Send to Advisor on a CC turn. Records the full CC turn text.
- `advisor_response`: advisor produces a chat response. Records full text.
- `founder_message`: founder types a message in the advisor compose box. Records full text.
- `draft_cc_clicked`: founder clicks Draft Message to CC.
- `draft_produced`: advisor outputs the delimited draft. Records full text.
- `draft_edited`: founder edits the draft inline. Records before and after.
- `send_to_terminal`: founder clicks Send. Records the final text that hit the compose bar.
- `discard_draft`: founder dismisses a draft without sending.
- `reset_advisor`: session ended via reset.

Each event has a timestamp.

### Storage format

One JSON file per advisor session. A session runs from advisor pty spawn to reset (or project close, or flowt close). All events for that session live in one file, in order, so the full conversation is replayable from disk.

Location: `.flowt/advisor-logs/`

Filename: `YYYY-MM-DD_HHMMSS_session-{shortid}.json`

File structure:

```
{
  "session_id": "abc",
  "project": "fico",
  "project_path": "/Users/lautaro/projects/fico",
  "started_at": "2026-04-27T14:30:22Z",
  "ended_at": "2026-04-27T15:12:08Z",
  "ended_via": "reset" | "project_close" | "flowt_close",
  "flowt_version": "1.x.x",
  "events": [
    { "type": "send_to_advisor", "ts": "...", "cc_turn": "..." },
    { "type": "advisor_response", "ts": "...", "text": "..." },
    { "type": "founder_message", "ts": "...", "text": "..." },
    { "type": "advisor_response", "ts": "...", "text": "..." },
    { "type": "draft_cc_clicked", "ts": "..." },
    { "type": "draft_produced", "ts": "...", "text": "..." },
    { "type": "draft_edited", "ts": "...", "before": "...", "after": "..." },
    { "type": "send_to_terminal", "ts": "...", "final_text": "..." }
  ]
}
```

Flat JSON files are intentional. Portable, inspectable with `cat` and `jq`, easy to move between machines, easy to feed into any future training or analysis pipeline without an export step. No database.

### Privacy and storage hygiene

- `.flowt/advisor-logs/` is added to `.gitignore` automatically on first write
- Logs stay local on the founder's machine. No upload, no telemetry, no sync
- Founder can delete any log file or the entire folder at any time without breaking the advisor feature
- A "Clear logs" button in advisor settings is nice-to-have but not v1

### Signals worth extracting later

Listed for context, not to be built now:

- **Push-back patterns:** what advisor outputs trigger immediate founder disagreement
- **Redirect triggers:** typical founder corrections when the advisor goes the wrong direction
- **Convergence shape:** turns required to reach a draft, tracked over time
- **Abandoned conversations:** sessions ending in reset without a draft, the failure cases
- **Question patterns:** what founder asks that the advisor should have addressed unprompted
- **Edit deltas:** systematic differences between advisor drafts and final sent messages

Each of these becomes either a system prompt improvement, an anti-pattern to remove from the advisor's behavior, or training data for a future model.

## Settings

Minimum viable settings:
- Reset advisor button (in panel header)
- Optional: per-project advisor system prompt override at `.flowt/advisor.md` in project root, falls back to default if missing

That is it for v1. No model selector (CC handles that), no API key (uses existing `claude login`), no tunable scrollback (segmentation is fixed to last CC turn).

## Build order

1. Spawn hidden advisor pty on project open with sandboxed tool restrictions, in active tab's cwd
2. On spawn, ensure `.flowt/advisor-output/` and `.flowt/advisor-logs/` exist and are in `.gitignore`
3. Write the path-restricting wrapper for Write/Edit calls (rejects anything outside the sandbox)
4. Inject system prompt as first message
5. Render advisor pty output as markdown in Advisor chat panel
6. Compose box sends typed text to advisor pty as user message
7. "Send to Advisor" button on CC turns in main terminal pipes the turn into advisor pty
8. "Draft Message to CC" button triggers advisor to produce a delimited block
9. Parse delimited blocks, render as cards with editable text and Send button
10. Send button drops draft into main terminal compose bar
11. Reset advisor button kills pty and spawns fresh
12. **Interaction logging:** capture every event (send_to_advisor, advisor_response, founder_message, draft_cc_clicked, draft_produced, draft_edited, send_to_terminal, discard_draft, reset_advisor) to `.flowt/advisor-logs/{session}.json` in real time
13. (v1.1) Sandbox files view in Advisor panel

Steps 1 to 7 give the basic loop working. Steps 8 to 10 add the drafting polish. Step 11 is housekeeping. Step 12 captures data for future learning. Step 13 is the audit-trail nice-to-have.

## Technical notes

- ANSI stripping is required before rendering pty output as markdown chat
- Detecting "advisor finished responding" reuses the same prompt-detection logic as the main terminal turn segmentation
- The delimited block format for drafts should be unambiguous and resilient to advisor formatting drift. Suggested marker: triple-pipe fenced blocks or a specific HTML comment marker that the advisor is told to use in the system prompt
- Running advisor + main CC simultaneously consumes Max plan quota faster. Worth flagging to user via a small indicator if usage is approaching limits, but never block
- Advisor pty must be killed on flowt close, project switch, or Reset click. No orphan processes
- If the advisor pty dies unexpectedly, the panel should show a clear error state with a "Restart advisor" button
- Sandbox path enforcement: the wrapper around Write/Edit must resolve symlinks and check absolute paths against the sandbox root. Reject `..` traversal, reject symlinks pointing outside, reject absolute paths outside `.flowt/advisor-output/`. Test this carefully, it is the security boundary
- `.flowt/advisor-output/` is added to `.gitignore` automatically on first spawn if not already present, to avoid accidental commits of advisor scratch work
- `.flowt/advisor-logs/` is added to `.gitignore` automatically on first write. Log files are append-only during a session, written to disk on every event so a flowt crash does not lose the conversation
