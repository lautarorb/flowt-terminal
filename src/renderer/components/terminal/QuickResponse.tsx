import { useEffect, useState } from 'react';
import { PromptDetection } from '../../../shared/types';

interface Props {
  activeTabId: string;
}

export default function QuickResponse({ activeTabId }: Props) {
  const [prompt, setPrompt] = useState<PromptDetection | null>(null);

  useEffect(() => {
    const cleanup = window.vibeAPI.prompt.onDetected((detection) => {
      if (detection.tabId === activeTabId) {
        setPrompt(detection);
      }
    });
    return cleanup;
  }, [activeTabId]);

  // Auto-dismiss after 10s
  useEffect(() => {
    if (!prompt) return;
    const timer = setTimeout(() => setPrompt(null), 10000);
    return () => clearTimeout(timer);
  }, [prompt]);

  // Dismiss on new PTY data
  useEffect(() => {
    if (!prompt) return;
    const cleanup = window.vibeAPI.pty.onData((tabId) => {
      if (tabId === activeTabId) {
        setPrompt(null);
      }
    });
    return cleanup;
  }, [prompt, activeTabId]);

  if (!prompt) return null;

  const handleClick = (option: string) => {
    window.vibeAPI.pty.write(activeTabId, option + '\r');
    setPrompt(null);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        fontSize: 'var(--font-size-sm)',
      }}
    >
      <span style={{ color: 'var(--text-muted)', marginRight: 4 }}>
        {prompt.rawText}
      </span>
      {prompt.options.map((opt) => (
        <button
          key={opt}
          onClick={() => handleClick(opt)}
          style={{
            padding: '2px 10px',
            borderRadius: 4,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            color: 'var(--accent-green)',
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
        >
          {opt}
        </button>
      ))}
      <button
        onClick={() => setPrompt(null)}
        style={{
          marginLeft: 'auto',
          color: 'var(--text-muted)',
          fontSize: 'var(--font-size-sm)',
        }}
      >
        dismiss
      </button>
    </div>
  );
}
