import { ipcMain, BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '../shared/ipc-channels';
import { PtyManager } from './pty-manager';
import { PreviewManager } from './preview-manager';
import { CdpLogger } from './cdp-logger';
import { FileWatcher } from './file-watcher';
import { ClaudeView } from './claude-view';
import { DevicePreset, PreviewBounds } from '../shared/types';
import Store from 'electron-store';

const store = new Store() as any;
let verboseIdCounter = 0;

function emitVerbose(window: BrowserWindow, message: string): void {
  if (window.isDestroyed()) return;
  window.webContents.send(IPC.LOG_ENTRY, {
    id: `verbose-${++verboseIdCounter}`,
    type: 'verbose',
    message,
    timestamp: Date.now(),
  });
}

export function registerIpcHandlers(
  window: BrowserWindow,
  ptyManager: PtyManager,
  previewManager: PreviewManager,
  cdpLogger: CdpLogger,
  fileWatcher: FileWatcher,
  claudeView: ClaudeView,
): void {
  // PTY
  ipcMain.handle(IPC.PTY_CREATE, (_event, tabId: string, cwd?: string) => {
    if (typeof tabId !== 'string' || !tabId) throw new Error('Invalid tabId');
    if (cwd !== undefined && typeof cwd !== 'string') throw new Error('Invalid cwd');
    emitVerbose(window, `PTY created: ${tabId} (cwd: ${cwd || 'default'})`);
    return ptyManager.create(tabId, cwd);
  });

  ipcMain.on(IPC.PTY_WRITE, (_event, tabId: string, data: string) => {
    if (typeof tabId !== 'string' || typeof data !== 'string') return;
    ptyManager.write(tabId, data);
  });

  ipcMain.on(IPC.PTY_RESIZE, (_event, tabId: string, cols: number, rows: number) => {
    ptyManager.resize(tabId, cols, rows);
  });

  ipcMain.on(IPC.PTY_DESTROY, (_event, tabId: string) => {
    emitVerbose(window, `PTY destroyed: ${tabId}`);
    ptyManager.destroy(tabId);
  });

  // Preview
  ipcMain.on(IPC.PREVIEW_SET_BOUNDS, (_event, bounds: PreviewBounds) => {
    if (bounds.width === 0 && bounds.height === 0) {
      previewManager.hide();
    } else {
      previewManager.show();
    }
  });

  ipcMain.on(IPC.PREVIEW_SYNC_LAYOUT, (_event, rightPanelWidth: number, headerHeight: number, footerHeight: number) => {
    previewManager.syncLayout(rightPanelWidth, headerHeight, footerHeight);
  });

  ipcMain.handle(IPC.PREVIEW_NAVIGATE, (_event, url: string) => {
    if (!previewManager.getView()) {
      emitVerbose(window, `Preview: creating WebContentsView`);
      previewManager.create();
      emitVerbose(window, `Preview: attaching CDP logger (background)`);
      cdpLogger.attach().then(() => {
        emitVerbose(window, `Preview: CDP attached`);
      }).catch(() => {
        emitVerbose(window, `Preview: CDP attach failed`);
      });
    }
    emitVerbose(window, `Preview: navigating to ${url}`);
    previewManager.navigate(url);
  });

  ipcMain.on(IPC.PREVIEW_GO_BACK, () => {
    emitVerbose(window, `Preview: go back`);
    const view = previewManager.getView();
    if (view?.webContents.canGoBack()) view.webContents.goBack();
  });

  ipcMain.on(IPC.PREVIEW_RELOAD, () => {
    emitVerbose(window, `Preview: reload`);
    const view = previewManager.getView();
    view?.webContents.reload();
  });

  ipcMain.on(IPC.PREVIEW_SET_DEVICE, (_event, preset: DevicePreset | null) => {
    emitVerbose(window, `Preview: device ${preset ? preset.name + ' (' + preset.width + 'x' + preset.height + ')' : 'responsive'}`);
    previewManager.setDeviceEmulation(preset);
  });

  // Logs
  ipcMain.handle(IPC.LOG_GET_RESPONSE_BODY, async (_event, requestId: string) => {
    return cdpLogger.getResponseBody(requestId);
  });

  // Notes
  ipcMain.handle(IPC.NOTES_LOAD, () => {
    return store.get('notes', '') as string;
  });

  // Checklists
  ipcMain.handle(IPC.CHECKLISTS_LOAD, () => {
    return store.get('checklists', '[]') as string;
  });

  ipcMain.on(IPC.CHECKLISTS_SAVE, (_event, data: string) => {
    store.set('checklists', data);
  });

  ipcMain.on(IPC.NOTES_SAVE, (_event, content: string) => {
    store.set('notes', content);
  });

  // Markdown files
  ipcMain.handle(IPC.MD_FILES_LIST, async () => {
    return fileWatcher.listFiles();
  });

  ipcMain.handle(IPC.MD_FILES_READ, async (_event, filePath: string) => {
    return fileWatcher.readFile(filePath);
  });

  ipcMain.handle(IPC.MD_FILES_WATCH, async (_event, cwd: string) => {
    await fileWatcher.watch(cwd);
    return true;
  });

  // App
  ipcMain.handle(IPC.APP_GET_CWD, (_event, tabId?: string) => {
    if (tabId) {
      return ptyManager.getCwd(tabId);
    }
    // Fallback: try first PTY
    return process.cwd();
  });

  ipcMain.handle(IPC.APP_CAPTURE_PAGE, async () => {
    const image = await window.webContents.capturePage();
    return image.toDataURL();
  });

  ipcMain.handle(IPC.PREVIEW_CAPTURE, async () => {
    emitVerbose(window, `Preview: capturing screenshot`);
    const view = previewManager.getView();
    if (!view) return null;
    const image = await view.webContents.capturePage();
    return image.toDataURL();
  });

  ipcMain.handle(IPC.APP_SAVE_TEMP_IMAGE, async (_event, dataUrl: string, tabId?: string) => {
    // Limit image size to 50MB to prevent resource exhaustion
    const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
    if (!dataUrl || dataUrl.length > MAX_IMAGE_SIZE) {
      throw new Error('Image too large or empty');
    }
    // Save in project folder if we can detect it, otherwise fall back to temp
    let baseDir: string;
    if (tabId) {
      try {
        baseDir = ptyManager.getCwd(tabId);
      } catch {
        baseDir = app.getPath('temp');
      }
    } else {
      baseDir = app.getPath('temp');
    }

    const screenshotsDir = path.join(baseDir, '.flowt');
    await fs.promises.mkdir(screenshotsDir, { recursive: true });
    const filename = `screenshot-${Date.now()}.png`;
    const filePath = path.join(screenshotsDir, filename);

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));
    emitVerbose(window, `Screenshot saved: ${filePath}`);
    return filePath;
  });

  // Claude webview
  ipcMain.on(IPC.CLAUDE_SHOW, (_event, bounds: PreviewBounds) => {
    emitVerbose(window, `Claude: show (${bounds.width}x${bounds.height})`);
    claudeView.show(bounds);
  });

  ipcMain.on(IPC.CLAUDE_HIDE, () => {
    claudeView.hide();
  });

  ipcMain.on(IPC.CLAUDE_RELOAD, () => {
    claudeView.reload();
  });

  ipcMain.on(IPC.CLAUDE_SET_BOUNDS, (_event, bounds: PreviewBounds) => {
    claudeView.setBounds(bounds);
  });
}
