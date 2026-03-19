import { BrowserWindow, WebContentsView } from 'electron';
import { PreviewBounds } from '../shared/types';

export class ClaudeView {
  private view: WebContentsView | null = null;
  private created = false;

  constructor(private window: BrowserWindow) {}

  create(): void {
    if (this.view) return;

    this.view = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.window.contentView.addChildView(this.view);
    this.view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    this.view.webContents.loadURL('https://claude.ai');
    this.created = true;
  }

  show(bounds: PreviewBounds): void {
    if (!this.created) this.create();
    this.view?.setBounds(bounds);
  }

  hide(): void {
    this.view?.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }

  reload(): void {
    if (this.view) {
      this.view.webContents.loadURL('https://claude.ai');
    }
  }

  setBounds(bounds: PreviewBounds): void {
    this.view?.setBounds(bounds);
  }

  destroy(): void {
    if (this.view) {
      try {
        this.window.contentView.removeChildView(this.view);
      } catch {
        // Window may already be destroyed
      }
      this.view = null;
      this.created = false;
    }
  }
}
