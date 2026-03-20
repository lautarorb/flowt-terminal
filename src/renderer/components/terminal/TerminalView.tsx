import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
import { useTerminal } from '../../hooks/useTerminal';

interface Props {
  tabId: string;
  isActive: boolean;
  onData?: (tabId: string, data: string) => void;
}

export default function TerminalView({ tabId, isActive, onData }: Props) {
  const { containerRef, zoomFont, findNext, findPrevious, clearSearch } = useTerminal({ tabId, isActive, onData });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Listen for Cmd+F and terminal zoom from main process
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const cleanupZoom = window.vibeAPI.terminal.onZoom((dir) => zoomFont(dir));

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cleanupZoom();
    };
  }, [isActive, zoomFont]);

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
    </div>
  );
}
