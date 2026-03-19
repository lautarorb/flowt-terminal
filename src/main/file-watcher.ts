import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC } from '../shared/ipc-channels';
import { MdFileInfo } from '../shared/types';

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.webpack', 'out']);

async function findMdFiles(dir: string, rootDir: string): Promise<MdFileInfo[]> {
  const results: MdFileInfo[] = [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        const sub = await findMdFiles(path.join(dir, entry.name), rootDir);
        results.push(...sub);
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const fullPath = path.join(dir, entry.name);
      results.push({
        path: fullPath,
        name: entry.name,
        relativePath: path.relative(rootDir, fullPath),
      });
    }
  }
  return results;
}

export class FileWatcher {
  private watcher: ReturnType<typeof import('chokidar').watch> | null = null;
  private cwd = '';

  constructor(private window: BrowserWindow) {}

  async watch(cwd: string): Promise<void> {
    this.cwd = cwd;
    this.destroy();

    const chokidar = await import('chokidar');
    this.watcher = chokidar.watch('**/*.md', {
      cwd,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.next/**'],
      persistent: true,
      ignoreInitial: false,
    });

    const notify = () => {
      if (!this.window.isDestroyed()) {
        this.listFiles().then((files) => {
          this.window.webContents.send(IPC.MD_FILES_CHANGED, files);
        });
      }
    };

    this.watcher.on('add', notify);
    this.watcher.on('unlink', notify);
    this.watcher.on('change', notify);
  }

  async listFiles(): Promise<MdFileInfo[]> {
    if (!this.cwd) return [];
    return findMdFiles(this.cwd, this.cwd);
  }

  async readFile(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf8');
  }

  destroy(): void {
    this.watcher?.close();
    this.watcher = null;
  }
}
