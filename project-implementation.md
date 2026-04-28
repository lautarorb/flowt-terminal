# Project Implementation

> Generated: 2026-04-27
> Spec: flowt-advisor-functional-spec.md
> Total tasks: 55 | Todo: 49 | In Progress: 0 | Done: 0 | Ideas: 6

---

## Add advisor IPC channel constants and shared types

**Status:** todo
**Category:** Phase 1
**ID:** task-001

Extend `src/shared/ipc-channels.ts` to add 7 Phase 1 channel constants following the existing `IPC` enum pattern: `ADVISOR_HYDRATE = 'advisor:hydrate'`, `ADVISOR_SCAFFOLD = 'advisor:scaffold'`, `ADVISOR_DISABLE = 'advisor:disable'`, `ADVISOR_ENABLE = 'advisor:enable'`, `ADVISOR_RESET = 'advisor:reset'`, `ADVISOR_SEND_MESSAGE = 'advisor:send-message'`, `ADVISOR_LOG_APPEND = 'advisor:log-append'`.

Create `src/shared/advisor-types.ts` defining all interfaces from spec §5:
- `AdvisorState` (schema_version, active_session_id, active_log_file, started_at, model, last_event_at — all nullable except schema_version)
- `AdvisorLog` (schema_version, session_id, project_path, flowt_version, model, started_at, ended_at, ended_via, events array)
- `AdvisorEvent` discriminated union with all 16 event types from §5.2, including: `send_to_terminal` with `mode: 'compose' | 'direct'`; `send_to_advisor` with `source: 'stop_hook'` only (clipboard_fallback OMITTED per spec §9.2 — fallback is deferred to v1.1)
- `ExecutorState` (last_session_id, started_at, last_turn_at)
- `CcTurn` (session_id, captured_at, stop_reason, assistant_text, turn_index, transcript_path?)
- `PendingDraft` with state union including `DRAFT_SENT_COMPOSE | DRAFT_SENT_DIRECT` per §3.2 + §5.9 fix (NOT a single `DRAFT_SENT`)
- `Usage` type for token counts: input_tokens, output_tokens, cache_creation_input_tokens?, cache_read_input_tokens?
- `AdvisorErrorEventType` union: `'error_init' | 'error_turn' | 'extract_failed' | 'session_stale' | 'draft_parse_fail'`

Mirror types in `src/renderer/lib/advisor-types.ts` if any renderer-specific types arise (e.g., `ChatBubble` for the replayer output). No behavior changes; pure type/constant additions. Verify `npx tsc --noEmit` passes.

### Feedback

### Comments

---

## Build advisor-prompt-builder.ts with default body and footer

**Status:** todo
**Category:** Phase 1
**ID:** task-002

Create `src/main/advisor-prompt-builder.ts`. Export three things:

1. `DEFAULT_ADVISOR_PROMPT_BODY` — the verbatim multi-paragraph string from spec §6.2 (starts with "You are a thinking partner for the founder of this project." and ends with "...but default to brevity."). Copy character-for-character from spec §6.2.

2. `ADVISOR_PROMPT_FOOTER` — the verbatim string from spec §6.3 (starts with "---\nSYSTEM REQUIREMENT (do not modify):..." and includes the literal `<!-- FLOWT_DRAFT_START -->` and `<!-- FLOWT_DRAFT_END -->` markers).

3. `assembleSystemPrompt(cwd: string): string` per spec §6.4 — synchronously read `<cwd>/.flowt/advisor.md` via `fs.readFileSync`, trim, fall back to `DEFAULT_ADVISOR_PROMPT_BODY` if ENOENT or any read error, return `body + '\n\n' + ADVISOR_PROMPT_FOOTER`.

No caching — re-read on every call (per spec §5.8: "no watcher, no live-reload, no in-memory cache"). Pure module — no IPC, no state, no chokidar. Verified: `claude --system-prompt <prompt>` flag exists and accepts large strings per Q1 verification.

### Feedback

### Comments

---

## Tests for advisor-prompt-builder

**Status:** todo
**Category:** Phase 1
**ID:** task-003

Create `tests/unit/advisor-prompt-builder.test.ts`. Use Jest + ts-jest (existing Flowt setup). Use `tmp` directory or `os.tmpdir()` for fixture files; clean up in `afterEach` with `fs.rm(dir, { recursive: true })`.

Test cases:
1. **No `.flowt/advisor.md`**: `assembleSystemPrompt('/tmp/empty-cwd')` returns `DEFAULT_ADVISOR_PROMPT_BODY + '\n\n' + ADVISOR_PROMPT_FOOTER`
2. **Custom override present**: write `/tmp/cwd/.flowt/advisor.md` with content "You are a strict code reviewer.", then `assembleSystemPrompt('/tmp/cwd')` returns "You are a strict code reviewer.\n\n" + footer
3. **Empty override file**: empty advisor.md → still appends footer (treats trim() result as empty body, but still concatenates)
4. **Override with trailing newlines**: content "Body\n\n\n" → trimmed to "Body", joined with footer correctly (no triple-newlines)
5. **Footer contains delimiters**: assert `assembleSystemPrompt(any).includes('<!-- FLOWT_DRAFT_START -->')` and `<!-- FLOWT_DRAFT_END -->`
6. **Body content invariant**: assert `DEFAULT_ADVISOR_PROMPT_BODY.includes('YOU NEVER EDIT SOURCE CODE')` to catch accidental body edits

### Feedback

### Comments

---

## Build advisor-log-writer.ts with atomic writes and logAdvisorError

**Status:** todo
**Category:** Phase 1
**ID:** task-004

Create `src/main/advisor-log-writer.ts`. All disk writes use `<file>.tmp` + `fs.rename` for crash-safety per spec §5.2. Exports:

- `openLogFile(cwd: string, projectPath: string, flowtVersion: string): Promise<{ logFilePath: string }>`
  - Generate filename: `YYYY-MM-DD_HHMMSS_session-<shortid>.json` where shortid is a temp ULID until session_id known (use `crypto.randomUUID().slice(0, 8)`)
  - Write initial `AdvisorLog` skeleton via temp+rename: `{ schema_version: 1, session_id: null, project_path: projectPath, flowt_version: flowtVersion, model: null, started_at: <ISO UTC now>, ended_at: null, ended_via: null, events: [] }`
  - Update `<cwd>/.flowt/advisor-state.json.active_log_file` to the basename
  - Returns absolute path to the new log file

- `appendLogEvent(cwd: string, event: AdvisorEvent): Promise<void>`
  - Read existing JSON from `advisor-state.json` to find `active_log_file`
  - Read the log file, parse, append `event` to `events[]`
  - Update `last_event_at` in `advisor-state.json` to event.ts
  - Atomic temp+rename of both files (log first, state second to maintain consistency on crash)

