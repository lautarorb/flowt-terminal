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
