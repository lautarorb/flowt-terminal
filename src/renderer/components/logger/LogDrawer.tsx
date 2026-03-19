import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { LogEntry as LogEntryType } from '../../../shared/types';
import { LogFilter } from '../../lib/types';
import LogFilterBar from './LogFilter';
import LogEntryRow from './LogEntry';

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
  const dragging = useRef(false);

  // Sync footer height to main process so preview shrinks
  useEffect(() => {
    const actionButtonsHeight = 36;
    const actionButtonsBorder = 1; // borderTop on action buttons div
    const drawerBorder = 1; // borderTop on LogDrawer container
    const headerHeight = 30;
    const dragHandleHeight = isOpen ? 6 : 0;
    const entriesHeight = isOpen ? height : 0;
    const totalFooter = actionButtonsHeight + actionButtonsBorder + drawerBorder + dragHandleHeight + headerHeight + entriesHeight;
    window.vibeAPI.preview.syncLayout(0, 80, totalFooter); // 0 = don't change rightWidth
  }, [isOpen, height]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length]);

  const counts = useMemo(() => ({
    all: allLogs.length,
    errors: allLogs.filter((l) => l.type === 'error' || l.type === 'network-error').length,
    network: allLogs.filter((l) => l.type.startsWith('network-')).length,
    console: allLogs.filter((l) => ['log', 'warn', 'error', 'info'].includes(l.type)).length,
  }), [allLogs]);

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
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={toggleOpen}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
            // console
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {isOpen ? '▼' : '▲'}
          </span>
          {counts.errors > 0 && (
            <span style={{ color: 'var(--accent-red)', fontSize: 'var(--font-size-sm)' }}>
              {counts.errors} error{counts.errors > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <LogFilterBar active={filter} onChange={setFilter} counts={counts} />
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

      {/* Log entries — resizable */}
      {isOpen && (
        <div
          ref={scrollRef}
          style={{
            height,
            overflowY: 'auto',
          }}
        >
          {logs.length === 0 ? (
            <div style={{ padding: '8px', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
              No logs yet
            </div>
          ) : (
            logs.map((entry) => <LogEntryRow key={entry.id} entry={entry} />)
          )}
        </div>
      )}
    </div>
  );
}
