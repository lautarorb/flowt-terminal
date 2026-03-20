import { app, BrowserWindow, nativeImage, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { PtyManager } from './pty-manager';
import { PreviewManager } from './preview-manager';
import { CdpLogger } from './cdp-logger';
import { FileWatcher } from './file-watcher';
import { ClaudeView } from './claude-view';
import { buildMenu } from './menu';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

app.setName('VibeTerminal');

// Fix $PATH for macOS GUI apps
const fixPath = async () => {
  try {
    const mod = await import('fix-path');
    const fn = mod.default || mod;
    if (typeof fn === 'function') fn();
  } catch {
    // fix-path is optional
  }
};

let mainWindow: BrowserWindow | null = null;
let ptyManager: PtyManager;
let previewManager: PreviewManager;
let cdpLogger: CdpLogger;
let fileWatcher: FileWatcher;
let claudeView: ClaudeView;

const createWindow = (): void => {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#0A0A0A',
    icon: path.join(__dirname, '../../assets/icons/icon.icns'),
    show: false,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  ptyManager = new PtyManager(mainWindow);
  previewManager = new PreviewManager(mainWindow);
  cdpLogger = new CdpLogger(mainWindow, previewManager);
  fileWatcher = new FileWatcher(mainWindow);
  claudeView = new ClaudeView(mainWindow);

  registerIpcHandlers(mainWindow, ptyManager, previewManager, cdpLogger, fileWatcher, claudeView);
  buildMenu(mainWindow);

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow?.isDestroyed()) {
      mainWindow?.webContents.send('fullscreen-changed', mainWindow.isFullScreen());
    }
  });

  mainWindow.on('enter-full-screen', () => {
    if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send('fullscreen-changed', true);
  });
  mainWindow.on('leave-full-screen', () => {
    if (!mainWindow?.isDestroyed()) mainWindow?.webContents.send('fullscreen-changed', false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    ptyManager.destroyAll();
    previewManager.destroy();
    fileWatcher.destroy();
    claudeView.destroy();
  });
};

app.on('ready', async () => {
  await fixPath();

  // Set dock icon in dev mode
  const iconPath = path.join(__dirname, '../../assets/viveterminalicon.png');
  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty() && app.dock) {
      app.dock.setIcon(icon);
    }
  } catch {
    // Icon not found in dev mode, that's ok
  }

  // Check for Full Disk Access — needed so CLI tools can access Desktop, Documents, etc.
  const testPath = path.join(app.getPath('home'), 'Desktop');
  try {
    fs.readdirSync(testPath);
  } catch {
    const result = dialog.showMessageBoxSync({
      type: 'warning',
      title: 'Full Disk Access Required',
      message: 'VibeTerminal needs Full Disk Access to let CLI tools (like Claude Code) access your project folders.',
      detail: 'Go to System Settings → Privacy & Security → Full Disk Access and enable VibeTerminal.',
      buttons: ['Open System Settings', 'Continue Anyway'],
      defaultId: 0,
    });
    if (result === 0) {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
    }
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  ptyManager?.destroyAll();
});
