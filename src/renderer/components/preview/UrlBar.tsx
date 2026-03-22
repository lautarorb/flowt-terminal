import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
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

const HISTORY_KEY = 'flowt-url-history';
const MAX_HISTORY = 50;

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}

function saveHistory(urls: string[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(urls.slice(0, MAX_HISTORY)));
}

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
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  // Update suggestions when typing
  useEffect(() => {
    if (!isFocused || !localValue.trim()) { setSuggestions([]); return; }
    const q = localValue.toLowerCase();
    const matches = history.filter((u) => u.toLowerCase().includes(q) && u !== localValue);
    setSuggestions(matches.slice(0, 8));
    setSelectedIdx(-1);
  }, [localValue, isFocused, history]);

  const addToHistory = useCallback((navigatedUrl: string) => {
    setHistory((prev) => {
      const next = [navigatedUrl, ...prev.filter((u) => u !== navigatedUrl)].slice(0, MAX_HISTORY);
      saveHistory(next);
      return next;
    });
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    setLocalValue(url);
  }, [url]);

  const handleBlur = useCallback(() => {
    blurTimeout.current = setTimeout(() => {
      setIsFocused(false);
      setSuggestions([]);
    }, 150);
  }, []);

  const navigate = useCallback((val: string) => {
    if (!val.trim()) return;
    addToHistory(val.trim());
    onNavigate(val.trim());
    inputRef.current?.blur();
    setSuggestions([]);
  }, [onNavigate, addToHistory]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIdx >= 0 && suggestions[selectedIdx]) {
          navigate(suggestions[selectedIdx]);
        } else {
          const val = inputRef.current?.value?.trim() || '';
          navigate(val);
        }
      } else if (e.key === 'Escape') {
        setSuggestions([]);
        inputRef.current?.blur();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, -1));
      }
    },
    [onNavigate, suggestions, selectedIdx, navigate],
  );

  const handleSuggestionClick = useCallback((s: string) => {
    clearTimeout(blurTimeout.current);
    navigate(s);
  }, [navigate]);

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
        position: 'relative',
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
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={isFocused ? localValue : url}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL..."
          autoComplete="off"
          style={{
            width: '100%',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '4px 8px',
            color: 'var(--text-primary)',
            fontSize: 'var(--font-size-sm)',
            outline: 'none',
          }}
        />

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: 4,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              overflow: 'hidden',
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {suggestions.map((s, i) => (
              <div
                key={s}
                onMouseDown={() => handleSuggestionClick(s)}
                style={{
                  padding: '6px 10px',
                  fontSize: 'var(--font-size-sm)',
                  color: i === selectedIdx ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: i === selectedIdx ? 'var(--bg-tertiary)' : 'transparent',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
                onMouseLeave={(e) => { if (i !== selectedIdx) e.currentTarget.style.background = 'transparent'; }}
              >
                {s}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Device selector */}
      <DeviceSelector
        active={activeDeviceName}
        onSelect={onSelectDevice}
        onOpenChange={onDropdownOpenChange}
      />
    </div>
  );
}
