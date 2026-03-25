import { useState, useRef, useCallback, forwardRef, useImperativeHandle, KeyboardEvent, DragEvent, ClipboardEvent } from 'react';
import AttachmentThumb from '../shared/AttachmentThumb';

export interface InputBarHandle {
  appendText: (text: string) => void;
  addImage: (dataUrl: string) => void;
}

interface Props {
  activeTabId: string;
}

const MAX_VISIBLE_LINES = 10;

function CollapsibleText({ text, onRemove }: { text: string; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const lines = text.split('\n');
  const needsCollapse = lines.length > MAX_VISIBLE_LINES;
  const preview = needsCollapse && !expanded ? lines.slice(0, 3).join('\n') : text;

  return (
    <div
      style={{
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '6px 8px',
        marginBottom: 6,
        fontSize: 'var(--font-size-sm)',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ color: 'var(--accent-cyan)', fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
          attached logs ({lines.length} lines)
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {needsCollapse && (
            <button
              onClick={() => setExpanded((v) => !v)}
              style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              {expanded ? 'collapse' : 'expand'}
            </button>
          )}
          <button
            onClick={onRemove}
            style={{ color: 'var(--text-muted)', fontSize: 12 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-red)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ×
          </button>
        </div>
      </div>
      <pre
        style={{
          color: 'var(--text-secondary)',
          fontSize: 'var(--font-size-sm)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          maxHeight: expanded ? 300 : 60,
          overflowY: 'auto',
          margin: 0,
          fontFamily: 'var(--font-mono)',
        }}
      >
        {preview}
      </pre>
      {needsCollapse && !expanded && (
        <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', marginTop: 2 }}>
          ... {lines.length - 3} more lines
        </div>
      )}
    </div>
  );
}

const InputBar = forwardRef<InputBarHandle, Props>(({ activeTabId }, ref) => {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [textAttachments, setTextAttachments] = useState<string[]>([]);
  const chatRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    appendText: (text: string) => {
      setTextAttachments((prev) => [...prev, text]);
      chatRef.current?.focus();
    },
    addImage: (dataUrl: string) => {
      setAttachments((prev) => [...prev, dataUrl]);
      chatRef.current?.focus();
    },
  }));

  const send = useCallback(async () => {
    const parts: string[] = [];

    // Add the typed message first
    const text = value.trim();
    if (text) {
      parts.push(text);
    }

    // Add text attachments (logs etc.)
    for (const ta of textAttachments) {
      parts.push(ta);
    }

    // Save images to temp files and add paths
    for (const img of attachments) {
      try {
        const filePath = await window.vibeAPI.app.saveTempImage(img, activeTabId);
        parts.push(filePath);
      } catch {
        // Skip failed images
      }
    }

    if (parts.length === 0) return;

    const hasAttachments = attachments.length > 0 || textAttachments.length > 0;
    const hasText = text || textAttachments.length > 0;
    const tabId = activeTabId;

    if (!hasAttachments) {
      // Text-only: send immediately, no delays needed
      window.vibeAPI.pty.write(tabId, text);
      window.vibeAPI.pty.write(tabId, '\r');
    } else {
      // Has attachments: write each part sequentially with delays
      // to avoid PTY buffer overflow. 150ms per part keeps it responsive
      // while reliably delivering all paths (~3s for 20 images).
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      (async () => {
        for (let i = 0; i < parts.length; i++) {
          const prefix = i === 0 ? '' : ' ';
          window.vibeAPI.pty.write(tabId, prefix + parts[i]);
          await delay(150);
        }
        await delay(200);
        window.vibeAPI.pty.write(tabId, '\r');
      })();
    }
    setHistory((prev) => [...prev, text || 'attachment']);
    setHistoryIndex(-1);

    setValue('');
    setAttachments([]);
    setTextAttachments([]);
    autoResize();
  }, [value, activeTabId, attachments, textAttachments]);

  const autoResize = useCallback(() => {
    const ta = chatRef.current;
    if (!ta) return;
    ta.style.height = '48px';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      } else if (e.key === 'Enter' && e.shiftKey) {
        // Auto-continue lists on Shift+Enter (newline)
        const ta = chatRef.current;
        if (ta) {
          const pos = ta.selectionStart;
          const before = value.substring(0, pos);
          const after = value.substring(ta.selectionEnd);
          const currentLine = before.split('\n').pop() || '';

          // Check for numbered list: "1. ", "2. ", etc.
          const numMatch = currentLine.match(/^(\d+)\.\s/);
          if (numMatch) {
            e.preventDefault();
            const nextNum = parseInt(numMatch[1]) + 1;
            const insert = `\n${nextNum}. `;
            setValue(before + insert + after);
            requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = pos + insert.length;
              autoResize();
            });
            return;
          }

          // Check for bullet list: "- "
          const bulletMatch = currentLine.match(/^(-\s)/);
          if (bulletMatch) {
            e.preventDefault();
            const insert = '\n- ';
            setValue(before + insert + after);
            requestAnimationFrame(() => {
              ta.selectionStart = ta.selectionEnd = pos + insert.length;
              autoResize();
            });
            return;
          }
        }
      } else if (e.key === 'ArrowUp' && value === '' && history.length > 0) {
        e.preventDefault();
        const idx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(idx);
        setValue(history[idx]);
      } else if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault();
        window.vibeAPI.pty.write(activeTabId, '\x03');
      }
    },
    [send, value, history, historyIndex, activeTabId],
  );

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => setAttachments((prev) => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      }
    }
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => setAttachments((prev) => [...prev, reader.result as string]);
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  }, []);

  const handleCapture = useCallback(async () => {
    const dataUrl = await window.vibeAPI.app.capturePage();
    setAttachments((prev) => [...prev, dataUrl]);
  }, []);

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-primary)',
        padding: '6px 12px 6px',
      }}
    >
      {/* Text attachments (logs) */}
      {textAttachments.map((ta, i) => (
        <CollapsibleText
          key={i}
          text={ta}
          onRemove={() => setTextAttachments((prev) => prev.filter((_, j) => j !== i))}
        />
      ))}

      {/* Image attachments */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
          {attachments.map((src, i) => (
            <AttachmentThumb
              key={i}
              src={src}
              onRemove={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
              onUpdate={(dataUrl) => setAttachments((prev) => prev.map((s, j) => j === i ? dataUrl : s))}
            />
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--text-muted)',
          borderRadius: 8,
          padding: '6px 12px',
        }}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <span style={{ color: 'var(--accent-green)', fontWeight: 700, flexShrink: 0, lineHeight: '24px' }}>&gt;</span>
        <textarea
          ref={chatRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="compose message... (shift+enter for newline)"
          rows={1}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-terminal)',
            lineHeight: '24px',
            resize: 'none',
            minHeight: 48,
            maxHeight: 160,
          }}
        />

        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button
            onClick={handleCapture}
            title="Attach screenshot"
            style={{
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            SS
          </button>
          <button
            onClick={send}
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              background: value.trim() || textAttachments.length > 0 || attachments.length > 0 ? 'var(--accent-green)' : 'var(--bg-tertiary)',
              color: value.trim() || textAttachments.length > 0 || attachments.length > 0 ? 'var(--bg-primary)' : 'var(--text-muted)',
              fontWeight: 700,
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Send
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 3,
          fontSize: 'var(--font-size-sm)',
          color: 'var(--text-muted)',
        }}
      >
        <span>Ctrl+C sends SIGINT</span>
        <span>shift+enter for newline</span>
      </div>
    </div>
  );
});

InputBar.displayName = 'InputBar';
export default InputBar;
