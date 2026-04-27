import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
import { useTerminal } from '../../hooks/useTerminal';

interface Props {
  tabId: string;
  isActive: boolean;
  onData?: (tabId: string, data: string) => void;
}

export default function TerminalView({ tabId, isActive, onData }: Props) {
  const { containerRef, terminal, zoomFont, findNext, findPrevious, clearSearch } = useTerminal({ tabId, isActive, onData });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isClaudeRunning, setIsClaudeRunning] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Scan the active buffer for Claude TUI markers — flag clears on its own when xterm switches back from the alternate buffer.
  useEffect(() => {
    if (!isActive) return;
    const scan = (): boolean => {
      const term = terminal.current;
      if (!term) return false;
      const buf = term.buffer.active;
      const start = buf.viewportY;
      const end = Math.min(buf.viewportY + term.rows, buf.length);
      for (let i = start; i < end; i++) {
        const line = buf.getLine(i);
        if (!line) continue;
        const text = line.translateToString(true);
        if (text.includes('? for shortcuts')) return true;
        if (text.includes('esc to interrupt')) return true;
      }
      return false;
    };
    const tick = () => setIsClaudeRunning(scan());
    tick();
    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [isActive, terminal]);

  // Listen for Cmd+F and terminal zoom from main process
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      } else if (e.metaKey && e.altKey && e.code === 'KeyV' && isClaudeRunning) {
        e.preventDefault();
        window.vibeAPI.pty.write(tabId, '/copy\r');
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const cleanupZoom = window.vibeAPI.terminal.onZoom((dir) => zoomFont(dir));

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cleanupZoom();
    };
  }, [isActive, zoomFont, isClaudeRunning, tabId]);

  const handleSearchKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) findPrevious(searchQuery);
      else findNext(searchQuery);
    } else if (e.key === 'Escape') {
      setSearchOpen(false);
      setSearchQuery('');
      clearSearch();
    }
  }, [searchQuery, findNext, findPrevious, clearSearch]);

  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    if (val) findNext(val);
    else clearSearch();
  }, [findNext, clearSearch]);

  const handleClose = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    clearSearch();
  }, [clearSearch]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: isActive ? 'block' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Search bar */}
      {searchOpen && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 12,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 8px',
          }}
        >
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search..."
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-mono)',
              width: 160,
            }}
          />
          <button
            onClick={() => findPrevious(searchQuery)}
            style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Previous (Shift+Enter)"
          >
            ↑
          </button>
          <button
            onClick={() => findNext(searchQuery)}
            style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Next (Enter)"
          >
            ↓
          </button>
          <button
            onClick={handleClose}
            style={{ color: 'var(--text-muted)', fontSize: 12, padding: '0 2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ×
          </button>
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          padding: '4px 8px',
          overflow: 'hidden',
        }}
      />

      {/* Copy-last-Claude-message button — only visible during Claude sessions */}
      {isClaudeRunning && (
        <button
          onClick={() => window.vibeAPI.pty.write(tabId, '/copy\r')}
          style={{
            position: 'absolute',
            bottom: 6,
            right: 16,
            zIndex: 5,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'rgba(15, 15, 15, 0.85)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text-secondary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-mono)',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          title="Copy last Claude message (⌘⌥V)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </button>
      )}
    </div>
  );
}
