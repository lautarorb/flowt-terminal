import { useState } from 'react';
import { LogEntry as LogEntryType } from '../../../shared/types';

interface Props {
  entry: LogEntryType;
}

const TYPE_COLORS: Record<string, string> = {
  error: 'var(--accent-red)',
  warn: 'var(--accent-yellow)',
  info: 'var(--text-secondary)',
  log: 'var(--text-secondary)',
  'network-request': 'var(--accent-cyan)',
  'network-response': 'var(--accent-green)',
  'network-error': 'var(--accent-red)',
};

export default function LogEntryRow({ entry }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      style={{
        padding: '3px 8px',
        borderBottom: '1px solid rgba(42, 42, 42, 0.5)',
        cursor: entry.stackTrace ? 'pointer' : 'default',
        fontSize: 'var(--font-size-sm)',
        lineHeight: 1.6,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
        <span style={{ color: TYPE_COLORS[entry.type] || 'var(--text-secondary)', flexShrink: 0, width: 12 }}>
          {entry.type === 'error' || entry.type === 'network-error'
            ? '×'
            : entry.type === 'warn'
            ? '!'
            : entry.type.startsWith('network')
            ? '→'
            : '·'}
        </span>
        <span
          style={{
            color: TYPE_COLORS[entry.type] || 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: expanded ? 'pre-wrap' : 'nowrap',
            flex: 1,
          }}
        >
          {entry.message}
        </span>
        {entry.statusCode && (
          <span
            style={{
              color: entry.statusCode >= 400 ? 'var(--accent-red)' : 'var(--accent-green)',
              flexShrink: 0,
            }}
          >
            {entry.statusCode}
          </span>
        )}
      </div>
      {expanded && entry.stackTrace && (
        <pre
          style={{
            color: 'var(--text-muted)',
            fontSize: 'var(--font-size-sm)',
            marginTop: 4,
            marginLeft: 20,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {entry.stackTrace}
        </pre>
      )}
    </div>
  );
}
