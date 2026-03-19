import { useRef, useCallback, useEffect } from 'react';

interface Props {
  content: string;
  onChange: (content: string) => void;
  onClose: () => void;
}

function highlightKeywords(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(\*\*(.+?)\*\*)/g, '<span style="font-weight: 700">$1</span>')
    .replace(/^(#{1,3}\s.*)$/gm, '<span style="font-weight: 700; font-size: 14px">$1</span>')
    .replace(/(todo:)/gi, '<span style="color: #10B981; font-weight: 700">$1</span>')
    .replace(/(questions:)/gi, '<span style="color: #F59E0B; font-weight: 700">$1</span>')
    .replace(/(api keys?:)/gi, '<span style="color: #06B6D4; font-weight: 700">$1</span>');
}

export default function NotesPanel({ content, onChange, onClose }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLPreElement>(null);

  const syncScroll = useCallback(() => {
    if (textareaRef.current && overlayRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop;
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const insertAtCursor = useCallback((prefix: string, suffix = '', selectInner = false) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = content.substring(start, end);
    const before = content.substring(0, start);
    const after = content.substring(end);
    const insert = prefix + selected + suffix;
    const newContent = before + insert + after;
    onChange(newContent);
    requestAnimationFrame(() => {
      ta.focus();
      if (selectInner && !selected) {
        ta.selectionStart = ta.selectionEnd = start + prefix.length;
      } else {
        ta.selectionStart = ta.selectionEnd = start + insert.length;
      }
    });
  }, [content, onChange]);

  const wrapBold = useCallback(() => insertAtCursor('**', '**', true), [insertAtCursor]);

  const insertHeading = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
    const lineText = content.substring(lineStart, pos);
    // Cycle: none → # → ## → ### → none
    const match = lineText.match(/^(#{1,3})\s/);
    const before = content.substring(0, lineStart);
    const after = content.substring(lineStart);
    if (!match) {
      onChange(before + '# ' + after);
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = pos + 2; });
    } else if (match[1].length < 3) {
      onChange(before + '#' + after);
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = pos + 1; });
    } else {
      onChange(before + after.replace(/^###\s/, ''));
      requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = pos - 4; });
    }
  }, [content, onChange]);

  const insertBullet = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
    const lineText = content.substring(lineStart);
    if (lineText.startsWith('- ')) return; // Already a bullet
    const before = content.substring(0, lineStart);
    const after = content.substring(lineStart);
    onChange(before + '- ' + after);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = pos + 2; });
  }, [content, onChange]);

  const insertNumbered = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const lineStart = content.lastIndexOf('\n', pos - 1) + 1;
    const lineText = content.substring(lineStart);
    if (/^\d+\.\s/.test(lineText)) return; // Already numbered
    // Find the last numbered item above to determine the next number
    const textBefore = content.substring(0, lineStart);
    const prevLines = textBefore.split('\n');
    let num = 1;
    for (let i = prevLines.length - 1; i >= 0; i--) {
      const m = prevLines[i].match(/^(\d+)\.\s/);
      if (m) { num = parseInt(m[1]) + 1; break; }
    }
    const prefix = `${num}. `;
    const before = content.substring(0, lineStart);
    const after = content.substring(lineStart);
    onChange(before + prefix + after);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = pos + prefix.length; });
  }, [content, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = content.substring(0, pos);
    const after = content.substring(ta.selectionEnd);
    const currentLine = before.split('\n').pop() || '';

    // Numbered list: "1. " → next line "2. "
    const numMatch = currentLine.match(/^(\d+)\.\s/);
    if (numMatch) {
      // If line is just the number prefix (empty item), remove it instead
      if (currentLine.trim() === `${numMatch[1]}.`) {
        e.preventDefault();
        const lineStart = before.length - currentLine.length;
        onChange(content.substring(0, lineStart) + '\n' + after);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = lineStart + 1; });
        return;
      }
      e.preventDefault();
      const nextNum = parseInt(numMatch[1]) + 1;
      const insert = `\n${nextNum}. `;
      onChange(before + insert + after);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + insert.length; });
      return;
    }

    // Bullet list: "- " → next line "- "
    if (currentLine.match(/^-\s/)) {
      // If line is just "- " (empty item), remove it
      if (currentLine.trim() === '-') {
        e.preventDefault();
        const lineStart = before.length - currentLine.length;
        onChange(content.substring(0, lineStart) + '\n' + after);
        requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = lineStart + 1; });
        return;
      }
      e.preventDefault();
      const insert = '\n- ';
      onChange(before + insert + after);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + insert.length; });
      return;
    }
  }, [content, onChange]);

  const btnStyle: React.CSSProperties = {
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-muted)',
    background: 'transparent',
    cursor: 'pointer',
    lineHeight: 1,
  };

  return (
    <div
      style={{
        width: 320,
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>// notes</span>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <button
            onClick={wrapBold}
            style={{ ...btnStyle, fontWeight: 700 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Bold (**text**)"
          >
            B
          </button>
          <button
            onClick={insertHeading}
            style={btnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Heading (cycle # → ## → ###)"
          >
            H
          </button>
          <button
            onClick={insertBullet}
            style={btnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Bullet list (- item)"
          >
            •
          </button>
          <button
            onClick={insertNumbered}
            style={btnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Numbered list (1. item)"
          >
            1.
          </button>
        </div>

        <button
          onClick={onClose}
          style={{ color: 'var(--text-muted)', fontSize: 14 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ×
        </button>
      </div>

      {/* Editor area with overlay technique */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* Highlighted overlay */}
        <pre
          ref={overlayRef}
          dangerouslySetInnerHTML={{ __html: highlightKeywords(content) + '\n' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            padding: 12,
            margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-ui)',
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflow: 'auto',
            pointerEvents: 'none',
            color: 'var(--text-primary)',
          }}
        />

        {/* Transparent textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            padding: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-ui)',
            lineHeight: 1.8,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflow: 'auto',
            background: 'transparent',
            color: 'transparent',
            caretColor: 'var(--text-primary)',
            border: 'none',
            outline: 'none',
            resize: 'none',
          }}
        />
      </div>
    </div>
  );
}
