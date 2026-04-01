import { useState, useRef, useCallback, useEffect, ClipboardEvent, DragEvent } from 'react';
import AttachmentThumb from '../shared/AttachmentThumb';
import type { Task } from '../../hooks/useTasks';

function highlightKeywords(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/(\*\*(.+?)\*\*)/g, '<span style="font-weight: 700">$1</span>')
    .replace(/^(#{1,3}\s.*)$/gm, '<span style="font-weight: 700; font-size: 14px">$1</span>')
    .replace(/(todo:)/gi, '<span style="color: #10B981; font-weight: 700">$1</span>')
    .replace(/(questions:)/gi, '<span style="color: #F59E0B; font-weight: 700">$1</span>')
    .replace(/(`[^`]+`)/g, '<span style="color: #06B6D4">$1</span>');
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  task: Task;
  onUpdateTitle: (title: string) => void;
  onUpdateBody: (body: string) => void;
  onAddImage: (dataUrl: string) => void;
  onRemoveImage: (index: number) => void;
  onUpdateImage: (index: number, dataUrl: string) => void;
  onAddComment: (text: string) => void;
  onSendToTerminal: (text: string, images: string[]) => void;
  autoFocusTitle?: boolean;
}

export default function TaskCardExpanded({
  task,
  onUpdateTitle,
  onUpdateBody,
  onAddImage,
  onRemoveImage,
  onUpdateImage,
  onAddComment,
  onSendToTerminal,
  autoFocusTitle,
}: Props) {
  const [sendComments, setSendComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const bodyOverlayRef = useRef<HTMLPreElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocusTitle) titleRef.current?.focus();
  }, [autoFocusTitle]);

  const syncScroll = useCallback(() => {
    if (bodyTextareaRef.current && bodyOverlayRef.current) {
      bodyOverlayRef.current.scrollTop = bodyTextareaRef.current.scrollTop;
    }
  }, []);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      bodyTextareaRef.current?.focus();
    }
  }, []);

  const handleBodyKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return;
    const ta = bodyTextareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = task.body.substring(0, pos);
    const after = task.body.substring(ta.selectionEnd);
    const currentLine = before.split('\n').pop() || '';

    const numMatch = currentLine.match(/^(\d+)\.\s/);
    if (numMatch) {
      if (currentLine.trim() === `${numMatch[1]}.`) {
        e.preventDefault();
        const lineStart = before.length - currentLine.length;
        onUpdateBody(task.body.substring(0, lineStart) + '\n' + after);
        return;
      }
      e.preventDefault();
      const nextNum = parseInt(numMatch[1]) + 1;
      const insert = `\n${nextNum}. `;
      onUpdateBody(before + insert + after);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + insert.length; });
      return;
    }

    if (currentLine.match(/^-\s/)) {
      if (currentLine.trim() === '-') {
        e.preventDefault();
        const lineStart = before.length - currentLine.length;
        onUpdateBody(task.body.substring(0, lineStart) + '\n' + after);
        return;
      }
      e.preventDefault();
      const insert = '\n- ';
      onUpdateBody(before + insert + after);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = pos + insert.length; });
      return;
    }
  }, [task.body, onUpdateBody]);

  const handleImageDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => onAddImage(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  }, [onAddImage]);

  const handleImagePaste = useCallback((e: ClipboardEvent) => {
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => onAddImage(reader.result as string);
          reader.readAsDataURL(file);
        }
        return;
      }
    }
  }, [onAddImage]);

  const handleSendToTerminal = useCallback(() => {
    let text = task.title;
    if (task.body) text += '\n\n' + task.body;
    if (sendComments && task.comments.length > 0) {
      text += '\n\n---\nComments:\n';
      for (const c of task.comments) {
        const date = new Date(c.timestamp);
        text += `[${date.toLocaleString()}] ${c.text}\n`;
      }
    }
    onSendToTerminal(text, task.images);
  }, [task, sendComments, onSendToTerminal]);

  const handleAddComment = useCallback(() => {
    const text = commentText.trim();
    if (!text) return;
    onAddComment(text);
    setCommentText('');
    requestAnimationFrame(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }));
  }, [commentText, onAddComment]);

  const bodyHeight = Math.max(80, Math.min(200, (task.body.split('\n').length + 1) * 20));

  return (
    <div style={{ width: '100%' }}>
      {/* Title input */}
      <div style={{ padding: '0 12px 6px 36px' }}>
        <input
          ref={titleRef}
          value={task.title}
          onChange={(e) => onUpdateTitle(e.target.value)}
          onKeyDown={handleTitleKeyDown}
          placeholder="Task title..."
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            fontWeight: 500,
          }}
        />
      </div>

      {/* Body editor with overlay technique */}
      <div
        style={{ position: 'relative', height: bodyHeight, margin: '0 12px 8px 36px' }}
        onDrop={handleImageDrop}
        onDragOver={(e) => e.preventDefault()}
        onPaste={handleImagePaste}
      >
        <pre
          ref={bodyOverlayRef}
          dangerouslySetInnerHTML={{ __html: highlightKeywords(task.body) + '\n' }}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            padding: 0, margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflow: 'auto',
            pointerEvents: 'none',
            color: 'var(--text-primary)',
          }}
        />
        <textarea
          ref={bodyTextareaRef}
          value={task.body}
          onChange={(e) => onUpdateBody(e.target.value)}
          onKeyDown={handleBodyKeyDown}
          onScroll={syncScroll}
          placeholder="Add details (markdown supported)..."
          spellCheck={false}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%',
            padding: 0, margin: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            lineHeight: 1.7,
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

      {/* Image attachments */}
      {task.images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '4px 12px 8px 36px' }}>
          {task.images.map((src, i) => (
            <AttachmentThumb
              key={i}
              src={src}
              onRemove={() => onRemoveImage(i)}
              onUpdate={(dataUrl) => onUpdateImage(i, dataUrl)}
            />
          ))}
        </div>
      )}

      {/* Send comments toggle + Send to terminal */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px 8px 36px',
      }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          onClick={() => setSendComments((v) => !v)}
        >
          <div style={{
            width: 24, height: 12, borderRadius: 6,
            background: sendComments ? 'var(--accent-green)' : 'var(--bg-tertiary)',
            position: 'relative', transition: 'background 0.15s',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--text-primary)',
              position: 'absolute', top: 2,
              left: sendComments ? 14 : 2,
              transition: 'left 0.15s',
            }} />
          </div>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
            send comments
          </span>
        </div>

        <button
          onClick={handleSendToTerminal}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 4,
            border: '1px solid var(--accent-green)',
            background: 'transparent',
            cursor: 'pointer',
          }}
        >
          <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>$&gt;</span>
          <span style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 500 }}>
            send to terminal
          </span>
        </button>
      </div>

      {/* Comments divider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 12px 0 12px',
      }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>comments</span>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>

      {/* Comments list */}
      <div style={{ padding: '4px 12px 6px 12px', maxHeight: 150, overflowY: 'auto' }}>
        {task.comments.map((c) => (
          <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            <span style={{
              color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10,
              flexShrink: 0, lineHeight: '18px',
            }}>
              {formatTimestamp(c.timestamp)}
            </span>
            <span style={{
              color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11,
              lineHeight: '18px',
            }}>
              {c.text}
            </span>
          </div>
        ))}
        <div ref={commentsEndRef} />
      </div>

      {/* Comment input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px 10px 12px',
      }}>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>&gt;</span>
        <input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddComment(); } }}
          placeholder="add a comment..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontStyle: 'italic',
          }}
        />
      </div>
    </div>
  );
}
