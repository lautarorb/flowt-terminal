import { LogFilter as LogFilterType } from '../../lib/types';

interface Props {
  active: LogFilterType;
  onChange: (filter: LogFilterType) => void;
  counts: { all: number; errors: number; network: number; console: number; verbose: number };
}

const FILTERS: { key: LogFilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'errors', label: 'Errors' },
  { key: 'network', label: 'Network' },
  { key: 'console', label: 'Console' },
  { key: 'verbose', label: 'Verbose' },
];

export default function LogFilterBar({ active, onChange, counts }: Props) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 'var(--font-size-sm)',
            color: active === key ? 'var(--text-primary)' : 'var(--text-muted)',
            background: active === key ? 'var(--bg-tertiary)' : 'transparent',
          }}
        >
          {label}
          {counts[key] > 0 && (
            <span style={{ marginLeft: 4, color: key === 'errors' ? 'var(--accent-red)' : 'var(--text-muted)' }}>
              {counts[key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
