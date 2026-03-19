// Single source of truth for all IPC channel names

export const IPC = {
  // PTY
  PTY_CREATE: 'pty:create',
  PTY_DATA: 'pty:data',
  PTY_WRITE: 'pty:write',
  PTY_RESIZE: 'pty:resize',
  PTY_DESTROY: 'pty:destroy',
  PTY_EXIT: 'pty:exit',

  // Preview
  PREVIEW_NAVIGATE: 'preview:navigate',
  PREVIEW_SET_BOUNDS: 'preview:set-bounds',
  PREVIEW_SET_DEVICE: 'preview:set-device',
  PREVIEW_STATUS: 'preview:status',
  PREVIEW_URL_CHANGED: 'preview:url-changed',

  // Port / Route detection
  PORT_DETECTED: 'port:detected',
  ROUTE_DETECTED: 'route:detected',

  // Prompt detection
  PROMPT_DETECTED: 'prompt:detected',

  // Logs
  LOG_ENTRY: 'log:entry',
  LOG_CLEAR: 'log:clear',
  LOG_GET_RESPONSE_BODY: 'log:get-response-body',

  // Notes
  NOTES_LOAD: 'notes:load',
  NOTES_SAVE: 'notes:save',

  // Markdown files
  MD_FILES_LIST: 'md:list',
  MD_FILES_READ: 'md:read',
  MD_FILES_CHANGED: 'md:changed',
  MD_FILES_WATCH: 'md:watch',

  // App
  APP_GET_CWD: 'app:get-cwd',
  APP_CAPTURE_PAGE: 'app:capture-page',
  APP_SAVE_TEMP_IMAGE: 'app:save-temp-image',
  PREVIEW_CAPTURE: 'preview:capture',
  PREVIEW_SYNC_LAYOUT: 'preview:sync-layout',
  PREVIEW_GO_BACK: 'preview:go-back',
  PREVIEW_RELOAD: 'preview:reload',

  // Claude webview
  CLAUDE_SET_BOUNDS: 'claude:set-bounds',
  CLAUDE_SHOW: 'claude:show',
  CLAUDE_HIDE: 'claude:hide',
  CLAUDE_RELOAD: 'claude:reload',

  // Checklists
  CHECKLISTS_LOAD: 'checklists:load',
  CHECKLISTS_SAVE: 'checklists:save',
} as const;
