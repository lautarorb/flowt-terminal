import { useState, useRef, useCallback, DragEvent } from 'react';
import TaskCardExpanded from './TaskCardExpanded';
import type { Task, TaskStatus } from '../../hooks/useTasks';

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  ideas: '#3B82F6',
  todo: '#6B7280',
  in_progress: '#F59E0B',
  done: '#10B981',
};

interface Props {
  task: Task;
  onToggleDone: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateBody: (body: string) => void;
  onUpdateCategory: (category: string) => void;
  onDelete: () => void;
  onAddImage: (dataUrl: string) => void;
  onRemoveImage: (index: number) => void;
  onUpdateImage: (index: number, dataUrl: string) => void;
  onAddComment: (text: string) => void;
  onAddFeedback: (text: string) => void;
  onSendToTerminal: (text: string, images: string[]) => void;
  onMarkSentToTerminal: () => void;
  onSetStatus: (status: TaskStatus) => void;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  autoFocusTitle?: boolean;
  defaultExpanded?: boolean;
}

export default function TaskCard({
  task,
  onToggleDone,
  onUpdateTitle,
  onUpdateBody,
  onUpdateCategory,
  onDelete,
  onAddImage,
  onRemoveImage,
  onUpdateImage,
  onAddComment,
  onAddFeedback,
  onSendToTerminal,
  onMarkSentToTerminal,
  onSetStatus,
  onDragStart,
  onDragOver,
  onDrop,
  autoFocusTitle,
  defaultExpanded,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded || false);
  const [hovered, setHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const isDone = task.status === 'done';
  const hasBody = task.body.trim().length > 0;
  const bodyPreview = hasBody ? task.body.split('\n')[0] : '';

  const handleSendToTerminal = useCallback((text: string, images: string[]) => {
    onMarkSentToTerminal();
    onSendToTerminal(text, images);
  }, [onMarkSentToTerminal, onSendToTerminal]);

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
      style={{
        width: '100%',
        background: expanded ? '#111111' : 'transparent',
        borderBottom: '1px solid var(--border)',
        cursor: 'default',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', width: '100%' }}>
        {/* Drag handle */}
        <span style={{
          color: hovered ? 'var(--text-muted)' : 'var(--border)',
          fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'grab', flexShrink: 0, userSelect: 'none',
        }}>⋮⋮</span>

        {/* Checkbox */}
        <div
          onClick={(e) => { e.stopPropagation(); onToggleDone(); }}
          style={{
            width: 16, height: 16, borderRadius: 3,
            border: '1px solid var(--text-muted)', flexShrink: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isDone
              ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M3 7l3 3 5-5' stroke='%2310B981' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center/contain no-repeat`
              : 'transparent',
          }}
        />

        {/* Status dot */}
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT_COLORS[task.status], flexShrink: 0 }} />

        {/* Title (click to expand) */}
        <span
          onClick={() => setExpanded((v) => !v)}
          style={{
            flex: 1, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
            fontFamily: 'var(--font-mono)', fontSize: 12,
            textDecoration: isDone ? 'line-through' : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            minWidth: 0, cursor: 'pointer',
          }}>
          {task.title || 'Untitled'}
        </span>

        {/* Meta indicators (collapsed) */}
        {!expanded && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {task.images.length > 0 && (
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>◻ {task.images.length}</span>
            )}
            {task.comments.length > 0 && (
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>◬ {task.comments.length}</span>
            )}
            {task.feedback.length > 0 && (
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>⚡ {task.feedback.length}</span>
            )}
          </div>
        )}

        {/* Send to terminal (collapsed hover) */}
        {!expanded && hovered && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              let text = task.title;
              if (task.body) text += '\n\n' + task.body;
              handleSendToTerminal(text, task.images);
            }}
            style={{
              padding: '2px 6px', borderRadius: 3, border: '1px solid var(--accent-green)',
              background: 'transparent', color: 'var(--accent-green)',
              fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer', flexShrink: 0,
            }}
          >$&gt;</button>
        )}

        {/* Delete button */}
        {hovered && (
          confirmDelete ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer', flexShrink: 0 }}
            >confirm?</button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              style={{ color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-red)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >×</button>
          )
        )}

        {/* Chevron */}
        <span
          onClick={() => setExpanded((v) => !v)}
          style={{
            color: expanded ? 'var(--text-primary)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 'bold',
            cursor: 'pointer', flexShrink: 0, lineHeight: 1, userSelect: 'none',
          }}
        >{expanded ? '▾' : '▸'}</span>
      </div>

      {/* Body preview (collapsed) */}
      {!expanded && hasBody && (
        <div style={{ padding: '0 12px 6px 52px' }}>
          <span style={{
            color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block',
          }}>{bodyPreview}</span>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <TaskCardExpanded
          task={task}
          onUpdateTitle={onUpdateTitle}
          onUpdateBody={onUpdateBody}
          onUpdateCategory={onUpdateCategory}
          onAddImage={onAddImage}
          onRemoveImage={onRemoveImage}
          onUpdateImage={onUpdateImage}
          onAddComment={onAddComment}
          onAddFeedback={onAddFeedback}
          onSendToTerminal={handleSendToTerminal}
          autoFocusTitle={autoFocusTitle}
        />
      )}
    </div>
  );
}
