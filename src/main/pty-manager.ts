import { BrowserWindow } from 'electron';
import * as pty from 'node-pty';
import { execSync } from 'child_process';
import { IPC } from '../shared/ipc-channels';
import { PromptDetector } from './prompt-detector';

export class PtyManager {
  private ptys = new Map<string, pty.IPty>();
  private promptDetector: PromptDetector;

  constructor(private window: BrowserWindow) {
    this.promptDetector = new PromptDetector((detection) => {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(IPC.PROMPT_DETECTED, detection);
      }
    });
  }

  create(tabId: string, cwd?: string): string {
    const shell = process.env.SHELL || '/bin/zsh';

    // Pass through full env but strip Electron internals that can break CLI tools
    const cleanEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (val === undefined) continue;
      if (key.startsWith('ELECTRON_')) continue;
      if (key.startsWith('CHROME_') || key === 'ORIGINAL_XDG_CURRENT_DESKTOP') continue;
      if (key === 'GOOGLE_API_KEY' || key === 'GOOGLE_DEFAULT_CLIENT_ID' || key === 'GOOGLE_DEFAULT_CLIENT_SECRET') continue;
      if (key === 'NODE_OPTIONS') continue; // Electron may set internal NODE_OPTIONS
      cleanEnv[key] = val;
    }

    const term = pty.spawn(shell, ['--login'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: cwd || process.env.HOME || '/',
      env: {
        ...cleanEnv,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'VibeTerminal',
      },
    });

    term.onData((data: string) => {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(IPC.PTY_DATA, tabId, data);
      }
      this.promptDetector.feed(tabId, data);
    });

    term.onExit(({ exitCode }) => {
      if (!this.window.isDestroyed()) {
        this.window.webContents.send(IPC.PTY_EXIT, tabId, exitCode);
      }
      this.ptys.delete(tabId);
    });

    this.ptys.set(tabId, term);
    return tabId;
  }

  write(tabId: string, data: string): void {
    this.ptys.get(tabId)?.write(data);
  }

  resize(tabId: string, cols: number, rows: number): void {
    const term = this.ptys.get(tabId);
    if (term && cols > 0 && rows > 0) {
      try {
        term.resize(cols, rows);
      } catch {
        // Ignore resize errors on destroyed terminals
      }
    }
  }

  destroy(tabId: string): void {
    const term = this.ptys.get(tabId);
    if (term) {
      term.kill();
      this.ptys.delete(tabId);
    }
  }

  getCwd(tabId: string): string {
    const term = this.ptys.get(tabId);
    if (!term) return process.env.HOME || '/';

    try {
      // On macOS, use lsof to get the CWD of the shell's child process (or shell itself)
      const pid = term.pid;
      const output = execSync(`lsof -a -p ${pid} -d cwd -Fn 2>/dev/null`, { encoding: 'utf8', timeout: 2000 });
      const lines = output.split('\n');
      for (const line of lines) {
        if (line.startsWith('n') && line.length > 1) {
          return line.slice(1);
        }
      }
    } catch {
      // Fallback
    }
    return process.env.HOME || '/';
  }

  destroyAll(): void {
    for (const [id, term] of this.ptys) {
      term.kill();
      this.ptys.delete(id);
    }
  }
}
