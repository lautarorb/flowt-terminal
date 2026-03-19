import { useState, useCallback, useRef, KeyboardEvent } from 'react';
import { PreviewStatus } from '../../../shared/types';
import DeviceSelector from './DeviceSelector';

interface Props {
  url: string;
  status: PreviewStatus;
  activeDeviceName: string | null;
  onNavigate: (url: string) => void;
  onSelectDevice: (name: string | null) => void;
  onUrlChange: (url: string) => void;
  onDropdownOpenChange: (open: boolean) => void;
  inline?: boolean;
}

const STATUS_COLORS: Record<PreviewStatus, string> = {
  idle: 'var(--text-muted)',
  loading: 'var(--text-muted)',
  loaded: 'var(--accent-green)',
  error: 'var(--accent-red)',
};

export default function UrlBar({
  url,
  status,
  activeDeviceName,
  onNavigate,
  onSelectDevice,
  onUrlChange,
  onDropdownOpenChange,
  inline,
}: Props) {
  const [localValue, setLocalValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setLocalValue(url);
  }, [url]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = inputRef.current?.value?.trim() || '';
        if (!val) return;
        onNavigate(val);
        inputRef.current?.blur();
      } else if (e.key === 'Escape') {
        inputRef.current?.blur();
      }
    },
    [onNavigate],
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: inline ? 'auto' : 'var(--tab-height)',
        padding: inline ? '0 4px' : '0 8px',
        background: inline ? 'transparent' : 'var(--bg-secondary)',
        borderBottom: inline ? 'none' : '1px solid var(--border)',
        flex: inline ? 1 : undefined,
      }}
    >
      {/* Back + Refresh */}
      <button
        onClick={() => window.vibeAPI.preview.goBack()}
        style={{ color: 'var(--text-muted)', fontSize: 14, padding: '0 2px' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        title="Back"
      >
        ←
      </button>
      <button
        onClick={() => window.vibeAPI.preview.reload()}
        style={{ color: 'var(--text-muted)', fontSize: 13, padding: '0 2px' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        title="Reload"
      >
        ↻
      </button>

      {/* Status dot */}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: STATUS_COLORS[status],
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      />

      {/* URL input */}
      <input
        ref={inputRef}
        type="text"
        value={isFocused ? localValue : url}
        onChange={(e) => {
          setLocalValue(e.target.value);
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="Enter URL..."
        style={{
          flex: 1,
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '4px 8px',
          color: 'var(--text-primary)',
          fontSize: 'var(--font-size-sm)',
          outline: 'none',
        }}
      />

      {/* Device selector */}
      <DeviceSelector
        active={activeDeviceName}
        onSelect={onSelectDevice}
        onOpenChange={onDropdownOpenChange}
      />
    </div>
  );
}