- `finalizeLog(cwd: string, endedVia: 'reset' | 'project_close' | 'flowt_close' | 'stale_restart'): Promise<void>`
  - Set `ended_at` (ISO UTC now) and `ended_via` on the active log file
  - Atomic write
  - Does NOT clear advisor-state.json (caller's responsibility)

- `renameLogFileWithSessionId(currentPath: string, sessionId: string): Promise<string>`
  - When session_id arrives from first claude -p response, rename log file to use real shortid (first 8 chars of sessionId)
  - Update `advisor-state.json.active_log_file` to new basename
  - Returns new absolute path

- `logAdvisorError(eventType: AdvisorErrorEventType, reason: string, detail: unknown, cwd?: string): void`
  - Per spec §8.4 with the §9.6 fix: takes eventType as PARAMETER (not hardcoded to error_turn — that was the bug we explicitly fixed)
  - Always: `console.error('[advisor]', eventType, { ts: new Date().toISOString(), reason, detail })`
  - If cwd provided: also call `appendLogEvent(cwd, { type: eventType, ts, reason, detail })` — fire-and-forget; do NOT await (errors during error logging shouldn't bubble)

All paths resolved with `path.join(cwd, '.flowt', '<file>')`. Use `fs.promises` API throughout.

### Feedback

### Comments

---

## Tests for advisor-log-writer

**Status:** todo
**Category:** Phase 1
**ID:** task-005

Create `tests/unit/advisor-log-writer.test.ts`. Test cases using temp directories:

1. **openLogFile creates skeleton**: call openLogFile, read resulting file, verify schema matches AdvisorLog interface; verify advisor-state.json updated with active_log_file basename
2. **appendLogEvent appends**: call openLogFile, then appendLogEvent ×3 with different event types; read file; verify events array length is 3 in correct order
3. **Atomic write — simulated crash**: write a `.tmp` file manually, verify the original file (if exists) remains intact when rename fails (or simulate by chmod-ing the rename target to read-only)
4. **finalizeLog sets fields**: openLogFile, finalizeLog with 'reset' → verify ended_at and ended_via set in file
5. **renameLogFileWithSessionId**: openLogFile (creates with temp shortid), renameLogFileWithSessionId('abc12345-xxx-xxx') → verify file renamed to use 'abc12345' as shortid; advisor-state.json points to new basename
6. **logAdvisorError without cwd**: mock console.error, call logAdvisorError('error_init', 'binary_missing', {}), verify console.error called with `[advisor]` prefix and 'error_init' eventType (NOT 'error_turn' — guards against the regression)
7. **logAdvisorError with cwd**: setup log file, call logAdvisorError('error_turn', 'malformed_json', { stderr: 'foo' }, cwd) → verify event appended to log with type 'error_turn'
8. **logAdvisorError eventType variants**: call once with each of the 5 valid AdvisorErrorEventType values; verify each writes correct type to log
9. **Round-trip integrity**: openLogFile, appendLogEvent ×5 with all event types, read JSON, verify each event's type field matches what was passed in

### Feedback

### Comments

---

## Build advisor-scaffolder.ts with hooks merge and verifyHooksInstalled

**Status:** todo
**Category:** Phase 1
**ID:** task-006

Create `src/main/advisor-scaffolder.ts`. Implements spec Flow 1.2 + §5.6 + §5.9 verification logic. Idempotent — safe to call repeatedly.

Exports:

**`scaffoldProject(cwd: string): Promise<{ ok: true } | { ok: false; error: 'permission_denied' | 'disk_full' | 'malformed_settings_json'; detail?: string }>`**

Steps in order:
1. `fs.mkdir` recursive for `<cwd>/.flowt/advisor-output/`, `<cwd>/.flowt/advisor-logs/`, `<cwd>/.flowt/cc-turns/`
2. Determine bundled scripts directory: in dev, use `path.join(__dirname, '../../scripts')`; in packaged app, use `process.resourcesPath + '/scripts'` (forge.config.ts task-010 ensures these are present)
3. Copy `<bundle>/scripts/cc-stop-hook.sh` → `<cwd>/.flowt/cc-stop-hook.sh` (overwrite if exists for idempotency); same for `sandbox-check.sh`
4. `fs.chmod` both copied scripts to `0o755`
5. Read existing `<cwd>/.claude/settings.json`:
   - If file doesn't exist → start with `{ hooks: { PreToolUse: [], Stop: [] } }`
   - If file exists but malformed JSON → return `{ ok: false, error: 'malformed_settings_json', detail: <parse error message> }`. Do NOT overwrite — founder must fix manually
   - If file exists and valid → parse normally
6. Find any existing entries with `_flowt_managed: true` in `hooks.PreToolUse[]` and `hooks.Stop[]`; remove them; preserve all other entries
7. Append our entries from spec §5.6 (PreToolUse with matcher `Write|Edit|MultiEdit` referencing `bash .flowt/sandbox-check.sh`; Stop referencing `bash .flowt/cc-stop-hook.sh`; both with `timeout_ms: 5000` and `_flowt_managed: true`)
8. Atomic write back to `<cwd>/.claude/settings.json` (mkdir `<cwd>/.claude/` first if missing)
9. Update `<cwd>/.gitignore`:
   - If file doesn't exist → create with content `.flowt/\n.claude/settings.json\n`
   - If exists, append `.flowt/` only if no line in the file mentions `.flowt`
   - Append `.claude/settings.json` only if no line mentions `.claude` (intentional — some teams commit `.claude/settings.json` for shared rules; we leave that decision intact)
10. Write initial `<cwd>/.flowt/advisor-state.json`: `{ schema_version: 1, active_session_id: null, active_log_file: null, started_at: null, model: null, last_event_at: null }` (atomic)
11. Write initial `<cwd>/.flowt/executor-state.json`: `{ schema_version: 1, last_session_id: null, started_at: null, last_turn_at: null }` (atomic)
12. If `<cwd>/.flowt/_advisor_disabled` exists, `fs.unlink` it (re-enable case)
13. Return `{ ok: true }`

Errors during file ops (other than malformed_settings_json) → catch and return `{ ok: false, error: 'permission_denied' | 'disk_full', detail: <err.message> }` based on err.code.

**`verifyHooksInstalled(cwd: string): Promise<boolean>`**

1. Read `<cwd>/.claude/settings.json`. If missing or unparseable → return false
2. Verify `hooks.PreToolUse` array contains an entry with `_flowt_managed: true` AND its `hooks[0].command` includes `.flowt/sandbox-check.sh`
3. Verify `hooks.Stop` array contains an entry with `_flowt_managed: true` AND its `hooks[0].command` includes `.flowt/cc-stop-hook.sh`
4. Verify `<cwd>/.flowt/sandbox-check.sh` exists AND has executable bit set (`fs.access(path, fs.constants.X_OK)`)
5. Verify `<cwd>/.flowt/cc-stop-hook.sh` exists AND has executable bit set
6. Return true only if ALL above pass

### Feedback

### Comments

---

## Tests for advisor-scaffolder

**Status:** todo
**Category:** Phase 1
**ID:** task-007

Create `tests/unit/advisor-scaffolder.test.ts`. Use temp directories with cleanup in afterEach. Test cases:

1. **Fresh CWD**: scaffoldProject on empty directory → all 7 disk artifacts created (3 dirs + 2 scripts + settings.json + advisor-state.json + executor-state.json + .gitignore); ok:true
2. **User has existing Stop hook**: pre-write `.claude/settings.json` with `{ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo my-hook' }] }] }}`; scaffoldProject; verify both user's entry AND our `_flowt_managed` entry present in Stop array (preservation)
3. **Idempotent re-run**: scaffold once, then again → only one `_flowt_managed: true` entry in PreToolUse, only one in Stop (replaced not duplicated)
4. **Malformed settings.json**: pre-write `.claude/settings.json` with `{ invalid json` → returns `{ ok: false, error: 'malformed_settings_json' }`; original file unchanged
5. **Existing .gitignore with .flowt/**: pre-write `.gitignore` with content `node_modules/\n.flowt/\n`; scaffoldProject → file unchanged for `.flowt/`; `.claude/settings.json` may be appended depending on rule 9
6. **Existing .gitignore without .claude**: pre-write `.gitignore` with `node_modules/\n` → after scaffold, both `.flowt/` and `.claude/settings.json` lines added
7. **Existing .gitignore with `.claude` mention**: pre-write `.gitignore` with `.claude/credentials.json\n` → `.claude/settings.json` NOT appended (some pattern mentioning .claude already exists)
8. **_advisor_disabled removed on scaffold**: pre-create empty `_advisor_disabled` file; scaffold → file removed
9. **verifyHooksInstalled — happy path**: scaffold then verify → true
10. **verifyHooksInstalled — hooks removed manually**: scaffold; manually delete `_flowt_managed` entries from settings.json; verify → false
11. **verifyHooksInstalled — script files deleted**: scaffold; `fs.unlink` cc-stop-hook.sh; verify → false
12. **verifyHooksInstalled — script not executable**: scaffold; `fs.chmod(script, 0o644)`; verify → false
13. **verifyHooksInstalled — wrong path in command**: scaffold; manually edit settings.json to point Stop hook to `bash other-script.sh`; verify → false

### Feedback

### Comments

---

## Build advisor-event-replayer.ts pure function

**Status:** todo
**Category:** Phase 1
**ID:** task-008

Create `src/renderer/lib/advisor-event-replayer.ts`. Pure function with no IPC, no React, no side effects. Highly testable in isolation.

Signature: `replayEvents(events: AdvisorEvent[]): { bubbles: ChatBubble[]; pendingDraft: PendingDraft | null; latestErrorState: 'idle' | 'error_turn_pending' | 'stale' }`

Define `ChatBubble`: `{ id: string; role: 'founder' | 'advisor' | 'system'; text: string; subhint?: string; sourceTagline?: string; timestamp: string }`.

Logic, iterating events in order:

- `founder_message` → push founder bubble. If event.source === 'send_to_advisor', set sourceTagline: '↗ from terminal turn' for the metadata header in renderer
- `advisor_response` → push advisor bubble with full text (including any `<!-- FLOWT_DRAFT_START/END -->` markers — those are visible context). The renderer's bubble component will detect delimiters and conceal them visually if a draft card is rendering them; replayer doesn't strip
- `draft_cc_clicked` → set internal flag `pendingDraftRequest = true`. **Synthetic system bubble derivation rule (locked per planning Step 3 fix):** when iteration completes, if `pendingDraftRequest` is still true (no subsequent `draft_produced` or `draft_parse_fail` cleared it), push a synthetic system bubble at the end of bubbles array: `{ role: 'system', text: 'Asking advisor to draft the executor message…', timestamp: <ts of draft_cc_clicked event> }`
- `draft_produced` → clear `pendingDraftRequest` flag; set `pendingDraft = { state: 'DRAFT_READY', raw_text: event.text, edited_text: null, produced_at: event.ts }`
- `draft_parse_fail` → clear `pendingDraftRequest`; do NOT create pendingDraft; the previous advisor_response bubble will get an inline subhint via the renderer (replayer just doesn't create a draft)
- `draft_edited` → if pendingDraft exists, set `pendingDraft.edited_text = event.after`, state remains DRAFT_READY
- `send_to_terminal` → if pendingDraft exists, set state to DRAFT_SENT_COMPOSE or DRAFT_SENT_DIRECT based on event.mode; conceptually the draft is no longer "pending" so set `pendingDraft = null` after recording
- `discard_draft` → clear pendingDraft (set to null)
- `reset_advisor` → unreachable mid-replay (reset closes the log); but defensive: clear all bubbles, return empty
- `error_turn` → increment local consecutiveErrors counter (reset to 0 on next advisor_response)
- `session_stale` → set `latestErrorState = 'stale'`
- `process_killed`, `attribution_ambiguous`, `error_init`, `extract_failed` → no chat bubble, but `process_killed` may trigger a recovery toast in the renderer (replayer's job is just to not create spurious bubbles for these meta events)

Return value at end of iteration: `bubbles` array (in order with synthetic bubble appended if applicable), `pendingDraft` (final state), `latestErrorState`.

Pure function — same input always produces same output. Easy to test.

### Feedback

### Comments

---

## Tests for advisor-event-replayer

**Status:** todo
**Category:** Phase 1
**ID:** task-009

Create `tests/unit/advisor-event-replayer.test.ts`. Test cases:

1. **Empty events**: `replayEvents([])` → `{ bubbles: [], pendingDraft: null, latestErrorState: 'idle' }`
2. **Typed conversation**: founder_message ('typed'), advisor_response, founder_message ('typed'), advisor_response → 4 bubbles in correct order with correct roles
3. **Send to Advisor sourceTagline**: founder_message with source='send_to_advisor' → bubble has sourceTagline='↗ from terminal turn'
4. **Draft happy path**: founder_message, advisor_response, draft_cc_clicked, advisor_response (with delimiters), draft_produced → bubbles include the system bubble briefly tracked but cleared by draft_produced; pendingDraft set with DRAFT_READY state
5. **Draft pending (synthetic system bubble)**: founder_message, advisor_response, draft_cc_clicked → no draft_produced/draft_parse_fail follows; output bubbles array includes synthetic system bubble at end with text 'Asking advisor to draft the executor message…'
6. **Draft cleared by draft_produced**: events from #5 + draft_produced after → synthetic bubble NOT in output (cleared); pendingDraft set
7. **Draft cleared by draft_parse_fail**: events from #5 + draft_parse_fail → synthetic bubble NOT in output; pendingDraft remains null
8. **Draft edited**: full draft flow + draft_edited → pendingDraft.edited_text reflects after value
9. **Draft sent (compose mode)**: full flow + send_to_terminal with mode='compose' → pendingDraft is null (cleared); send_to_terminal event recorded but doesn't create a chat bubble
10. **Draft superseded**: draft_produced (1st draft), draft_produced (2nd draft) without intermediate send → pendingDraft reflects the LATEST draft only
11. **Discard draft**: draft_produced + discard_draft → pendingDraft is null
12. **Error turn ×3 + session_stale**: 3 error_turn events + session_stale → latestErrorState='stale'
13. **process_killed event**: processes without creating a chat bubble (defensive — assert bubbles count unchanged)
14. **attribution_ambiguous**: same as above — no chat bubble side-effect

### Feedback

### Comments

---

## Bundle hook scripts in forge.config.ts and write the actual scripts

**Status:** todo
**Category:** Phase 1
**ID:** task-010

Create `scripts/cc-stop-hook.sh` and `scripts/sandbox-check.sh` at the repo root with the EXACT contents from spec §5.6 (no modifications):

**`scripts/sandbox-check.sh`** (gated by FLOWT_ADVISOR_PROCESS=1):
- Bash, `set -e`
- If `$FLOWT_ADVISOR_PROCESS` is empty, `exit 0` (pass-through for executor + non-Flowt CC)
- Read JSON from stdin via `cat`
- Extract `tool_input.file_path` or `tool_input.path` via jq
- If empty TARGET, exit 0 (no path to validate)
- Resolve `realpath -m "$TARGET"` (handles `..` traversal + symlinks)
- Compute `SANDBOX="$(realpath -m "$PWD/.flowt/advisor-output")"`
- Case match: if ABS starts with $SANDBOX/, exit 0; if equals $SANDBOX, exit 0; else echo error to stderr and exit 1

**`scripts/cc-stop-hook.sh`** (NO env gate — fires for any CC in this project):
- Bash, `set -e`
- Read INPUT from stdin
- Extract SID via `jq -r '.session_id // empty'`
- If empty SID, exit 0
- mkdir -p `$PWD/.flowt/cc-turns`
- Write to TMP=`$PWD/.flowt/cc-turns/$SID.json.tmp`, then mv to TARGET=`$PWD/.flowt/cc-turns/$SID.json` (atomic)
- TMP content: pass-through INPUT plus add fields via jq: `schema_version: 1, captured_at: <ISO UTC>, assistant_text: (.assistant_text // ""), turn_index: (.turn_index // 0)`
- Update executor-state.json: read current (or default to schema), update last_session_id (only changes started_at if different sid), update last_turn_at; atomic write
- Always `exit 0` — never fail Stop event over write error

`chmod +x` on both during repo commit (use `git update-index --chmod=+x` if needed so executable bit is preserved across clones).

Modify `forge.config.ts` `packageAfterCopy` hook (existing pattern used for node-pty per CLAUDE.md):
- Copy `scripts/cc-stop-hook.sh` and `scripts/sandbox-check.sh` to `<packagedApp>/Contents/Resources/scripts/`
- Preserve executable permissions

**Q3 verification during this task** (per planning Step 4): after task-010 lands, run a manual test — start `claude` in a project with the hooks installed, produce one turn, then `cat .flowt/cc-turns/*.json | jq '.assistant_text'`. If the field is empty string, the Stop hook payload doesn't include assistant_text directly; we'll need to extend cc-stop-hook.sh to read transcript_path (the JSONL file Anthropic's session storage exposes) and extract the most recent assistant message before P2 starts. Surface the result to the founder before proceeding to task-026.

### Feedback

### Comments

---

## Build advisor-manager.ts orchestrator

**Status:** todo
**Category:** Phase 1
**ID:** task-011

Create `src/main/advisor-manager.ts`. Per-CWD session state holder + spawn orchestrator. Class-based with public methods callable from IPC handlers.

Constructor: `new AdvisorManager(window: BrowserWindow)` — stores window reference for IPC sends.

Internal state:
- `sessions: Map<string, AdvisorSessionMemory>` keyed by absolute cwd
- `chokidarWatchers: Map<string, FSWatcher>` keyed by cwd (for cc-turns directory)

`AdvisorSessionMemory`: `{ state, session_id, log_file_path, consecutive_errors, chat_events, notice_dismissed, hooks_installed_cached }` (omits pending_draft for P1; deferred to task-037 in P3).

Public methods:

**`hydrate(cwd: string): Promise<HydrateResponse>`** per spec §7:
1. Check `<cwd>/.flowt/_advisor_disabled` → set is_disabled
2. Check `<cwd>/.flowt/advisor-state.json` exists → set is_scaffolded
3. If scaffolded: read advisor-state.json, executor-state.json, active log file (if any)
4. Call `verifyHooksInstalled(cwd)` from advisor-scaffolder → set hooks_installed
5. If active_log_file exists: read events from it; replay via replayEvents; set sessions[cwd].chat_events
6. Detect process_killed: if active log file has no ended_at AND not flagged as already-recovered → append process_killed event to log
7. Set up chokidar watcher on `<cwd>/.flowt/cc-turns/*.json` if not already (P1 watcher just dismisses banner — task-014)
8. Return `{ is_disabled, is_scaffolded, hooks_installed, advisor_state, executor_state, log_events, pending_draft: null }` (P1 always returns null for pending_draft — drafts come in P3)

**`sendMessage(cwd, message, source): Promise<SendMessageResponse>`** per spec Flow 1.3:
1. Read advisor-state.json for active_session_id; if null → first-spawn path; else → resume path
2. Assemble system prompt: `assembleSystemPrompt(cwd)` (task-002)
3. Append founder_message event to log (with source flag) — except for source='draft_request' which appends draft_cc_clicked instead (deferred to P3 task-038; in P1 only handle 'typed')
4. Build args: first-spawn = `['-p', message, '--output-format', 'json', '--allowedTools', 'Read,Glob,Grep,WebSearch,Write,Edit', '--system-prompt', assembledPrompt]`; resume = same plus `'--resume', activeSessionId`
5. Spawn child: `child_process.spawn('claude', args, { cwd, env: { ...process.env, FLOWT_ADVISOR_PROCESS: '1' } })`
6. Collect stdout into buffer; collect stderr separately; await close event
7. On exit code 0: parse stdout as JSON. Expected envelope per Q2 verification: `{ type: 'result', subtype, is_error, result, session_id, total_cost_usd, duration_ms, stop_reason, usage }`
8. If is_error in envelope: treat as error_turn (categorize)
9. On parse success: extract result, session_id, usage, total_cost_usd, duration_ms; if first-spawn, persist session_id + started_at + model in advisor-state.json AND rename log file via `renameLogFileWithSessionId`; append advisor_response event with text, usage, cost_usd, duration_ms; reset consecutive_errors to 0; return `{ ok: true, response_text: result, draft_inner: null /* P3 parses delimiters */, usage, cost_usd: total_cost_usd }`
10. On exit code != 0 OR JSON parse failure: categorize error per spec:
    - exit 127 OR stderr contains "command not found" → error_kind: 'binary_missing'
    - stderr contains "not authenticated" / "no active session" / "claude login" → 'not_authed'
    - stdout unparseable → 'malformed_json'
    - envelope has is_error AND result mentions hook → 'hook_blocked'
    - else → 'other'
11. Append error_init (first-spawn) or error_turn (subsequent) event via logAdvisorError; increment consecutive_errors; if ≥3 → append session_stale event, transition state to STALE
12. Return `{ ok: false, error_kind, stderr_snippet: stderr.slice(0, 200), is_stale }`

**`reset(cwd): Promise<{ ok: true }>`**:
1. Append reset_advisor event to log
2. Call finalizeLog(cwd, 'reset')
3. Clear session_id, active_log_file, started_at, model in advisor-state.json (atomic write)
4. Reset in-memory `sessions[cwd]` to NO_SESSION

Verify via Q1: `claude --system-prompt` confirmed; Q2: JSON envelope shape confirmed; Q4: `--resume` flag confirmed.

### Feedback

### Comments

---

## Build advisor-ipc-handlers.ts and register Phase 1 channels

**Status:** todo
**Category:** Phase 1
**ID:** task-012

Create `src/main/advisor-ipc-handlers.ts`. Export `registerAdvisorIpcHandlers(window: BrowserWindow, advisorManager: AdvisorManager): void`.

Register 7 P1 channels:

1. `ipcMain.handle(IPC.ADVISOR_HYDRATE, (_e, payload: { cwd: string }) => advisorManager.hydrate(payload.cwd))`
2. `ipcMain.handle(IPC.ADVISOR_SCAFFOLD, async (_e, payload: { cwd: string }) => scaffoldProject(payload.cwd))`
3. `ipcMain.handle(IPC.ADVISOR_DISABLE, async (_e, payload: { cwd: string }) => { /* mkdir <cwd>/.flowt/ if needed; touch <cwd>/.flowt/_advisor_disabled */ })`
4. `ipcMain.handle(IPC.ADVISOR_ENABLE, async (_e, payload: { cwd: string }) => { /* fs.unlink _advisor_disabled, ignoring ENOENT */ })`
5. `ipcMain.handle(IPC.ADVISOR_RESET, (_e, payload: { cwd: string }) => advisorManager.reset(payload.cwd))`
6. `ipcMain.handle(IPC.ADVISOR_SEND_MESSAGE, (_e, payload: { cwd, message, source }) => advisorManager.sendMessage(payload.cwd, payload.message, payload.source))`
7. `ipcMain.on(IPC.ADVISOR_LOG_APPEND, (_e, payload: { cwd, event }) => appendLogEvent(payload.cwd, payload.event))` — fire-and-forget; errors caught and logged via logAdvisorError(cwd) but not re-thrown

Each handler validates input shape (cwd is non-empty string, source is one of valid values, etc.); throws on invalid input so IPC layer surfaces error to renderer.

Wire `registerAdvisorIpcHandlers` into `src/main/index.ts` alongside existing `registerIpcHandlers` call. Pass the same window and a new `AdvisorManager` instance. Add app-quit handler: on `before-quit`, call `advisorManager.flushAllSessions()` which calls `finalizeLog(cwd, 'flowt_close')` for each active session.

### Feedback

### Comments

---

## Expose vibeAPI.advisor in preload

**Status:** todo
**Category:** Phase 1
**ID:** task-013

Modify `src/preload/index.ts` to add `advisor` namespace to the `vibeAPI` object. Expose 7 P1 IPC channels:

```ts
advisor: {
  hydrate: (cwd: string) => ipcRenderer.invoke(IPC.ADVISOR_HYDRATE, { cwd }) as Promise<HydrateResponse>,
  scaffold: (cwd: string) => ipcRenderer.invoke(IPC.ADVISOR_SCAFFOLD, { cwd }) as Promise<ScaffoldResponse>,
  disable: (cwd: string) => ipcRenderer.invoke(IPC.ADVISOR_DISABLE, { cwd }) as Promise<{ ok: boolean }>,
  enable: (cwd: string) => ipcRenderer.invoke(IPC.ADVISOR_ENABLE, { cwd }) as Promise<{ ok: boolean }>,
  reset: (cwd: string) => ipcRenderer.invoke(IPC.ADVISOR_RESET, { cwd }) as Promise<{ ok: boolean }>,
  sendMessage: (cwd, message, source) => ipcRenderer.invoke(IPC.ADVISOR_SEND_MESSAGE, { cwd, message, source }) as Promise<SendMessageResponse>,
  logAppend: (cwd: string, event: AdvisorEvent) => ipcRenderer.send(IPC.ADVISOR_LOG_APPEND, { cwd, event }),
}
```

Type-only update to `VibeAPI` (already exported via `typeof vibeAPI` per CLAUDE.md — no manual sync needed). Verify `window.vibeAPI.advisor` accessible from renderer DevTools after build.

### Feedback

### Comments

---

## Wire chokidar watcher for cc-turns/*.json (banner-dismiss only in P1)

**Status:** todo
**Category:** Phase 1
**ID:** task-014

In `src/main/advisor-manager.ts`, implement chokidar setup. When `hydrate(cwd)` is first called for a CWD AND the project is scaffolded, register a chokidar watcher on `<cwd>/.flowt/cc-turns/*.json` if not already watching.

In P1, the watcher's only behavioral function is to dismiss the AdvisorRestartBanner. On `add` or `change` event:
- Get the relative file path; ignore if the file doesn't match the cc-turns/*.json pattern
- Emit IPC event to renderer: `window.webContents.send('advisor:cc-turn-detected-p1', { cwd })` (NOTE: this is a P1-only stub channel; P2 task-026 replaces it with the full `advisor:cc-turn-detected` payload-rich event)

Hold one chokidar instance per CWD in `chokidarWatchers: Map<cwd, FSWatcher>`. Tear down on Flowt close (handle in app.before-quit). Watcher must be registered AFTER scaffolding completes (the cc-turns directory must exist for chokidar to watch it).

Ignore initial scan (`ignoreInitial: true`) so existing files don't trigger banner-dismiss on hydrate; we only care about NEW files appearing post-scaffold.

For P2, this entire watcher gets replaced by `cc-turns-watcher.ts` (task-026) which adds attribution. The P1 stub establishes the wiring; P2 adds the logic.

### Feedback

### Comments

---

## Build useAdvisor hook

**Status:** todo
**Category:** Phase 1
**ID:** task-015

Create `src/renderer/hooks/useAdvisor.ts`. Takes `activeTabCwd: string | null`. Manages per-CWD state via React state + a `Map<cwd, AdvisorSessionState>` ref to preserve across tab switches.

On `activeTabCwd` change (or initial mount):
1. If cwd is null → set state to "no project" empty
2. Else: call `vibeAPI.advisor.hydrate(cwd)`, store result in the map
3. Replay log events via `replayEvents` (task-008) to derive bubbles + pendingDraft
4. Compute notice_restart_cc_visible: true if `is_scaffolded && !receivedFirstCcTurnSinceScaffold`

Exposes (return value of hook):
- `state: 'NO_SESSION' | 'INITIALIZING' | 'IDLE' | 'THINKING' | 'DRAFT_READY' | 'ERROR_INIT' | 'ERROR_TURN' | 'STALE'` — computed from hydrate + most recent action
- `isDisabled: boolean`, `isScaffolded: boolean`, `hooksInstalled: boolean`
- `bubbles: ChatBubble[]`, `pendingDraft: PendingDraft | null` (null in P1 — drafts P3)
- `noticeRestartCcVisible: boolean`
- `subhintText: string` — formatted "<turn_count> turns · <session_age>" per spec §8.2; computed from bubbles count + (Date.now() - session.started_at)
- `sendMessage(text: string, source: 'typed' | 'send_to_advisor' | 'draft_request')` → optimistically appends founder bubble to local state; calls `vibeAPI.advisor.sendMessage`; awaits result; appends advisor bubble or transitions to error state. Sets state to THINKING during the call.
- `approveConsent()` → calls `vibeAPI.advisor.scaffold(activeTabCwd)`; on success, refreshes via hydrate
- `skipConsent()` → calls `vibeAPI.advisor.disable(activeTabCwd)`; refreshes
- `enableProject()` → calls `vibeAPI.advisor.enable(activeTabCwd)`; refreshes (will re-show consent modal)
- `reset()` → calls `vibeAPI.advisor.reset(activeTabCwd)`; refreshes
- `appendLog(event: AdvisorEvent)` → wraps `vibeAPI.advisor.logAppend(activeTabCwd, event)`

Subscribe on mount:
- `vibeAPI.advisor.onCcTurnDetectedP1?.((data) => { if (data.cwd === activeTabCwd) setReceivedFirstCcTurn(true) })` — P1 stub channel; P2 replaces

Cleanup all listeners on unmount.

### Feedback

### Comments

---

## Build AdvisorEmptyState.tsx with three variants

**Status:** todo
**Category:** Phase 1
**ID:** task-016

Create `src/renderer/components/panels/AdvisorEmptyState.tsx`. Single component with `variant: 'welcome' | 'disabled' | 'initializing'` prop. Match Pencil designs exactly:

- **`variant: 'welcome'`** → Pencil node `kZmkI` ("Advisor — Empty Welcome"). Layout per Pencil: panel header (Advisor title), centered emptyState frame (gap 16, padding 40 vertical / 24 horizontal), compose box at bottom. Copy from spec §4 cross-cutting reference: title "Advisor", subhead "A second Claude Code instance, sandboxed and separate from your main terminal session.", body "Use it as a thinking partner. It can read your project freely but can only write to .flowt/advisor-output/.", placeholder "Type a message or click Send to Advisor on a CC turn to begin."

- **`variant: 'disabled'`** → Pencil node `qgLWV` ("Advisor — Empty Disabled"). Centered emptyState; NO compose box (panel header has divider stroke at bottom). Copy: "Advisor is disabled for this project.", button "Enable Advisor". Click → call `useAdvisor.enableProject()`.

- **`variant: 'initializing'`** → Pencil node `WhyvQ` ("Advisor — Empty Initializing"). Centered emptyState with spinning indicator. Copy: "Spinning up advisor for `<project-name>`…" — extract project-name from the cwd basename.

Match Pencil exactly for layout, spacing, color tokens (`--bg-primary`, `--text-primary`, `--text-secondary`, `--text-muted`), typography (font-mono via existing tokens). Use existing JetBrains Mono font + Flowt design tokens.

If a visual decision is required during build that the Pencil designs do not cover (per spec §13), surface as a question rather than improvising. If the question doesn't get answered quickly, default to matching the closest existing Flowt pattern.

### Feedback

### Comments

---

## Build AdvisorConsentModal.tsx

**Status:** todo
**Category:** Phase 1
**ID:** task-017

Create `src/renderer/components/panels/AdvisorConsentModal.tsx`. Modal dialog matching Pencil node `uRLPI` ("Advisor — Consent Modal"). Per Pencil: 480px wide, cornerRadius 12, fill `#1F1F1F`, stroke `#2a2a2a` 1px inside.

Three frames per Pencil:
- modalHeader (padding 20/24/0/24): title text "Enable Advisor for this project?" — space_between with optional close X button (or Skip button right-aligned)
- modalBody (padding 16/24, gap 16): description text from spec §4 Flow 1.0 cross-cutting reference (the multi-paragraph copy starting with "Flowt will:" and ending with "After approving, restart any running Claude Code sessions...")
- divider (1px tall, fill `#2a2a2a`, full width)
- modalFooter (padding 16/24/20/24, justifyContent end, gap 10): two buttons end-aligned

Buttons:
- "Skip — disable advisor for this project" (secondary) → calls `useAdvisor.skipConsent()`
- "Approve" (primary, green per Flowt convention) → calls `useAdvisor.approveConsent()`. On success (ok:true), dismiss modal. On error (`{ ok: false, error: 'permission_denied' | 'disk_full' | 'malformed_settings_json' }`), show error toast inline within modal with the specific reason

Behavior:
- Modal renders with backdrop overlay (per existing Flowt modal patterns — match style of any existing modals for consistency since Pencil doesn't show backdrop styling)
- Focus trap on open
- Escape key calls Skip (per spec §4 — explicit choice)
- Click outside backdrop → no-op (founder must explicitly choose; per spec §4 Flow 1.0)

Mounted only when `useAdvisor.isScaffolded === false && useAdvisor.isDisabled === false && activeTabCwd != null`.

### Feedback

### Comments

---

## Build AdvisorRestartBanner.tsx

**Status:** todo
**Category:** Phase 1
**ID:** task-018

Create `src/renderer/components/panels/AdvisorRestartBanner.tsx`. Info-style banner matching Pencil node `WMtNX`'s `infoBanner` frame: alignItems center, fill `#3B82F610` (cyan/blue at 10% alpha), gap 8, padding 10/16, stroke `#3B82F630` thickness 1 bottom-only.

Copy from spec §4: "ⓘ Restart Claude Code in your terminal to enable Send to Advisor. The hooks were just installed and won't load into running sessions. In the terminal: Ctrl+C, then `claude`."

Behavior:
- Persistent — NOT manually dismissable (no X button)
- Auto-dismisses when `useAdvisor.noticeRestartCcVisible` flips false (driven by chokidar event in main process — first cc-turns file appearing post-scaffold)
- Renders only when `noticeRestartCcVisible === true`
- Position in panel: directly under panelHeader, above chatArea per Pencil layout
- Use `--accent-cyan` token where Pencil shows `#3B82F6` for the icon/text accent

Component is purely presentational; subscribes to nothing; receives all state via props from parent (AdvisorPanel).

### Feedback

### Comments

---

## Build AdvisorMessageBubble.tsx

**Status:** todo
**Category:** Phase 1
**ID:** task-019

Create `src/renderer/components/panels/AdvisorMessageBubble.tsx`. Renders one chat bubble.

Props: `{ role: 'founder' | 'advisor' | 'system'; text: string; subhint?: string; sourceTagline?: string }`.

Visual style matching Pencil VfopH chat area children:

- **`role: 'founder'`** → right-aligned bubble. Background slightly tinted (use Flowt's existing user-message styling pattern — match Tasks panel comment bubbles or similar). If `sourceTagline` is set (e.g., '↗ from terminal turn'), show small subhint above bubble in `--text-muted` color
- **`role: 'advisor'`** → left-aligned bubble. Markdown rendering via `marked` + `dompurify` (existing Flowt setup — reuse the renderer's existing markdown utility from MDs panel if extracted, else replicate inline). Style code blocks with monospace + `--bg-tertiary` background
- **`role: 'system'`** → centered, dimmed (text color `--text-muted`), italicized. Used for the synthetic 'Asking advisor to draft the executor message…' bubble per task-008 replayer logic. No background fill — just flowing text

Common:
- Padding inside bubble: 8/12 (horizontal/vertical)
- Border radius: 8
- Font: var(--font-mono), size: var(--font-size-ui)
- Line-height: 1.5
- Max-width: 85% of container

No interactivity in P1 — links inside markdown rendered as `<a target="_blank" rel="noreferrer noopener">` for browser default. Selection enabled (don't disable user-select).

### Feedback

### Comments

---

## Build AdvisorChatList.tsx and AdvisorComposeBox.tsx

**Status:** todo
**Category:** Phase 1
**ID:** task-020

Create both files in `src/renderer/components/panels/`.

**`AdvisorChatList.tsx`**: scroll container rendering the `bubbles[]` array from `useAdvisor`. Layout matching Pencil VfopH `chat` frame: vertical layout, gap 12, padding 12/16. Renders `AdvisorMessageBubble` for each entry, keyed by bubble.id.

Behaviors:
- Auto-scroll to bottom on new bubble. Use IntersectionObserver pattern: observe a sentinel div at the bottom; if it was in view before the new bubble, scroll into view after; if user had scrolled up (sentinel out of view), don't auto-scroll
- When `state === 'THINKING'`, render a "thinking placeholder" bubble at the end: pulsing 3-dot animation in advisor-style left-aligned bubble. Match Pencil BcAWK ("Advisor — Thinking State") visual reference for the disabled/thinking presentation
- Empty bubbles[] → render nothing (the empty state is handled by parent AdvisorPanel choosing different child)

**`AdvisorComposeBox.tsx`**: textarea at bottom of panel matching Pencil VfopH `comp` frame: layout vertical, gap 6, padding 12/16, stroke `#2a2a2a` thickness 1 top-only.

Textarea behavior:
- Multi-line with auto-grow up to ~6 rows max (then scroll internally)
- Shift+Enter inserts newline; Enter alone submits
- Character counter shown below when text length > 4000 (subtle, `--text-muted`)
- Disabled (opacity 0.4 per Pencil BcAWK) when state is THINKING / INITIALIZING / STALE / ERROR_INIT, OR when hooks-removed banner is active (P4 dependency — handle in P1 with the state values that exist; STALE etc. lands in P4 but the disabled state machine is already in place)
- Placeholder text varies by state:
  - NO_SESSION: "Type a message or click Send to Advisor on a CC turn to begin." (per spec §4 cross-cutting reference)
  - IDLE / DRAFT_READY: "Continue the conversation…"
- On Enter (without Shift): call `useAdvisor.sendMessage(text, 'typed')`, clear textarea
- Font: `var(--font-mono)`, size: `var(--font-size-ui)`, color: `--text-primary`

### Feedback

### Comments

---

## Build AdvisorPanel.tsx orchestrator with subhint

**Status:** todo
**Category:** Phase 1
**ID:** task-021

Create `src/renderer/components/panels/AdvisorPanel.tsx`. Container matching Pencil nodes VfopH (IDLE), BcAWK (THINKING), Y9qIXO (DRAFT_READY — but draft card is P3, render placeholder for now).

Props: `{ cwd: string | null }`. Internally calls `useAdvisor(cwd)` and renders accordingly.

Layout per Pencil VfopH:
1. **panelHeader** (gap 4, padding 12/16/8/16):
   - Title row: "Advisor" text (left), Reset button + Draft button (right). Draft button is rendered but disabled in P1 (returns true when state === 'IDLE' || 'DRAFT_READY' but always shows tooltip "Coming soon" until P3 task-040 wires it)
   - Subhint row: `<turn_count> turns · <session_age>` from `useAdvisor.subhintText`. Use `--text-muted`. Format session_age as e.g. "4m" / "2h 14m" via simple arithmetic on `Date.now() - session.started_at`. Hide entirely if state is NO_SESSION

2. **`AdvisorRestartBanner`** (conditional, when `noticeRestartCcVisible` true)

3. **Content area** based on state:
   - `NO_SESSION` AND `!isScaffolded` AND `!isDisabled` → render `<AdvisorConsentModal />` overlay; in background show empty welcome state
   - `isDisabled` → render `<AdvisorEmptyState variant="disabled" />`
   - `INITIALIZING` → render `<AdvisorEmptyState variant="initializing" />`
   - `NO_SESSION` AND `isScaffolded` → render `<AdvisorEmptyState variant="welcome" />` (with compose box)
   - `IDLE` / `THINKING` / `DRAFT_READY` / `ERROR_INIT` / `ERROR_TURN` / `STALE` → render `<AdvisorChatList bubbles={bubbles} state={state} />`

4. **`AdvisorComposeBox`** (always at bottom; disabled in some states per task-020)

Reset button click → simple `confirm()` dialog ("Reset advisor for `<project-name>`?") for P1; proper modal can be polish task. On confirm → `useAdvisor.reset()`.

The reset confirm modal styling isn't in Pencil designs — per spec §13 + Step 3 confirmation, default to matching closest existing Flowt modal styling (e.g. the existing tab close confirmation pattern) if a custom modal is built later.

### Feedback

### Comments

---

## Add Advisor tab to RightPanel.tsx

**Status:** todo
**Category:** Phase 1
**ID:** task-022

Modify `src/renderer/components/layout/RightPanel.tsx`:

1. Update `RightTab` type union to add `'advisor'`: `type RightTab = 'preview' | 'claude' | 'advisor' | 'tasks'`
2. Add tab button between Claude and Tasks tabs, matching the existing tab button pattern (40px height, padding 0/16, font-size-sm, conditional color/bg/border based on activeTab). Label: `Advisor`
3. When `activeTab === 'advisor'`, render `<AdvisorPanel cwd={activeTabCwd} />` — receive activeTabCwd via props from parent
4. Update `previewHidden` logic: previewHidden = `dropdownOpen || activeTab !== 'preview'` (this likely already covers the new advisor tab without changes since the condition is already `!== 'preview'`)
5. Add a new prop to RightPanel: `activeTabCwd: string | null`
6. Pass through to AdvisorPanel as `cwd` prop

### Feedback

### Comments

---

## Wire useAdvisor into App.tsx and pass through to RightPanel

**Status:** todo
**Category:** Phase 1
**ID:** task-023

Modify `src/renderer/App.tsx`:

1. Add state `const [activeTabCwd, setActiveTabCwd] = useState<string | null>(null)`
2. Set up CWD polling: every 2 seconds (per CLAUDE.md "CWD polling every 2s auto-detects when user `cd`s"), call `window.vibeAPI.app.getCwd(activeTabId)` and update activeTabCwd. Use a ref pattern (per CLAUDE.md "CWD polling with ref (not state) for comparison" to avoid stale closure)
3. Pass `activeTabCwd` to `<RightPanel activeTabCwd={activeTabCwd} ... />`

Note: AdvisorPanel calls `useAdvisor(cwd)` directly; the hook is NOT mounted at App level. This is intentional — the hook's lifecycle follows the panel's, and per-CWD state is managed via the hook's internal Map. If perf becomes an issue with multiple panels mounting/unmounting, refactor to App-level later.

### Feedback

### Comments

---

## End-to-end manual test of Phase 1 happy path

**Status:** todo
**Category:** Phase 1
**ID:** task-024

Manual verification checklist after Phase 1 implementation. Run before tagging Phase 1 complete.

**Setup & launch:**
1. `npx tsc --noEmit -p tsconfig.json` — clean (no type errors)
2. `npm test` — all 4 P1 unit test files green (advisor-prompt-builder, advisor-log-writer, advisor-scaffolder, advisor-event-replayer)
3. `npm start` — Flowt launches without errors

**Consent & first conversation:**
4. Open a fresh project folder (no `.flowt/` yet); navigate via terminal `cd /path/to/fresh/project`
5. Wait ≤2s for CWD polling to register; click Advisor tab → consent modal appears matching uRLPI design
6. Click Approve → modal closes; Restart-CC banner appears (matching WMtNX cyan-tint design); empty welcome state shown with compose box
7. Type "hello" in compose box, press Enter → message appears as right-aligned founder bubble; thinking placeholder appears below; advisor reply appears as left-aligned bubble; subhint shows `1 turn · <Xm>`
8. Continue with another message → conversation builds; subhint increments to `2 turns · <Xm>`

**Hook chain verification (task-024 hardened sub-steps from planning Step 3 fix):**
- **10a.** In a separate terminal (not Flowt), `ls -la <project-cwd>/.flowt/` — verify cc-stop-hook.sh and sandbox-check.sh both present with executable bit (-rwxr-xr-x or similar)
- **10b.** `cat <project-cwd>/.claude/settings.json | jq '.hooks'` — verify both `_flowt_managed: true` entries present: PreToolUse referencing `bash .flowt/sandbox-check.sh`, Stop referencing `bash .flowt/cc-stop-hook.sh`. Both have `timeout_ms: 5000`
- **10c.** `ls <project-cwd>/.flowt/cc-turns/` — directory exists, currently empty
- **10d.** Open Flowt DevTools (`Cmd+Opt+I`); switch to Console; filter `[advisor]`. No errors should appear yet
- **10e.** In Flowt's terminal tab, run `claude` (no flags). Wait for Claude Code TUI to be ready (`? for shortcuts` visible)
- **10f.** Type a simple message in the CC input (e.g. `hello`) and press Enter; wait for response to complete (✻ Brewed/Cooked/Cogitated line appears)
- **10g.** Verify cc-turn file appeared: `ls <project-cwd>/.flowt/cc-turns/` should now show one `<session-id>.json` file. `cat <project-cwd>/.flowt/cc-turns/*.json | jq` — verify schema: `schema_version: 1`, `session_id` present, `captured_at` ISO timestamp, `stop_reason` set, `assistant_text` non-empty. **Q3 verification gate**: if `assistant_text` is EMPTY string, the Stop hook payload doesn't include it directly; surface to founder before proceeding to P2; cc-stop-hook.sh needs extension to read transcript_path
- **10h.** Verify executor-state.json updated: `cat <project-cwd>/.flowt/executor-state.json | jq` — `last_session_id` matches the cc-turn filename, `last_turn_at` ≈ now
- **10i.** Verify chokidar fired in main process: in Flowt's verbose log drawer (or DevTools Console with filter), expect to see indication `cc-turn-detected-p1` IPC event was emitted to renderer (add temporary console.log in main if not already present, remove after verification)
- **10j.** Verify the IPC event reached the renderer: in DevTools Console, expect `useAdvisor` hook to log `[advisor] noticeDismissed` (add temp log if needed)
- **10k.** Verify banner state flipped in UI: the AdvisorRestartBanner that was visible after step 6 should now be gone from the panel. **Crucially**: switch to a different terminal tab in a different CWD then back — banner should still be gone (i.e., the dismiss is persistent for this session, not a side-effect of tab switch / re-render)
- **10l.** Verify dismiss durability: kill Flowt, reopen, navigate back to project. Banner should still NOT show (the dismiss state was driven by the cc-turn file existing, which it still does — the banner's "should I show?" predicate is `is_scaffolded && cc-turns/* directory is empty`). Verify by: opening `<cwd>/.flowt/cc-turns/` and removing the file `rm cc-turns/*.json`, then reopening Flowt — banner should reappear because the dismiss condition is no longer met

**Persistence:**
11. Close Flowt completely (Cmd+Q); reopen; navigate back to project → Advisor panel hydrates, conversation visible (replay from log); subhint shows correct turn count
12. Type another message → verify `--resume` was used (advisor remembers context — e.g., reference earlier conversation)

**Reset:**
13. Click Reset → confirm; panel reverts to empty welcome state; `cat .flowt/advisor-state.json | jq` shows null active_session_id; previous log file finalized with `ended_via: 'reset'`

**Project switch:**
14. Open new terminal tab in Flowt; `cd /different/project`; wait ≤2s → Advisor panel swaps to new CWD's state (NO_SESSION if fresh, or session restore if scaffolded)
15. Switch back to original tab → Advisor panel restores original project's session/conversation

**Sandbox enforcement:**
16. In advisor compose box, ask "Please write a test file to docs/test.md" → advisor reply explains it can only write to `.flowt/advisor-output/`, hook blocked the attempt; verify in advisor's reply text

**Build:**
17. `npm run make -- --targets @electron-forge/maker-dmg` → DMG built successfully

All steps must pass before task-024 is marked done and Phase 1 is complete.

### Feedback

### Comments

---

## Add Phase 2 IPC channels and listeners

**Status:** todo
**Category:** Phase 2
**ID:** task-025

Extend `src/shared/ipc-channels.ts` with 4 new channels:
- `ADVISOR_READ_CC_TURN = 'advisor:read-cc-turn'`
- `ADVISOR_CC_TURN_DETECTED = 'advisor:cc-turn-detected'` (replaces P1 stub `advisor:cc-turn-detected-p1`)
- `ADVISOR_TAB_ATTRIBUTION_CHANGED = 'advisor:tab-attribution-changed'`
- `PTY_CLAUDE_RUNNING_CHANGED = 'pty:claude-running-changed'`

Update `vibeAPI.advisor` namespace in `src/preload/index.ts`:
```ts
readCcTurn: (cwd: string, sessionId: string) => ipcRenderer.invoke(IPC.ADVISOR_READ_CC_TURN, { cwd, sessionId }) as Promise<ReadCcTurnResponse>,
onCcTurnDetected: (cb: (data: { cwd, session_id, turn, attributed_tab_id }) => void) => { ipcRenderer.on(IPC.ADVISOR_CC_TURN_DETECTED, ...); return unsubscribe },
onTabAttributionChanged: (cb: (data: { tab_id, session_id, cwd }) => void) => { ipcRenderer.on(IPC.ADVISOR_TAB_ATTRIBUTION_CHANGED, ...); return unsubscribe },
```

Add to `vibeAPI.pty` namespace:
```ts
claudeRunningChanged: (data: { tab_id, cwd, is_running, transition_at }) => ipcRenderer.send(IPC.PTY_CLAUDE_RUNNING_CHANGED, data),
```

Update P1 stub `advisor:cc-turn-detected-p1` listener — useAdvisor switches to the full `advisor:cc-turn-detected` listener with payload-rich data per spec §7.

### Feedback

### Comments

---

## Build cc-turns-watcher.ts with attribution algorithm

**Status:** todo
**Category:** Phase 2
**ID:** task-026

Create `src/main/cc-turns-watcher.ts`. Replaces the P1 banner-dismiss-only watcher in advisor-manager (task-014). Class `CcTurnsWatcher` maintains:

- `watchers: Map<cwd, FSWatcher>` (chokidar instances per cwd)
- `tabState: Map<tabId, { isClaudeRunning, lastClaudeRunningTransition, cwd }>` (updated by `pty:claude-running-changed` IPC events)
- `tabExecutors: Map<tabId, { session_id, attributed_at, cwd }>` (the attribution result)

Public methods:

**`startWatching(cwd: string): void`** — register chokidar on `<cwd>/.flowt/cc-turns/*.json`; on `add` or `change` event:
1. Parse session_id from basename (strip `.json`)
2. Read file via `<cwd>/.flowt/cc-turns/<sid>.json`; parse JSON; validate schema_version === 1
3. Run attribution algorithm per spec Flow 2.A:
   - Filter active tabs to those in this CWD
   - Filter to candidates: `tabState[tabId].isClaudeRunning && !tabExecutors[tabId]` (no current attribution)
   - If 1 candidate → attribute: `tabExecutors[tabId] = { session_id, attributed_at: Date.now(), cwd }`
   - If N>1 candidates → attribute to tab with most recent `lastClaudeRunningTransition` timestamp; append `attribution_ambiguous` event to the active advisor log via `appendLogEvent` with payload `{ candidate_tab_ids, chosen_tab_id, session_id }`
   - If 0 candidates → ignore (orphan turn — non-Flowt CC session, or all tabs already attributed)
4. Emit IPC: `window.webContents.send(IPC.ADVISOR_CC_TURN_DETECTED, { cwd, session_id, turn, attributed_tab_id })` with payload-rich CcTurn
5. If attribution happened: also emit `IPC.ADVISOR_TAB_ATTRIBUTION_CHANGED` with `{ tab_id, session_id, cwd }`
6. Update `executor-state.json.last_turn_at` (atomic; this is also done by cc-stop-hook.sh but redundant safety)

**`stopWatching(cwd: string): void`** — close chokidar instance; remove from map

**`onTabRunningChanged(payload: { tab_id, cwd, is_running, transition_at }): void`** — handler for `pty:claude-running-changed` IPC events:
1. Update `tabState[tab_id]`
2. On `is_running: true → false` OR `false → true`: clear `tabExecutors[tab_id]` (any prior attribution is stale; new chokidar event will re-attribute if applicable)
3. Emit `IPC.ADVISOR_TAB_ATTRIBUTION_CHANGED` with `{ tab_id, session_id: null, cwd }` to inform renderer

Wire in main process:
- `index.ts` instantiates `CcTurnsWatcher` alongside AdvisorManager
- `advisor-ipc-handlers.ts` adds `ipcMain.on(IPC.PTY_CLAUDE_RUNNING_CHANGED, (_e, payload) => watcher.onTabRunningChanged(payload))`
- `advisor-ipc-handlers.ts` adds `ipcMain.handle(IPC.ADVISOR_READ_CC_TURN, (_e, { cwd, sessionId }) => readCcTurnFile(cwd, sessionId))`
- AdvisorManager.hydrate now calls `watcher.startWatching(cwd)` instead of registering its own chokidar

The P1 stub `advisor:cc-turn-detected-p1` channel can be removed; renderer subscribes to the new `advisor:cc-turn-detected` channel.

### Feedback

### Comments

---

## Tests for cc-turns-watcher

**Status:** todo
**Category:** Phase 2
**ID:** task-027

Create `tests/unit/cc-turns-watcher.test.ts`. Test the attribution algorithm in isolation (mock chokidar, mock fs reads, no actual filesystem).

Approach: extract the pure `attribute(tabState, tabExecutors, sessionId, cwd)` function from CcTurnsWatcher and test it directly. The chokidar wiring is integration; the algorithm is the testable unit.

Test cases:
1. **Single candidate**: tabState has 1 tab matching cwd with isClaudeRunning=true and no executor; attribute → returns the tab's id
2. **Two candidate tabs, different transitions**: tab A transitioned at t=100, tab B at t=200; attribute → tab B (most recent)
3. **Attribution ambiguous logged**: with 2 candidates, output object should include `attribution_ambiguous` flag with both candidates
4. **Zero candidates**: tabState has tabs but none with isClaudeRunning=true OR all already attributed; attribute → null (orphan)
5. **Already attributed**: tab has executor.session_id set; attribute call doesn't change attribution (re-attribution doesn't fire on subsequent same-session events — handled at chokidar layer by file content check, but verify the algorithm doesn't double-attribute)
6. **Tab in different CWD**: tabState includes a tab from a different cwd; that tab is not a candidate even if isClaudeRunning=true (attribution scoped to cwd)
7. **Tab transition reset**: simulate tab.isClaudeRunning false→true → tabExecutors[tabId] cleared; subsequent attribute call considers it as candidate again
8. **All tabs attributed in CWD**: 3 tabs, all already have executor.session_id set; new chokidar event with new session_id → 0 candidates → orphan (acceptable; the new session is unattributable until a tab's state flips)

### Feedback

### Comments

---

## Implement read-cc-turn IPC handler

**Status:** todo
**Category:** Phase 2
**ID:** task-028

In `src/main/advisor-ipc-handlers.ts`, register `ipcMain.handle(IPC.ADVISOR_READ_CC_TURN, ...)`. Logic per spec §7:

```ts
ipcMain.handle(IPC.ADVISOR_READ_CC_TURN, async (_e, { cwd, sessionId }) => {
  const filePath = path.join(cwd, '.flowt', 'cc-turns', `${sessionId}.json`);
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const turn = JSON.parse(content);
    if (turn.schema_version !== 1) {
      return { ok: false, reason: 'schema_mismatch' };
    }
    return { ok: true, turn };
  } catch (err: any) {
    if (err.code === 'ENOENT') return { ok: false, reason: 'missing' };
    if (err instanceof SyntaxError) return { ok: false, reason: 'parse_error' };
    return { ok: false, reason: 'unreadable' };
  }
});
```

Validate input: cwd and sessionId both non-empty strings.

### Feedback

### Comments

---

## Build SendToAdvisorButton.tsx

**Status:** todo
**Category:** Phase 2
**ID:** task-029

Create `src/renderer/components/terminal/SendToAdvisorButton.tsx`. Floating button in terminal viewport, positioned to the LEFT of the existing Copy button (which we shipped in commit 45f385d), with 8px gap between them.

Visual style: same look-and-feel as the existing Copy button (light gray, semi-transparent dark background with border, similar size and shape). Icon: a "send-to" or "arrow-right-into-box" SVG icon (pick a Lucide-style icon that conveys "send/forward").

Renders only when `isClaudeRunning(activeTabId)` is true.

Enabled state per spec Flow 2.1:
- **Tab has executor_session_id (attributed) AND `cc-turns/<sid>.json` newer than last `send_to_advisor` event for this session** → enabled with green dot indicator (small dot on top-right corner of button)
- **Tab `isClaudeRunning` true but `executor_session_id === null`** (waiting for first Stop event) → disabled with subhint `↺ waiting for first turn`
- **`_advisor_disabled` flag exists for this project** → hidden entirely

Tooltip when enabled: `Send last CC turn to the advisor (⌘⌥A)`
Tooltip when disabled (no executor session): `Run claude in this tab to enable Send to Advisor`

On click:
1. Call `vibeAPI.advisor.readCcTurn(cwd, executor_session_id)` from `useAdvisor` or directly
2. If `{ ok: false, reason: 'missing' }` → show toast: `No CC turn captured. If you started Claude Code before enabling the advisor, restart it (Ctrl+C, then claude) to enable Send to Advisor.`
3. If stale (turn.captured_at <= last send_to_advisor.captured_at for this session): show toast: `No new CC turn since the last send.`
4. If ok: construct prompt per Flow 2.3 with metadata header:
   ```
   Here is the latest turn from the executor Claude Code session
   (stop_reason: <turn.stop_reason>, captured <turn.captured_at>):

   ---

   <turn.assistant_text>

   ---

   What do you make of it? Anything worth flagging before I respond?
   ```
5. Call `useAdvisor.sendMessage(prompt, 'send_to_advisor')` with executor_session_id metadata so the log event includes it
6. Call `useAdvisor.appendLog({ type: 'send_to_advisor', ts, cc_turn_text: turn.assistant_text, char_count: turn.assistant_text.length, source: 'stop_hook', stop_reason: turn.stop_reason, turn_index: turn.turn_index, executor_session_id: turn.session_id })`
7. Trigger right-panel auto-switch to Advisor tab (via callback from parent — see task-033)

### Feedback

### Comments

---

## Modify TerminalView.tsx to host SendToAdvisorButton

**Status:** todo
**Category:** Phase 2
**ID:** task-030

Modify `src/renderer/components/terminal/TerminalView.tsx` to mount `<SendToAdvisorButton tabId={tabId} cwd={tabCwd} onSent={onAdvisorSent} />` adjacent to the existing Copy button (which lives at the bottom-right corner of the terminal viewport). Position both buttons side-by-side: SendToAdvisor on the LEFT of Copy with 8px gap.

Pass through:
- `tabId` (already in scope)
- `tabCwd` — comes from props or via Flowt's existing CWD detection mechanism. May need to add a prop drill from RightPanel → LeftPanel → TerminalView, OR fetch via `vibeAPI.app.getCwd(tabId)` directly inside SendToAdvisorButton on mount + on isClaudeRunning transitions
- `onSent` — callback to trigger right-panel switch to Advisor tab; received from App.tsx via context or props

The existing isClaudeRunning detection (the buffer-scan logic from commit 45f385d for `? for shortcuts` / `esc to interrupt`) is reused — same condition gates both Copy and SendToAdvisor button visibility.

### Feedback

### Comments

---

## Modify useTerminal.ts to emit pty:claude-running-changed

**Status:** todo
**Category:** Phase 2
**ID:** task-031

Modify `src/renderer/hooks/useTerminal.ts` (or wherever the existing isClaudeRunning buffer-scan logic lives — may be in `TerminalView.tsx` per the recent copy-button change in commit 45f385d).

When `isClaudeRunning` flips (in either direction — false→true or true→false), call:
```ts
window.vibeAPI.pty.claudeRunningChanged({
  tab_id: tabId,
  cwd: tabCwd,
  is_running: newValue,
  transition_at: Date.now()
});
```

This feeds `cc-turns-watcher.ts` (task-026) state map for attribution. Emit on every transition; do NOT emit on every poll if state didn't change.

Track previous state via `useRef` to detect transitions cleanly.

### Feedback

### Comments

---

## Add ⌘⌥A keyboard shortcut for Send to Advisor

**Status:** todo
**Category:** Phase 2
**ID:** task-032

In `TerminalView.tsx` (where `Cmd+F` and `Cmd+Option+V` are wired per existing code), add `Cmd+Option+A` handler that triggers the same code path as clicking SendToAdvisorButton.

Use `e.metaKey && e.altKey && e.code === 'KeyA'` (KeyA, NOT 'a' — Option transforms the key character on macOS, same pattern as the ⌘⌥V handler from commit 45f385d).

Only fires when:
- `isActive` (this tab is the active terminal)
- `isClaudeRunning` is true
- The button would be in enabled state (executor_session_id set AND fresh cc-turn available)

If the conditions don't match, the keypress is ignored (don't preventDefault — let it fall through to normal handling).

### Feedback

### Comments

---

## Wire auto-switch to Advisor tab on Send to Advisor

**Status:** todo
**Category:** Phase 2
**ID:** task-033

In `src/renderer/App.tsx` and/or `src/renderer/components/layout/RightPanel.tsx`, expose a way to programmatically switch the active right-panel tab to `'advisor'`.

Implementation options:
1. **Lift activeTab state to App.tsx**: move `useState<RightTab>` from RightPanel to App; pass setter as `setActiveRightTab` to wherever needed (TerminalView via prop drill, or via a Context)
2. **React Context**: create `RightPanelContext` providing `setActiveTab`; wrap App in provider; SendToAdvisorButton consumes it

Pick the simpler option (option 1 if prop drilling is shallow; option 2 if it spans many components).

Called from `useAdvisor.sendMessage` when `source === 'send_to_advisor'`, or from the SendToAdvisorButton's `onSent` callback. Renderer-only; no IPC.

### Feedback

### Comments

---

## Manual test — multi-tab attribution

**Status:** todo
**Category:** Phase 2
**ID:** task-034

Manual verification checklist after Phase 2 implementation. Run before tagging Phase 2 complete.

**Setup:**
1. `npx tsc --noEmit` clean; `npm test` all 5 unit test files green (P1's 4 + cc-turns-watcher); `npm start`

**Single-tab flow:**
2. Open project with advisor scaffolded (from P1); run `claude` in tab 1; produce one CC turn
3. Verify SendToAdvisorButton in tab 1 appears (matching Copy button visual style, with green dot indicator); button enabled
4. Click button → CC turn pipes to advisor as founder bubble with `↗ from terminal turn` subhint and metadata header (stop_reason + captured_at); right panel auto-switches to Advisor tab; advisor responds
5. Verify advisor-logs/<session>.json has `send_to_advisor` event with correct payload (stop_reason, turn_index, executor_session_id)
6. Press ⌘⌥A → no-op (button is no longer in fresh state — turn already sent)
7. CC produces another turn; button green dot returns; ⌘⌥A → pipes correctly

**Multi-tab attribution:**
8. Open second terminal tab (Cmd+T) in same project; run `claude` (creates new session_id automatically)
9. Wait until tab 2's CC produces its first turn
10. Verify tab 2's SendToAdvisorButton enables independently (different green dot state); tab 1's button reflects only tab 1's state
11. Switch to tab 2; click SendToAdvisorButton → tab 2's CC turn pipes (NOT tab 1's). Verify in advisor: founder bubble contains tab 2's content
12. Switch to tab 1; ⌘⌥A → tab 1's CC turn pipes (most recent turn from tab 1)

**Sub-second concurrent spawn (induced ambiguity):**
13. In two terminals, run `claude` simultaneously (best effort — type `claude` in both, hit Enter at almost the same time)
14. Both produce turns; verify advisor-logs may show `attribution_ambiguous` event with both candidate tab_ids; attribution defaults to most recent transition winner. Acceptable per spec — self-corrects on next turn

**No-Flowt-spawn case:**
15. In a project where advisor is scaffolded but you haven't restarted CC since scaffolding (i.e., CC is running but pre-dates the hook install): verify SendToAdvisorButton is disabled with subhint `↺ waiting for first turn` (no cc-turns file yet)
16. Restart CC (Ctrl+C, claude) → button enables on next turn → confirms the hook reload pattern works

**Verification sub-steps from task-024 (re-run if changes affect chain):**
17. `cat .flowt/cc-turns/<sid>.json | jq` — schema still v1, all expected fields
18. DevTools Console with `[advisor]` filter shows no errors during the multi-tab flow

All steps must pass before task-034 is marked done and Phase 2 is complete.

### Feedback

### Comments

---

## Build advisor-draft-parser.ts pure function

**Status:** todo
**Category:** Phase 3
**ID:** task-035

Create `src/main/advisor-draft-parser.ts`. Pure function with no side effects. Highly testable.

Signature:
```ts
export function parseDraft(text: string): {
  hasDelimiters: boolean;
  innerContent: string | null;
  preamble: string;
  postamble: string;
}
```

Logic:
1. Find first occurrence of `<!-- FLOWT_DRAFT_START -->`
2. From that position, find next occurrence of `<!-- FLOWT_DRAFT_END -->`
3. If both found: extract inner content (text between markers, trimmed)
4. If inner content (post-trim) is empty: return `{ hasDelimiters: false, innerContent: null, preamble: text, postamble: '' }`
5. If both found AND inner non-empty: return `{ hasDelimiters: true, innerContent: <trimmed inner>, preamble: <text before START>, postamble: <text after END> }`
6. Else (one or neither marker found, or markers in wrong order): return `{ hasDelimiters: false, innerContent: null, preamble: text, postamble: '' }`

Pure function — same input → same output. No regex side-effects. No I/O.

### Feedback

### Comments

---

## Tests for advisor-draft-parser

**Status:** todo
**Category:** Phase 3
**ID:** task-036

Create `tests/unit/advisor-draft-parser.test.ts`. Test cases:

1. **Happy path**: input `Here is the draft:\n<!-- FLOWT_DRAFT_START -->\nHello world\n<!-- FLOWT_DRAFT_END -->\nDone.` → `hasDelimiters: true, innerContent: 'Hello world', preamble: 'Here is the draft:\n', postamble: '\nDone.'`
2. **Only START marker**: input contains START but no END → `hasDelimiters: false, innerContent: null`
3. **Only END marker**: input contains END but no START → `hasDelimiters: false`
4. **Reversed order (END before START)**: `<!-- FLOWT_DRAFT_END -->\nfoo\n<!-- FLOWT_DRAFT_START -->\nbar` → `hasDelimiters: false` (the second END after the START is searched for; if not present, no match)
5. **Empty content between markers**: `<!-- FLOWT_DRAFT_START -->\n   \n<!-- FLOWT_DRAFT_END -->` → `hasDelimiters: false` (whitespace-only inner trims to empty)
6. **Markers nested inside code block**: a markdown code block containing the marker text → still parsed (spec doesn't differentiate; the code-block context is irrelevant)
7. **Multiple START/END pairs**: `<!-- FLOWT_DRAFT_START -->\nfirst\n<!-- FLOWT_DRAFT_END -->\nbetween\n<!-- FLOWT_DRAFT_START -->\nsecond\n<!-- FLOWT_DRAFT_END -->` → only the first pair extracted (innerContent: 'first', postamble includes the second pair)
8. **Markers with extra whitespace**: `<!-- FLOWT_DRAFT_START -->\n\n  some draft text  \n\n<!-- FLOWT_DRAFT_END -->` → innerContent trimmed to 'some draft text'
9. **Long preamble + draft + long postamble**: full parse with all three sections
10. **Marker text with extra spaces inside the comment**: `<!--FLOWT_DRAFT_START-->` (no spaces inside) → currently spec is strict, expects EXACT match including spaces; verify behavior is hasDelimiters: false (or update parser if loose matching is desired — for v1, strict)

### Feedback

### Comments

---

## Wire draft detection into advisor-manager.sendMessage

**Status:** todo
**Category:** Phase 3
**ID:** task-037

Modify `src/main/advisor-manager.ts` `sendMessage` method. After parsing the JSON envelope and extracting `result` text:

1. Call `parseDraft(result)` from advisor-draft-parser (task-035)
2. If `hasDelimiters && innerContent !== null`:
   - Append `draft_produced` event with `{ type: 'draft_produced', ts, text: innerContent }` (only the inner content, not the wrapping)
   - Update in-memory session's `pending_draft` to `{ state: 'DRAFT_READY', raw_text: innerContent, edited_text: null, produced_at: ts }`
   - Return `draft_inner: innerContent` to caller
3. If `hasDelimiters: false` AND the most recent `draft_cc_clicked` event in the log is the most recent draft-related event (i.e., founder explicitly asked for a draft and didn't get one):
   - Append `draft_parse_fail` event with `{ type: 'draft_parse_fail', ts, raw_response: result }`
   - Return `draft_inner: null`
4. If `hasDelimiters: false` AND no pending `draft_cc_clicked` (i.e., normal conversation turn):
   - Just return; advisor produced normal text without delimiters (expected); no draft_parse_fail event

The `pending_draft` field in `AdvisorSessionMemory` (added in P1 task-011 but unused there) is now wired into the manager state.

### Feedback

### Comments

---

## Add internal draft prompt construction in advisor-manager

**Status:** todo
**Category:** Phase 3
**ID:** task-038

When `sendMessage(cwd, message, source: 'draft_request')` is called from the renderer (when the founder clicks Draft Message to CC):

**Locked behavior** (per planning Step 3 fix — no "decide during implementation" ambiguity):
1. Substitute the founder's UI input (the `message` param) with the locked Step 4.2 prompt template — verbatim multi-line string from spec §4 Flow 4.2:
   ```
   Now produce the executor message. Wrap it in delimiters exactly like this:

   <!-- FLOWT_DRAFT_START -->
   <the message text, ready to send to the executor>
   <!-- FLOWT_DRAFT_END -->

   The executor message must be self-contained. The executor cannot see our
   conversation. Include any relevant context, file references, or constraints
   inline.

   Do not include conversational preamble in the draft. Start directly with
   the instruction. The executor doesn't need to be greeted or oriented, it
   needs the task.
   ```
2. Append `draft_cc_clicked` event to log (NO new event types; NO synthetic founder_message). The renderer's `replayEvents` (task-008) will derive the system bubble from the `draft_cc_clicked` event presence
3. Spawn `claude -p` with the substituted text as the user message
4. Append `advisor_response` event normally on response
5. Parser detects delimiters via task-037 logic; appends `draft_produced` (clears the synthetic system bubble naturally) or `draft_parse_fail` (also clears it; renderer shows inline parse-fail subhint via task-040)

The `founder_message` event is NOT appended for source='draft_request' — only `draft_cc_clicked`. The chat replay shows the system bubble via the replayer's synthetic derivation, not via a logged event.

### Feedback

### Comments

---

## Build AdvisorDraftCard.tsx

**Status:** todo
**Category:** Phase 3
**ID:** task-039

Create `src/renderer/components/panels/AdvisorDraftCard.tsx`. Card matching Pencil node `Y9qIXO` ("Advisor — DRAFT_READY"). Full-width within chat (wider than message bubbles).

Props: `{ pendingDraft: PendingDraft; onEdit: (newText: string) => void; onSendCompose: (text: string) => Promise<void>; onSendDirect: (text: string) => Promise<void>; onDiscard: () => void; activeExecutorTabName?: string }`

Layout:
- **Header row**: `Draft for executor` title (left, font-size-ui, color text-primary), `✕` discard button (right, small, color text-muted hover text-primary)
- **Body**: rendered markdown of `pendingDraft.edited_text ?? pendingDraft.raw_text` via marked + dompurify. Click anywhere on body → swap to `<textarea>` pre-filled with raw markdown source. Esc OR click-outside → revert to rendered view (no save). "Done" button OR Cmd+Enter → commit edit, call `onEdit(textareaValue)`. While in edit mode, display "Click to edit" hint as faint subhint. Card switches to slightly different border treatment to show edit state
- **Footer row** (justify space-between):
  - **Left**: char count `<N> chars` in text-muted
  - **Right**: two buttons:
    - `[Send and execute]` (secondary, outline button, color text-muted, smaller visual weight)
    - `[Send to Terminal]` (primary, green, larger visual weight) — uses var(--accent-green) bg
  - When edited (`edited_text !== null`): button labels become `Send Edited and Execute` and `Send Edited Draft to Terminal`

Send to Terminal click:
1. Compute final text: `pendingDraft.edited_text ?? pendingDraft.raw_text`
2. Call `onSendCompose(text)` — implementation in parent (task-040): drops text into compose bar via `composeBarRef.appendText(text, { focus: true })`; appends `send_to_terminal` event with `mode: 'compose'`
3. Animate green flash + `✓ Sent to terminal` overlay on card
4. Show toast: `✓ Sent to terminal — review and press Enter` (top of advisor panel)
5. Card collapses out of chat (animate height 0 over ~200ms)

Send and execute click:
1. Compute final text
2. Call `onSendDirect(text)` — parent uses Flowt's existing PTY sequencing (same code path as InputBar's image-attach send: split lines on `\n`, write each via `pty:write` with 150ms inter-line delay, final `\r` after last line)
3. Append `send_to_terminal` event with `mode: 'direct'`
4. Animate **amber** flash + `⚡ Sent and executed` overlay (distinct color from compose path)
5. Show toast: `⚡ Sent and executed in <activeExecutorTabName>` (top of advisor panel)
6. Card collapses

✕ click:
1. Append `discard_draft` event with `reason: 'user_x'`
2. Card collapses without flash

The Pencil designs don't show flash overlays or toasts — per spec §13, default to matching closest existing Flowt notification/toast styling if a custom pattern needs invention. Surface as question if uncertain.

### Feedback

### Comments

---

## Wire Draft button + replace-draft confirm modal

**Status:** todo
**Category:** Phase 3
**ID:** task-040

Modify `src/renderer/components/panels/AdvisorPanel.tsx` to make the `Draft Message to CC` button functional (was placeholder/disabled in P1 task-021).

Button enabled when state ∈ {IDLE, DRAFT_READY}. Disabled in INITIALIZING / THINKING / STALE / ERROR_*. Tooltip: `Draft Message to CC` (no shortcut yet; could add later if requested).

On click:

1. **If `pendingDraft?.state === 'DRAFT_READY'`** (existing draft in chat):
   - Show confirm modal with copy from spec §4 Flow 4.2:
     - Title: `Replace the current draft?`
     - Body: `You have a draft pending. Asking the advisor for a new one will discard it.`
     - Buttons: `[Cancel]` / `[Replace]`
   - On Cancel: dismiss modal, no-op
   - On Replace: append `discard_draft` event with `reason: 'user_replace'`; clear pendingDraft in local state; proceed to step 2

2. **Trigger draft request**:
   - Call `useAdvisor.sendMessage('', 'draft_request')` — the empty string is replaced with the locked template by advisor-manager (task-038)
   - Hook transitions state to THINKING; replayEvents auto-renders synthetic system bubble per task-008

3. **On response**:
   - If draft_produced event → AdvisorDraftCard renders below the latest advisor bubble (replayer + chat list integrate)
   - If draft_parse_fail event → renderer shows inline subhint below the advisor bubble: `This response wasn't formatted as a draft — try clicking Draft Message to CC again or rephrase.` (per spec §4 Flow 4.3 alt)

Replace-draft confirm modal styling NOT in Pencil designs — match closest existing Flowt modal pattern (e.g., the existing terminal tab close confirmation per CLAUDE.md). Don't block on visual nits per planning Step 4 confirmation.

Also wire the draft card's onSendCompose / onSendDirect callbacks into AdvisorPanel:
- `onSendCompose(text)`: get reference to active terminal tab's InputBar via existing ref pattern from Tasks panel; call `composeBarRef.appendText(text, { focus: true })`; call `useAdvisor.appendLog({ type: 'send_to_terminal', ts, final_text: text, mode: 'compose' })`; clear pendingDraft via local state
- `onSendDirect(text)`: call `window.vibeAPI.pty.write(activeExecutorTabId, ...)` using existing line-sequencing pattern (split on `\n`, 150ms delays, final `\r`); call `useAdvisor.appendLog({ type: 'send_to_terminal', ts, final_text: text, mode: 'direct' })`; clear pendingDraft

### Feedback

### Comments

---

## Manual test — draft loop

**Status:** todo
**Category:** Phase 3
**ID:** task-041

Manual verification checklist after Phase 3 implementation. Run before tagging Phase 3 complete.

**Setup:**
1. `npx tsc --noEmit` clean; `npm test` all 6 unit test files green (P1's 4 + cc-turns-watcher + draft-parser); `npm start`

**Draft happy path:**
2. In advisor panel with active session (from P1/P2), have a brief conversation about a coding task (e.g., "Suggest a refactor for the foo module")
3. Click `Draft Message to CC` button → dimmed system bubble appears (synthetic via replayer per task-008): `Asking advisor to draft the executor message…`
4. Thinking placeholder appears below; advisor returns response with delimiters → DraftCard renders below the advisor bubble
5. Verify card matches Pencil Y9qIXO design: header with title and ✕, body with markdown content, footer with char count and two buttons
6. Verify advisor's preamble (the prose before delimiters) shows as a normal advisor bubble; the inner content shows in the card

**Draft edit:**
7. Click on card body → swap to editable textarea pre-filled with markdown source
8. Modify text (add/remove/change a line); click Done OR press Cmd+Enter
9. Verify primary button label changed to `Send Edited Draft to Terminal`; secondary to `Send Edited and Execute`
10. Verify advisor-logs has `draft_edited` event with before/after fields capturing the change

**Compose-bar send:**
11. Click `Send Edited Draft to Terminal` → green flash on card; `✓ Sent to terminal` overlay; card collapses
12. Toast appears at top of advisor panel: `✓ Sent to terminal — review and press Enter`
13. Verify the active terminal tab's compose bar is populated with the edited text and focused
14. Press Enter manually → executor CC receives the message and begins working
15. Verify advisor-logs has `send_to_terminal` event with `mode: 'compose'` and `final_text` matching what was sent

**Direct send:**
16. Trigger another draft (Draft Message to CC); accept advisor's response without editing
17. Click `Send and execute` (secondary outline button) → amber flash + `⚡ Sent and executed` overlay; card collapses
18. Toast: `⚡ Sent and executed in <terminal-tab-name>`
19. Verify executor terminal shows the message submitted (line-by-line if multi-line) and CC begins working WITHOUT the founder pressing Enter
20. Verify advisor-logs has `send_to_terminal` event with `mode: 'direct'`

**Discard:**
21. Trigger another draft; click ✕ on card → card collapses
22. Verify advisor-logs has `discard_draft` event with `reason: 'user_x'`

**Replace draft:**
23. Trigger draft (DRAFT_READY); WITHOUT sending or discarding, click `Draft Message to CC` again → confirm modal appears
24. Click Replace → existing draft discarded with `reason: 'user_replace'`; new draft request sent
25. Click Cancel on the modal in another iteration → dismisses without effect

**Parse fail:**
26. Force a parse fail by writing a custom `<cwd>/.flowt/advisor.md` that explicitly tells the advisor to NOT use delimiters (e.g., "When asked to draft, just write plain text without any markers."). Note: the footer is non-overrideable per spec §6.4, so this might still produce a draft — but the advisor may interpret the override as conflicting and produce text without delimiters. Trigger Draft → if parse fail occurs, verify inline subhint below advisor bubble: `This response wasn't formatted as a draft — try clicking Draft Message to CC again or rephrase.`
27. Verify advisor-logs has `draft_parse_fail` event with `raw_response` field

**Multi-line draft direct send:**
28. Trigger a draft that produces multi-line output (e.g., ask for a code block + explanation)
29. Click Send and execute → verify each line written to PTY with 150ms delay; final `\r` after last line; CC processes correctly without breakage

All steps must pass before task-041 is marked done and Phase 3 is complete.

### Feedback

### Comments

---

## ERROR_INIT and ERROR_TURN categorization in advisor-manager

**Status:** todo
**Category:** Phase 4
**ID:** task-042

Refine the error categorization logic in `src/main/advisor-manager.ts` `sendMessage` method (already partially built in P1 task-011 — extending with renderer-visible categorization).

State machine extensions:
- Add tracking for `consecutive_errors` per session (already in AdvisorSessionMemory)
- On error_turn event: increment counter; if ≥ 3 → append `session_stale` event with `consecutive_errors` count, transition state to STALE
- On successful advisor_response: reset `consecutive_errors` to 0
- On error_init: do NOT increment `consecutive_errors` (init errors are categorically different — they don't accumulate to STALE)

Categorization (already in P1 task-011, hardening here):
- Exit code 127 OR stderr matches `/command not found|claude:.*not.*found/i` → `error_kind: 'binary_missing'` (returns `categorized_message: 'Claude Code CLI is not installed.'`)
- stderr matches `/not authenticated|no active session|claude login|please run.*login/i` → `'not_authed'` (`'Run claude login in any terminal to authenticate.'`)
- stdout unparseable as JSON → `'malformed_json'` (`'Couldn't parse advisor response: <first 200 chars of stderr>'`)
- envelope `is_error: true` AND `result` mentions "hook" → `'hook_blocked'` (`'A hook blocked the advisor's action: <details>'`)
- else → `'other'` (`'Couldn't reach advisor: <stderr first 200 chars>'`)

Return value extends with `categorized_message: string` field for renderer to display in error banner without re-categorizing.

State transitions emitted via IPC `advisor:state-change` channel? — actually this isn't in the spec channel list. State changes are derived in the renderer from `useAdvisor` state + send-message return. No new channel needed; just ensure the response shape is rich enough.

### Feedback

### Comments

---

## Build AdvisorStaleBanner.tsx

**Status:** todo
**Category:** Phase 4
**ID:** task-043

Create `src/renderer/components/panels/AdvisorStaleBanner.tsx`. Warning-style banner matching Pencil node `a6zq8` ("Advisor — Banner Warning Unresponsive"). Per Pencil `warnBanner` frame: alignItems center, fill `#F59E0B10` (amber at 10% alpha), gap 8, padding 10/16, stroke `#F59E0B30` thickness 1 bottom-only.

Copy from spec §4 cross-cutting reference: `⚠ Advisor is unresponsive. [Restart Advisor]`

Behavior:
- Persistent — does NOT auto-dismiss, no manual X button
- Renders only when `state === 'STALE'`
- `[Restart Advisor]` button click triggers task-046's restart flow
- Position: directly under panelHeader, above chatArea (per Pencil layout)
- Use `--accent-yellow` token for the icon/border accent

Props: `{ onRestart: () => void }` — parent (AdvisorPanel) wires to useAdvisor's restart action.

### Feedback

### Comments

---

## Build AdvisorHooksRemovedBanner.tsx

**Status:** todo
**Category:** Phase 4
**ID:** task-044

Create `src/renderer/components/panels/AdvisorHooksRemovedBanner.tsx`. Warning-style banner matching Pencil node `ODJMM` ("Advisor — Banner Hooks Removed"). Per Pencil `warnBannerHooks` frame: layout vertical, fill `#F59E0B10` (same amber tint as STALE banner), gap 8, padding 10/16, stroke `#F59E0B30` thickness 1 bottom-only.

Copy from spec §4 cross-cutting reference (multi-line):
```
⚠ Advisor hooks were removed from .claude/settings.json.

Send to Advisor and the sandbox enforcement won't work until hooks are reinstalled.

[Re-install hooks] [Disable Advisor for this project]
```

Behavior:
- Renders when `is_scaffolded && !hooks_installed` from hydrate response (added in task-047)
- Compose box, Send to Advisor button (in terminal), Draft button, and Reset button all disabled while banner active
- `[Re-install hooks]` click → call `useAdvisor.approveConsent()` (which calls scaffold — idempotent; replaces `_flowt_managed` entries cleanly)
- `[Disable Advisor for this project]` click → call `useAdvisor.skipConsent()` (writes `_advisor_disabled` flag, panel switches to disabled empty state)
- Position: directly under panelHeader, above chatArea

Props: `{ onReinstall: () => void; onDisable: () => void }`.

### Feedback

### Comments

---

## Process-killed recovery toast on hydrate

**Status:** todo
**Category:** Phase 4
**ID:** task-045

In `src/main/advisor-manager.ts` `hydrate` method (extending P1 task-011 logic):

1. After reading the active log file, check if `ended_at === null`. If yes:
   - The previous Flowt session was killed mid-conversation
   - Append `process_killed` event with `recovered_at_open: true`
   - Hydrate state to IDLE (THINKING is unrecoverable — child process is dead)
   - Track in advisor-state.json a flag `recovery_toast_shown: true` (add to AdvisorState schema if not already; otherwise track in in-memory session state)

2. In the response, include a `show_recovery_toast: boolean` field:
   - true on first hydrate after killed session (when `recovery_toast_shown` was false in advisor-state)
   - false on subsequent hydrates (already shown)

3. Renderer-side (`useAdvisor` and `AdvisorPanel`): when hydrate returns `show_recovery_toast: true`, display a one-shot toast at top of panel: `Last advisor session was interrupted. Conversation restored.` Auto-dismiss after 5 seconds. Only show once.

This catches the scenario where Flowt was force-quit during THINKING state — log file has events but no `ended_at`. Recovery is "best effort": chat is replayable; state hydrates to IDLE; founder can continue.

### Feedback

### Comments

---

## Restart Advisor flow (state transition + log lifecycle)

**Status:** todo
**Category:** Phase 4
**ID:** task-046

Implement the STALE → INITIALIZING transition in `src/main/advisor-manager.ts`. Triggered when `[Restart Advisor]` in AdvisorStaleBanner is clicked.

Add new IPC handler `IPC.ADVISOR_RESTART_FROM_STALE` (extends the channel list) OR reuse `advisor:reset` if behavior is identical. Per spec §3 STALE → INITIALIZING vs STALE → NO_SESSION distinction:
- Reset goes to NO_SESSION (founder explicitly clearing)
- Restart Advisor goes to INITIALIZING (founder wants to start a fresh attempt with same conversation context lost — generates new session_id)

For implementation simplicity in v1: Restart Advisor shares the same code path as Reset (both finalize log + clear pointer + transition NO_SESSION). The behavioral distinction is only in `ended_via`:
- Reset: `ended_via: 'reset'`
- Restart Advisor: `ended_via: 'stale_restart'`

Method: add `restartFromStale(cwd: string): Promise<{ ok: true }>` to AdvisorManager:
1. Append final event to current log (if not already finalized)
2. Call `finalizeLog(cwd, 'stale_restart')`
3. Clear advisor-state.json `active_session_id`, `active_log_file`, `started_at`, `model` to null
4. Mark in-memory state NO_SESSION + reset `consecutive_errors` to 0
5. Renderer receives state update; AdvisorPanel re-renders empty welcome state until next founder message starts a fresh session

Add IPC channel `ADVISOR_RESTART_FROM_STALE = 'advisor:restart-from-stale'` to ipc-channels.ts; register handler; expose via preload as `vibeAPI.advisor.restartFromStale(cwd)`.

`useAdvisor` exposes `restartFromStale()` method called by AdvisorStaleBanner's onRestart handler.

### Feedback

### Comments

---

## Hooks-installed verification on hydrate

**Status:** todo
**Category:** Phase 4
**ID:** task-047

Already wired in P1 task-011 (`hydrate` calls `verifyHooksInstalled` from advisor-scaffolder per task-006). Confirm in P4:

1. Verify the `hooks_installed: boolean` field is correctly populated in the `advisor:hydrate` response shape
2. AdvisorPanel receives `hooks_installed` from `useAdvisor`
3. When `is_scaffolded && !hooks_installed`, render `<AdvisorHooksRemovedBanner ... />` (task-044) at top of panel
4. Compose box, Send to Advisor button, Draft button, Reset button all disabled while banner active

Manual test for this task:
- Scaffold a project (P1 happy path)
- In a terminal: `jq 'del(.hooks.PreToolUse, .hooks.Stop)' .claude/settings.json | sponge .claude/settings.json` (or use temp file + mv if `sponge` not available)
- Reload Flowt OR navigate away and back to project tab
- Hydrate fires; `hooks_installed: false` returned
- Banner renders matching Pencil ODJMM design
- Click Re-install → banner disappears, hooks restored, settings.json has both `_flowt_managed` entries again
- Force banner again; click Disable → `_advisor_disabled` flag written, panel switches to disabled empty state

### Feedback

### Comments

---

## Optional — shell.openPath log inspection (cut if non-trivial)

**Status:** todo
**Category:** Phase 4
**ID:** task-048

Per spec §8.3 — implement ONLY if it's a literal one-line `shell.openPath` call. If implementation requires non-trivial wiring (new permissions, custom UI, edge case handling beyond a single line), CUT this task entirely.

Attempt the minimal version first:

1. Extend `vibeAPI.shell` namespace in `src/preload/index.ts` (if exists) or create it:
   ```ts
   shell: {
     openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path)
   }
   ```
2. In main process: register `ipcMain.handle('shell:open-path', (_e, path) => electron.shell.openPath(path))`
3. In `AdvisorPanel.tsx` header: add a dropdown menu item or icon button: `Show session log file` → calls `vibeAPI.shell.openPath(activeAdvisorState.active_log_file_path)`

If any of these require unexpected complexity (e.g., the dropdown menu component doesn't exist and needs to be built from scratch with state management for open/close), STOP and cut the task. Defer to v1.x.

Decide during implementation. Document the decision in this task's Comments.

### Feedback

### Comments

---

## End-to-end Phase 4 manual test

**Status:** todo
**Category:** Phase 4
**ID:** task-049

Manual verification checklist after Phase 4 implementation. Run before tagging Phase 4 / MVP complete.

**Setup:**
1. `npx tsc --noEmit` clean; `npm test` all 6 unit test files green; `npm start`

**ERROR_INIT — binary missing:**
2. Temporarily rename or move the `claude` binary (e.g., `mv $(which claude) ~/claude.bak`)
3. In Flowt: send a new message in advisor → ERROR_INIT banner appears with categorized message: `Claude Code CLI is not installed.` + Retry button
4. Restore binary; click Retry → banner dismisses, message sends successfully

**ERROR_INIT — not authed:**
5. Mock `not_authed` by either: (a) clearing `~/.claude/credentials.json` temporarily, or (b) crafting a `claude` wrapper script that returns "not authenticated" stderr; place the wrapper in PATH
6. Send message → banner with `Run claude login in any terminal to authenticate.` message
7. Restore credentials; Retry succeeds

**ERROR_TURN → STALE:**
8. Force 3 consecutive error_turns. Easiest: temporarily corrupt `.claude/settings.json` so Stop hook fails on every turn, OR drop network connectivity. After 3 fails:
9. STALE banner appears matching Pencil a6zq8 (`⚠ Advisor is unresponsive. [Restart Advisor]`)
10. Click `[Restart Advisor]` → log finalized with `ended_via: 'stale_restart'`; new session starts; banner disappears

**Hooks-removed recovery:**
11. With advisor scaffolded and working, in terminal: `jq 'del(.hooks.PreToolUse, .hooks.Stop)' .claude/settings.json | sponge .claude/settings.json` (or temp file + mv)
12. Click Advisor tab in Flowt → AdvisorHooksRemovedBanner appears matching Pencil ODJMM
13. Click `[Re-install hooks]` → banner disappears; verify `.claude/settings.json` has both `_flowt_managed: true` entries restored
14. Force banner again; click `[Disable Advisor for this project]` → `_advisor_disabled` flag written; panel switches to disabled empty state with `[Enable Advisor]` button

**Process-killed recovery:**
15. Have an active conversation with several turns; mid-conversation, force-quit Flowt (Cmd+Q while a `THINKING` spinner is visible if possible)
16. Reopen Flowt; navigate to project → recovery toast appears once: `Last advisor session was interrupted. Conversation restored.` Chat replays from log up to last `advisor_response`
17. Send another message → conversation continues normally (state hydrated to IDLE, --resume used)
18. Quit and reopen Flowt again → toast does NOT appear (already shown for that recovery)

**Optional shell.openPath (if implemented per task-048):**
19. Click `Show session log file` in advisor panel → log JSON opens in OS default viewer (e.g., VS Code, BBEdit). If task-048 was cut, skip this step and document in task notes

**All event types in logs (final §18 success criterion):**
20. `cat .flowt/advisor-logs/<latest>.json | jq '[.events[].type] | unique'` should show a comprehensive set of event types accumulated across the testing — minimum: `founder_message, advisor_response, send_to_advisor, draft_cc_clicked, draft_produced, draft_edited, send_to_terminal, discard_draft, error_init OR error_turn, session_stale, process_killed`. Plus any `attribution_ambiguous` from P2 testing
21. Verify each event has a non-null `ts` field with valid ISO 8601 UTC format

**Build & ship:**
22. `npm run make -- --targets @electron-forge/maker-dmg` → DMG built successfully
23. Install DMG fresh on a test machine (or launchd-restart) → all features work end-to-end

All steps must pass before task-049 is marked done and the MVP is complete.

### Feedback

### Comments

---

## /copy clipboard fallback (advisor:extract-cc-turn-fallback) — v1.1

**Status:** idea
**Category:** Ideas
**ID:** task-050

Re-introduce the `/copy` clipboard-poll fallback channel per spec §9.2 IF real-world v1 usage shows `extract_failed` events > ~3/week per active founder.

Implementation reference: the locked Phase 2 design (now superseded for v1) — PTY write blocking via `writeBlocked: Map<tabId, boolean>` in PtyManager, clipboard polling 100ms × 20 with menu-confirm at 800ms, 2s timeout. Adds back `advisor:extract-cc-turn-fallback` IPC channel.

Trigger condition: telemetry from `extract_failed` events in advisor-logs across active projects shows the rate exceeding ~3/week. Until that signal appears, the diagnosable toast (`No CC turn captured. If you started Claude Code before enabling the advisor, restart it...`) is sufficient.

### Feedback

### Comments

---

## Streaming advisor responses — v1.1

**Status:** idea
**Category:** Ideas
**ID:** task-051

Switch from `--output-format=json` (one-shot per turn) to `--output-format=stream-json` for advisor responses, with progressive token rendering in the chat panel.

Trigger condition: founder reports the wait feels laggy on long advisor responses (≥30s wall clock observed regularly).

Implementation impact:
- `advisor-manager.sendMessage` parses streaming JSON Lines from stdout instead of one envelope
- Progressive event emission to renderer (new IPC channel for streaming chunks)
- AdvisorMessageBubble updates incrementally as tokens arrive
- Existing one-shot logic stays as fallback if streaming fails

### Feedback

### Comments

---

## Sandbox files view in advisor panel — v1.1

**Status:** idea
**Category:** Ideas
**ID:** task-052

Add a collapsible "Files" section in `AdvisorPanel.tsx` listing contents of `<cwd>/.flowt/advisor-output/`. Click a file → `vibeAPI.shell.openPath` (if task-048 was implemented; else add via this task).

Trigger condition: founder produces enough sandbox artifacts (specs, planning docs, MDs in advisor-output) that finding them becomes friction.

Implementation:
- File listing via chokidar watcher on `.flowt/advisor-output/`
- Renderer component with expand/collapse
- File click handler

### Feedback

### Comments

---

## Multi-session attribution tightening — v1.1

**Status:** idea
**Category:** Ideas
**ID:** task-053

Tighten the sub-second concurrent CC spawn race in `cc-turns-watcher.ts` (task-026). Trigger condition: `attribution_ambiguous` events appear in logs > ~5 times/month per active founder.

Possible approaches (research during build):
- Per-tab session-id heartbeat protocol: each Flowt-spawned `claude` periodically writes a heartbeat file naming itself, allowing back-resolution
- OSC tab-source tagging emitted by CC itself (requires Anthropic to add this)
- Staggered spawn detection using PTY data signatures: examine the first ~500ms of CC TUI output, which contains session-specific markers, to disambiguate
- Hooks with session_id attribution natively (would obviate the entire observation algorithm — see spec §2 migration path)

### Feedback

### Comments

---

## Reset advisor.md to default button — v1.1

**Status:** idea
**Category:** Ideas
**ID:** task-054

Add a "Reset to default" button in advisor panel (next to Reset Advisor) that overwrites `<cwd>/.flowt/advisor.md` with the locked default body from `advisor-prompt-builder.ts`.

Trigger condition: founder reports breaking their own advisor.md (e.g., footer-blocking persona, broken instructions) and explicitly requests a recovery path. Trivial implementation when triggered: read `DEFAULT_ADVISOR_PROMPT_BODY` constant, write to file, atomic temp+rename.

### Feedback

### Comments

---

## Power-user settings (log dir, model pin) — v1.x

**Status:** idea
**Category:** Ideas
**ID:** task-055

If founders request: surface `FLOWT_ADVISOR_LOG_DIR` and `FLOWT_ADVISOR_MODEL` (or others) as settings panel toggles in Flowt's settings UI, NOT as env vars (per spec §10).

Implementation:
- Add settings panel section "Advisor"
- Persist via electron-store (existing Flowt pattern for global prefs)
- Pass through to `advisor-manager.sendMessage` as `--model <name>` flag (if model pinning) or as the log directory base path (if log dir override)

Trigger condition: explicit founder request, not speculative.

### Feedback

### Comments

---
