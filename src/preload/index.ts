import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { DevicePreset, PreviewBounds } from '../shared/types';

function on(channel: string, cb: (...args: any[]) => void): () => void {
  ipcRenderer.on(channel, cb);
  return () => { ipcRenderer.removeListener(channel, cb); };
}

const vibeAPI = {
  pty: {
    create: (tabId: string, cwd?: string) => ipcRenderer.invoke(IPC.PTY_CREATE, tabId, cwd),
    write: (tabId: string, data: string) => ipcRenderer.send(IPC.PTY_WRITE, tabId, data),
    resize: (tabId: string, cols: number, rows: number) => ipcRenderer.send(IPC.PTY_RESIZE, tabId, cols, rows),
    destroy: (tabId: string) => ipcRenderer.send(IPC.PTY_DESTROY, tabId),
    onData: (cb: (tabId: string, data: string) => void) =>
      on(IPC.PTY_DATA, (_e: any, tabId: string, data: string) => cb(tabId, data)),
    onExit: (cb: (tabId: string, exitCode: number) => void) =>
      on(IPC.PTY_EXIT, (_e: any, tabId: string, exitCode: number) => cb(tabId, exitCode)),
  },

  preview: {
    navigate: (url: string) => ipcRenderer.invoke(IPC.PREVIEW_NAVIGATE, url),
    capture: () => ipcRenderer.invoke(IPC.PREVIEW_CAPTURE) as Promise<string | null>,
    setBounds: (bounds: PreviewBounds) => ipcRenderer.send(IPC.PREVIEW_SET_BOUNDS, bounds),
    syncLayout: (rightPanelWidth: number, headerHeight: number, footerHeight: number) => ipcRenderer.send(IPC.PREVIEW_SYNC_LAYOUT, rightPanelWidth, headerHeight, footerHeight),
    goBack: () => ipcRenderer.send(IPC.PREVIEW_GO_BACK),
    reload: () => ipcRenderer.send(IPC.PREVIEW_RELOAD),
    setDevice: (preset: DevicePreset | null) => ipcRenderer.send(IPC.PREVIEW_SET_DEVICE, preset),
    onStatus: (cb: (status: string) => void) =>
      on(IPC.PREVIEW_STATUS, (_e: any, status: string) => cb(status)),
    onUrlChanged: (cb: (url: string) => void) =>
      on(IPC.PREVIEW_URL_CHANGED, (_e: any, url: string) => cb(url)),
  },

  port: {
    onDetected: (cb: (detection: { port: number; url: string; framework?: string }) => void) =>
      on(IPC.PORT_DETECTED, (_e: any, d: any) => cb(d)),
  },

  route: {
    onDetected: (cb: (detection: { route: string; filePath: string; framework: string }) => void) =>
      on(IPC.ROUTE_DETECTED, (_e: any, d: any) => cb(d)),
  },

  prompt: {
    onDetected: (cb: (detection: { tabId: string; options: string[]; rawText: string }) => void) =>
      on(IPC.PROMPT_DETECTED, (_e: any, d: any) => cb(d)),
  },

  logs: {
    onEntry: (cb: (entry: any) => void) =>
      on(IPC.LOG_ENTRY, (_e: any, entry: any) => cb(entry)),
    getResponseBody: (requestId: string) => ipcRenderer.invoke(IPC.LOG_GET_RESPONSE_BODY, requestId),
  },

  notes: {
    load: () => ipcRenderer.invoke(IPC.NOTES_LOAD) as Promise<string>,
    save: (content: string) => ipcRenderer.send(IPC.NOTES_SAVE, content),
  },

  checklists: {
    load: () => ipcRenderer.invoke(IPC.CHECKLISTS_LOAD) as Promise<string>,
    save: (data: string) => ipcRenderer.send(IPC.CHECKLISTS_SAVE, data),
  },

  tasks: {
    load: () => ipcRenderer.invoke(IPC.TASKS_LOAD) as Promise<string>,
    save: (data: string) => ipcRenderer.send(IPC.TASKS_SAVE, data),
  },

  mdFiles: {
    list: () => ipcRenderer.invoke(IPC.MD_FILES_LIST),
    read: (filePath: string) => ipcRenderer.invoke(IPC.MD_FILES_READ, filePath) as Promise<string>,
    watch: (cwd: string) => ipcRenderer.invoke(IPC.MD_FILES_WATCH, cwd),
    onChanged: (cb: (files: any[]) => void) =>
      on(IPC.MD_FILES_CHANGED, (_e: any, files: any[]) => cb(files)),
  },

  app: {
    getCwd: (tabId?: string) => ipcRenderer.invoke(IPC.APP_GET_CWD, tabId) as Promise<string>,
    capturePage: () => ipcRenderer.invoke(IPC.APP_CAPTURE_PAGE) as Promise<string>,
    saveTempImage: (dataUrl: string, tabId?: string) => ipcRenderer.invoke(IPC.APP_SAVE_TEMP_IMAGE, dataUrl, tabId) as Promise<string>,
  },

  claude: {
    show: (bounds: PreviewBounds) => ipcRenderer.send(IPC.CLAUDE_SHOW, bounds),
    hide: () => ipcRenderer.send(IPC.CLAUDE_HIDE),
    setBounds: (bounds: PreviewBounds) => ipcRenderer.send(IPC.CLAUDE_SET_BOUNDS, bounds),
    reload: () => ipcRenderer.send(IPC.CLAUDE_RELOAD),
  },

  menu: {
    onNewTab: (cb: () => void) => on('menu:new-tab', () => cb()),
    onCloseTab: (cb: () => void) => on('menu:close-tab', () => cb()),
    onReloadPreview: (cb: () => void) => on('preview:reload-from-menu', () => cb()),
  },

  terminal: {
    onZoom: (cb: (direction: string) => void) => on('terminal:zoom', (_e: any, dir: string) => cb(dir)),
    onSearch: (cb: () => void) => on('terminal:search', () => cb()),
  },

  ui: {
    onZoom: (cb: (direction: string) => void) => on('ui:zoom', (_e: any, dir: string) => cb(dir)),
  },

  window: {
    onFullscreenChanged: (cb: (isFullscreen: boolean) => void) =>
      on('fullscreen-changed', (_e: any, isFullscreen: boolean) => cb(isFullscreen)),
  },
};

export type VibeAPI = typeof vibeAPI;

contextBridge.exposeInMainWorld('vibeAPI', vibeAPI);
