import { useState, useEffect, useMemo } from 'react';
import { LogEntry } from '../../../shared/types';

type LogType = 'all' | 'errors' | 'network' | 'console' | 'verbose';
type RecordCount = 'all' | '25' | '100';

const STORAGE_KEY = 'attachLogsPrefs';

interface Props {
  logs: LogEntry[];
  onAttach: (text: string) => void;
  onCancel: () => void;
}

const LOG_TYPES: { key: LogType; label: string; icon: string; color: string }[] = [
  { key: 'all', label: 'All', icon: '◉', color: 'var(--accent-green)' },
  { key: 'errors', label: 'Errors', icon: '△', color: 'var(--accent-red)' },
  { key: 'network', label: 'Network', icon: '⇄', color: 'var(--text-secondary)' },
  { key: 'console', label: 'Console', icon: '$>', color: 'var(--accent-yellow)' },
  { key: 'verbose', label: 'Verbose', icon: '···', color: 'var(--text-muted)' },
];

const RECORD_COUNTS: { key: RecordCount; label: string }[] = [
  { key: 'all', label: 'All records' },
  { key: '25', label: 'Last 25' },
  { key: '100', label: 'Last 100' },
];

function loadPrefs(): { logType: LogType; recordCount: RecordCount } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function AttachLogsModal({ logs, onAttach, onCancel }: Props) {
  const saved = loadPrefs();
  const [logType, setLogType] = useState<LogType>(saved?.logType || 'all');
  const [recordCount, setRecordCount] = useState<RecordCount>(saved?.recordCount || '25');
  const [remember, setRemember] = useState(!!saved);

  // Save prefs when remember is toggled
  useEffect(() => {
    if (remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ logType, recordCount }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [remember, logType, recordCount]);

  const filteredLogs = useMemo(() => {
    let filtered = [...logs]; // logs already exclude app verbose
    if (logType === 'errors') filtered = filtered.filter((l) => l.type === 'error' || l.type === 'network-error');
    else if (logType === 'network') filtered = filtered.filter((l) => l.type.startsWith('network-'));
    else if (logType === 'console') filtered = filtered.filter((l) => ['log', 'warn', 'error', 'info'].includes(l.type));
    else if (logType === 'verbose') filtered = filtered.filter((l) => l.type === 'debug');

    if (recordCount === '25') filtered = filtered.slice(-25);
    else if (recordCount === '100') filtered = filtered.slice(-100);

    return filtered;
  }, [logs, logType, recordCount]);

  const handleAttach = () => {
    const text = filteredLogs
      .map((l) => {
        let line = `[${l.type}] ${l.message}`;
        if (l.stackTrace) line += '\n  ' + l.stackTrace;
        return line;
      })
      .join('\n');
    onAttach(text);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420,
          background: 'var(--bg-primary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent-cyan)', fontSize: 16 }}>$&gt;</span>
            <span style={{ color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>attach debug logs</span>
          </div>
          <button
            onClick={onCancel}
            style={{ color: 'var(--text-muted)', fontSize: 16 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ×
          </button>
        </div>

        {/* Log Type */}
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Log Type
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {LOG_TYPES.map(({ key, label, icon, color }) => (
              <button
                key={key}
                onClick={() => setLogType(key)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: logType === key ? '1px solid var(--accent-cyan)' : '1px solid var(--border)',
                  background: logType === key ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                }}
              >
                <span style={{ color: logType === key ? color : 'var(--text-muted)', fontSize: 14 }}>{icon}</span>
                <span style={{ color: logType === key ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Records */}
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Records
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {RECORD_COUNTS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRecordCount(key)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: recordCount === key ? '1px solid var(--accent-cyan)' : '1px solid var(--border)',
                  background: recordCount === key ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
                  color: recordCount === key ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 'var(--font-size-sm)',
                  cursor: 'pointer',
                  fontWeight: recordCount === key ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Remember */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{
              appearance: 'none',
              width: 16,
              height: 16,
              border: '1px solid var(--text-muted)',
              borderRadius: 4,
              background: remember ? 'var(--accent-green)' : 'transparent',
              backgroundImage: remember ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 8l3 3 5-5' stroke='%23000' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")` : 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
            Always remember my selection
          </span>
        </label>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleAttach}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              background: 'var(--accent-green)',
              color: '#000',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 12 }}>$&gt;</span>
            Attach {filteredLogs.length} logs
          </button>
        </div>
      </div>
    </div>
  );
}
