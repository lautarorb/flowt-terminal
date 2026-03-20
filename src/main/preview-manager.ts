import { BrowserWindow, WebContentsView } from 'electron';
import { DevicePreset } from '../shared/types';
import { IPC } from '../shared/ipc-channels';

export class PreviewManager {
  private view: WebContentsView | null = null;
  private currentUrl = '';
  private currentDevice: DevicePreset | null = null;
  private rightPanelWidth = 400;
  private headerHeight = 80; // tabs + url bar
  private footerHeight = 68; // action buttons + log drawer header (matches InputBar height)
  private hidden = false;

  constructor(private window: BrowserWindow) {
    // Recalculate bounds on window resize
    this.window.on('resize', () => this.updateViewBounds());
  }

  getView(): WebContentsView | null {
    return this.view;
  }

  create(): void {
    if (this.view) return;

    this.view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.window.contentView.addChildView(this.view);
    this.updateViewBounds();

    this.view.webContents.on('did-navigate', (_event, url) => {
      this.currentUrl = url;
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(IPC.PREVIEW_URL_CHANGED, url);
        this.window.webContents.send(IPC.PREVIEW_STATUS, 'loaded');
      }
    });

    this.view.webContents.on('did-navigate-in-page', (_event, url) => {
      this.currentUrl = url;
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(IPC.PREVIEW_URL_CHANGED, url);
      }
    });

    this.view.webContents.on('did-start-loading', () => {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(IPC.PREVIEW_STATUS, 'loading');
      }
    });

    this.view.webContents.on('did-fail-load', () => {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(IPC.PREVIEW_STATUS, 'error');
      }
    });
  }

  navigate(url: string): void {
    if (!this.view) return;
    this.currentUrl = url;
    this.view.webContents.loadURL(url).catch((err) => {
      // ERR_ABORTED (-3) happens on redirects — not a real error
      const msg = String(err?.message || err || '');
      if (msg.includes('ERR_ABORTED') || msg.includes('-3')) return;
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(IPC.PREVIEW_STATUS, 'error');
      }
    });
  }

  syncLayout(rightPanelWidth: number, headerHeight: number, footerHeight: number): void {
    if (rightPanelWidth > 0) this.rightPanelWidth = rightPanelWidth;
    if (headerHeight > 0) this.headerHeight = headerHeight;
    if (footerHeight > 0) this.footerHeight = footerHeight;
    this.updateViewBounds();
  }

  hide(): void {
    this.hidden = true;
    this.view?.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }

  show(): void {
    this.hidden = false;
    this.updateViewBounds();
  }

  private getContainerBounds() {
    const [winWidth, winHeight] = this.window.getContentSize();
    const x = winWidth - this.rightPanelWidth;
    const y = this.headerHeight;
    const width = this.rightPanelWidth;
    const height = winHeight - this.headerHeight - this.footerHeight;
    return { x, y, width: Math.max(0, width), height: Math.max(0, height) };
  }

  private updateViewBounds(): void {
    if (!this.view || this.hidden || this.window.isDestroyed()) return;

    const container = this.getContainerBounds();
    if (container.width <= 0 || container.height <= 0) return;

    if (this.currentDevice) {
      const { width: dw, height: dh } = this.currentDevice;
      const scale = Math.min(container.width / dw, container.height / dh, 1);
      const sw = Math.round(dw * scale);
      const sh = Math.round(dh * scale);
      const ox = Math.round((container.width - sw) / 2);
      const oy = Math.round((container.height - sh) / 2);

      this.view.setBounds({
        x: container.x + ox,
        y: container.y + oy,
        width: sw,
        height: sh,
      });

      this.view.webContents.enableDeviceEmulation({
        screenPosition: dw <= 500 ? 'mobile' : 'desktop',
        screenSize: { width: dw, height: dh },
        viewPosition: { x: 0, y: 0 },
        viewSize: { width: dw, height: dh },
        deviceScaleFactor: this.currentDevice.deviceScaleFactor,
        scale,
      });
      this.view.webContents.invalidate();
    } else {
      this.view.setBounds(container);
      // Force Chromium to recalculate viewport after resize — fixes scroll breakage
      this.view.webContents.invalidate();
    }
  }

  setDeviceEmulation(preset: DevicePreset | null): void {
    if (!this.view) return;

    this.currentDevice = preset;

    if (!preset) {
      this.view.webContents.disableDeviceEmulation();
    }

    this.updateViewBounds();
  }

  getCurrentUrl(): string {
    return this.currentUrl;
  }

  destroy(): void {
    if (this.view) {
      try {
        this.window.contentView.removeChildView(this.view);
      } catch {
        // Window may already be destroyed
      }
      this.view = null;
    }
  }
}
