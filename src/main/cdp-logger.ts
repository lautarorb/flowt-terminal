import { BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { LogEntry } from '../shared/types';
import { PreviewManager } from './preview-manager';

let logIdCounter = 0;

export class CdpLogger {
  private attached = false;

  constructor(
    private window: BrowserWindow,
    private previewManager: PreviewManager,
  ) {}

  async attach(): Promise<void> {
    const view = this.previewManager.getView();
    if (!view || this.attached) return;

    const dbg = view.webContents.debugger;
    try {
      dbg.attach('1.3');
    } catch {
      return; // Already attached
    }

    this.attached = true;

    await Promise.all([
      dbg.sendCommand('Runtime.enable'),
      dbg.sendCommand('Network.enable'),
      dbg.sendCommand('Log.enable'),
    ]);

    dbg.on('message', (_event, method, params) => {
      if (this.window.isDestroyed()) return;

      let entry: LogEntry | null = null;

      if (method === 'Runtime.consoleAPICalled') {
        const args = params.args?.map((a: { value?: string; description?: string }) => a.value ?? a.description ?? '').join(' ') || '';
        entry = {
          id: `log-${++logIdCounter}`,
          type: params.type === 'error' ? 'error' : params.type === 'warning' ? 'warn' : params.type === 'info' ? 'info' : params.type === 'debug' ? 'debug' : 'log',
          message: args,
          timestamp: Date.now(),
        };
      } else if (method === 'Runtime.exceptionThrown') {
        const ex = params.exceptionDetails;
        entry = {
          id: `log-${++logIdCounter}`,
          type: 'error',
          message: ex?.exception?.description || ex?.text || 'Unknown error',
          timestamp: Date.now(),
          stackTrace: ex?.stackTrace?.callFrames
            ?.map((f: { functionName: string; url: string; lineNumber: number }) => `  at ${f.functionName || '(anonymous)'} (${f.url}:${f.lineNumber})`)
            .join('\n'),
        };
      } else if (method === 'Network.requestWillBeSent') {
        entry = {
          id: `log-${++logIdCounter}`,
          type: 'network-request',
          message: `${params.request.method} ${params.request.url}`,
          timestamp: Date.now(),
          url: params.request.url,
          method: params.request.method,
          requestId: params.requestId,
        };
      } else if (method === 'Network.responseReceived') {
        entry = {
          id: `log-${++logIdCounter}`,
          type: 'network-response',
          message: `${params.response.status} ${params.response.url}`,
          timestamp: Date.now(),
          url: params.response.url,
          statusCode: params.response.status,
          requestId: params.requestId,
        };
      } else if (method === 'Network.loadingFailed') {
        entry = {
          id: `log-${++logIdCounter}`,
          type: 'network-error',
          message: `Failed: ${params.errorText} (${params.requestId})`,
          timestamp: Date.now(),
          requestId: params.requestId,
        };
      }

      if (entry) {
        this.window.webContents.send(IPC.LOG_ENTRY, entry);
      }
    });

    // Reattach after navigations
    view.webContents.on('did-navigate', () => {
      this.reattach();
    });

    dbg.on('detach', () => {
      this.attached = false;
    });
  }

  private async reattach(): Promise<void> {
    this.attached = false;
    await this.attach();
  }

  async getResponseBody(requestId: string): Promise<string> {
    const view = this.previewManager.getView();
    if (!view || !this.attached) return '';

    try {
      const result = await view.webContents.debugger.sendCommand('Network.getResponseBody', { requestId });
      return result.body || '';
    } catch {
      return '';
    }
  }
}
