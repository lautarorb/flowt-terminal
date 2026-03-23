import { useState, useEffect } from 'react';
import { MdFileInfo } from '../../../shared/types';

interface Props {
  file: MdFileInfo;
}

export default function MarkdownFileRow({ file }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!expanded) return;

    window.vibeAPI.mdFiles.read(file.path).then(async (text) => {
      setContent(text);
      try {
        const { marked } = await import('marked');
        const DOMPurify = (await import('dompurify')).default;
        const raw = await marked(text);
        setHtml(DOMPurify.sanitize(raw));
      } catch {
        setHtml(`<pre>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`);
      }
    });
  }, [expanded, file.path]);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 12px',
          textAlign: 'left',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--text-primary)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: 10, width: 12 }}>
          {expanded ? '▼' : '▶'}
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {file.relativePath}
        </span>
      </button>

      {expanded && html && (
        <div
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            padding: '8px 12px 12px 32px',
            fontSize: 'var(--font-size-sm)',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            overflow: 'auto',
            maxHeight: 300,
          }}
          className="md-content"
        />
      )}
    </div>
  );
}
