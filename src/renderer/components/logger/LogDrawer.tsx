import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { LogEntry as LogEntryType } from '../../../shared/types';
import { LogFilter } from '../../lib/types';
import LogFilterBar from './LogFilter';
import LogEntryRow from './LogEntry';

type LogTab = 'browser' | 'app';

interface Props {
  logs: LogEntryType[];
  allLogs: LogEntryType[];
  filter: LogFilter;
  setFilter: (f: LogFilter) => void;
  isOpen: boolean;
  toggleOpen: () => void;
  clearLogs: () => void;
  onHeightChange?: (height: number) => void;
}

export default function LogDrawer({
  logs,
  allLogs,
  filter,
  setFilter,
  isOpen,
  toggleOpen,
  clearLogs,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(200);
  const [activeTab, setActiveTab] = useState<LogTab>('browser');
  const dragging = useRef(false);

  // Sync footer height to main process so preview shrinks
  useEffect(() => {
    const actionButtonsHeight = 36;
    const actionButtonsBorder = 1;
    const drawerBorder = 1;
    const headerHeight = 30;
    const dragHandleHeight = isOpen ? 6 : 0;
    const filterRowHeight = isOpen && activeTab === 'browser' ? 25 : 0; // 24px + 1px border
    const entriesHeight = isOpen ? height : 0;
    const totalFooter = actionButtonsHeight + actionButtonsBorder + drawerBorder + dragHandleHeight + headerHeight + filterRowHeight + entriesHeight;
    window.vibeAPI.preview.syncLayout(0, 80, totalFooter);
  }, [isOpen, height, activeTab]);

  // Split logs
  const browserLogs = useMemo(() => allLogs.filter((l) => l.type !== 'verbose'), [allLogs]);
  const appLogs = useMemo(() => allLogs.filter((l) => l.type === 'verbose'), [allLogs]);

  // Filtered browser logs (same logic as before, minus verbose)
  const filteredBrowserLogs = useMemo(() => {
    if (filter === 'all') return browserLogs;
    if (filter === 'errors') return browserLogs.filter((l) => l.type === 'error' || l.type === 'network-error');
    if (filter === 'network') return browserLogs.filter((l) => l.type.startsWith('network-'));
    if (filter === 'console') return browserLogs.filter((l) => ['log', 'warn', 'error', 'info'].includes(l.type));
    if (filter === 'verbose') return browserLogs.filter((l) => l.type === 'debug');
    return browserLogs;
  }, [browserLogs, filter]);

  const displayLogs = activeTab === 'browser' ? filteredBrowserLogs : appLogs;

  const browserCounts = useMemo(() => ({
    all: browserLogs.length,
    errors: browserLogs.filter((l) => l.type === 'error' || l.type === 'network-error').length,
    network: browserLogs.filter((l) => l.type.startsWith('network-')).length,
    console: browserLogs.filter((l) => ['log', 'warn', 'error', 'info'].includes(l.type)).length,
    verbose: browserLogs.filter((l) => l.type === 'debug').length,
  }), [browserLogs]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayLogs.length]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startY = e.clientY;
    const startHeight = height;

    const handleMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY - e.clientY;
      setHeight(Math.max(80, Math.min(600, startHeight + delta)));
    };

    const handleUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [height]);

  const tabStyle = (tab: LogTab): React.CSSProperties => ({
    padding: '0 6px',
    fontSize: 'var(--font-size-sm)',
    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
    borderBottom: activeTab === tab ? '1px solid var(--text-primary)' : '1px solid transparent',
    cursor: 'pointer',
    background: 'transparent',
    lineHeight: '28px',
  });

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Drag handle to resize — always visible when open */}
      {isOpen && (
        <div
          onMouseDown={handleDragStart}
          style={{
            height: 6,
            cursor: 'row-resize',
            background: 'var(--border)',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-green)')}
          onMouseLeave={(e) => {
            if (!dragging.current) e.currentTarget.style.background = 'var(--border)';
          }}
        />
      )}

      {/* Header — always visible */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
          height: 30,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            onClick={toggleOpen}
            style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            // console
            <span style={{ fontSize: 10 }}>{isOpen ? '▼' : '▲'}</span>
          </span>
          {isOpen && (
            <>
              <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
              <button onClick={() => setActiveTab('browser')} style={tabStyle('browser')}>
                Browser{browserCounts.all > 0 ? ` ${browserCounts.all}` : ''}
              </button>
              <button onClick={() => setActiveTab('app')} style={tabStyle('app')}>
                App{appLogs.length > 0 ? ` ${appLogs.length}` : ''}
              </button>
            </>
          )}
          {!isOpen && browserCounts.errors > 0 && (
            <span style={{ color: 'var(--accent-red)', fontSize: 'var(--font-size-sm)' }}>
              {browserCounts.errors} error{browserCounts.errors > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={clearLogs}
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#b91c1c')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Clear logs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filter row — below header, only when open and on Browser tab */}
      {isOpen && activeTab === 'browser' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 8px',
            height: 24,
            flexShrink: 0,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <LogFilterBar active={filter} onChange={setFilter} counts={browserCounts} />
        </div>
      )}

      {/* Log entries — resizable */}
      {isOpen && (
        <div
          ref={scrollRef}
          style={{
            height,
            overflowY: 'auto',
          }}
        >
          {displayLogs.length === 0 ? (
            <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              {activeTab === 'browser' ? 'No browser logs yet' : 'No app logs yet'}
            </div>
          ) : (
            displayLogs.map((entry) => <LogEntryRow key={entry.id} entry={entry} />)
          )}
        </div>
      )}
    </div>
  );
}
