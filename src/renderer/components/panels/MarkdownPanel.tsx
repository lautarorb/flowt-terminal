import { useState, useEffect } from 'react';
import { MdFileInfo } from '../../../shared/types';
import MarkdownFileRow from './MarkdownFileRow';

interface Props {
  activeTabId: string;
  onClose: () => void;
}

export default function MarkdownPanel({ activeTabId, onClose }: Props) {
  const [files, setFiles] = useState<MdFileInfo[]>([]);
  const [cwd, setCwd] = useState('');

  useEffect(() => {
    // Get the shell's actual working directory
    window.vibeAPI.app.getCwd(activeTabId).then((dir) => {
      setCwd(dir);
      window.vibeAPI.mdFiles.watch(dir);
      window.vibeAPI.mdFiles.list().then(setFiles);
    });

    const cleanup = window.vibeAPI.mdFiles.onChanged(setFiles);
    return cleanup;
  }, [activeTabId]);

  return (
    <div
      style={{
        width: 340,
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            project markdown files
          </span>
          {cwd && (
            <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2, opacity: 0.6 }}>
              {cwd}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--text-muted)', fontSize: 14 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ×
        </button>
      </div>

      {/* File list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {files.length === 0 ? (
          <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
            No .md files found
          </div>
        ) : (
          files.map((file) => <MarkdownFileRow key={file.path} file={file} />)
        )}
      </div>
    </div>
  );
}
