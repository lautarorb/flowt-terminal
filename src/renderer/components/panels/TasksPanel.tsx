import { useState, useCallback, DragEvent } from 'react';
import TaskCard from './TaskCard';
import ImportTasksModal from './ImportTasksModal';
import type { Task, TaskStatus, MdTaskFileState } from '../../hooks/useTasks';

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  ideas: '#3B82F6',
  todo: '#6B7280',
  in_progress: '#F59E0B',
  done: '#10B981',
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  ideas: 'Ideas',
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
};

type LoadStatus = 'loading' | 'ok' | 'not_found' | 'error' | 'parse_error';

interface Props {
  state: MdTaskFileState;
  loadStatus: LoadStatus;
  errorMessage: string;
  activeFilter: TaskStatus;
  onSetActiveFilter: (status: TaskStatus) => void;
  onAddTask: (status?: TaskStatus) => string;
  onUpdateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'body' | 'status' | 'category'>>) => void;
  onDeleteTask: (taskId: string) => void;
  onSetTaskStatus: (taskId: string, status: TaskStatus) => void;
  onToggleDone: (taskId: string) => void;
  onReorderTask: (taskId: string, newIndex: number) => void;
  onAddComment: (taskId: string, text: string) => void;
  onAddFeedback: (taskId: string, text: string) => void;
  onAddImage: (taskId: string, dataUrl: string) => void;
  onRemoveImage: (taskId: string, index: number) => void;
  onUpdateImage: (taskId: string, index: number, dataUrl: string) => void;
  onClearDone: () => void;
  onImportCsv: (csv: string) => number;
  onSendToTerminal: (text: string, images: string[]) => void;
  onMarkSentToTerminal: (taskId: string) => void;
  onReload: () => void;
  getFilteredTasks: (status: TaskStatus) => Task[];
  getStatusCounts: () => Record<TaskStatus, number>;
}

export default function TasksPanel({
  state,
  loadStatus,
  errorMessage,
  activeFilter,
  onSetActiveFilter,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onSetTaskStatus,
  onToggleDone,
  onReorderTask,
  onAddComment,
  onAddFeedback,
  onAddImage,
  onRemoveImage,
  onUpdateImage,
  onClearDone,
  onImportCsv,
  onSendToTerminal,
  onMarkSentToTerminal,
  onReload,
  getFilteredTasks,
  getStatusCounts,
}: Props) {
  const [newTaskId, setNewTaskId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [confirmClearDone, setConfirmClearDone] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const tasks = getFilteredTasks(activeFilter);
  const counts = getStatusCounts();

  const handleAddTask = useCallback(() => {
    const id = onAddTask();
    setNewTaskId(id);
  }, [onAddTask]);

  // --- Drag and drop for cards ---

  const handleCardDragStart = useCallback((e: DragEvent, taskId: string) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const handleCardDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleCardDrop = useCallback((e: DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!dragTaskId) return;
    onReorderTask(dragTaskId, targetIndex);
    setDragTaskId(null);
  }, [dragTaskId, onReorderTask]);

  // --- Drag to status tab ---

  const handleStatusTabDragOver = useCallback((e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleStatusTabDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleStatusTabDrop = useCallback((e: DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (dragTaskId) {
      onSetTaskStatus(dragTaskId, status);
    }
    setDragTaskId(null);
    setDragOverStatus(null);
  }, [dragTaskId, onSetTaskStatus]);

  const statuses: TaskStatus[] = ['ideas', 'todo', 'in_progress', 'done'];

  // --- Error / Loading states ---
  if (loadStatus === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
        loading tasks...
      </div>
    );
  }

  if (loadStatus === 'error' || loadStatus === 'parse_error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24 }}>
        <span style={{ color: 'var(--accent-red)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}>
          {loadStatus === 'parse_error' ? 'Failed to parse project-implementation.md' : errorMessage}
        </span>
        <button
          onClick={onReload}
          style={{ padding: '6px 12px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)', cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header: Import + Add task */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        height: 40, padding: '0 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={onReload}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 6px', height: '100%', color: 'var(--text-muted)',
              background: 'transparent', border: 'none', fontSize: 12, cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Reload tasks"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
          <div
            onClick={() => setImportModalOpen(true)}
            style={{ padding: '4px 6px', cursor: 'pointer' }}
            title="Import tasks from CSV"
          >
            <span
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Import
            </span>
          </div>
          <div onClick={handleAddTask} style={{ padding: '4px 8px', cursor: 'pointer' }}>
            <span
              style={{ color: 'var(--accent-green)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              [+]
            </span>
          </div>
        </div>
      </div>

      {/* Task list (scrollable) */}
      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
        {loadStatus === 'not_found' && state.tasks.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 100, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
            fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: '0 24px',
          }}>
            No project-implementation.md found.<br />Create your first task to generate it.
          </div>
        ) : tasks.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 100, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-sm)',
          }}>
            no {STATUS_LABELS[activeFilter].toLowerCase()} tasks
          </div>
        ) : (
          <>
            {(() => {
              const groups: { category: string; tasks: Task[] }[] = [];
              const seen = new Map<string, Task[]>();
              for (const task of tasks) {
                const cat = task.category || '';
                if (!seen.has(cat)) { const arr: Task[] = []; seen.set(cat, arr); groups.push({ category: cat, tasks: arr }); }
                seen.get(cat)!.push(task);
              }
              const hasCategories = groups.some((g) => g.category !== '');

              return groups.map((group) => (
                <div key={group.category || '__uncategorized'}>
                  {hasCategories && group.category && (
                    <div style={{
                      padding: '6px 12px 2px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--font-size-sm)', fontWeight: 600, borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    }}>
                      // {group.category}
                    </div>
                  )}
                  {group.tasks.map((task, index) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggleDone={() => onToggleDone(task.id)}
                      onUpdateTitle={(title) => onUpdateTask(task.id, { title })}
                      onUpdateBody={(body) => onUpdateTask(task.id, { body })}
                      onUpdateCategory={(category) => onUpdateTask(task.id, { category })}
                      onDelete={() => onDeleteTask(task.id)}
                      onAddImage={(dataUrl) => onAddImage(task.id, dataUrl)}
                      onRemoveImage={(i) => onRemoveImage(task.id, i)}
                      onUpdateImage={(i, dataUrl) => onUpdateImage(task.id, i, dataUrl)}
                      onAddComment={(text) => onAddComment(task.id, text)}
                      onAddFeedback={(text) => onAddFeedback(task.id, text)}
                      onSendToTerminal={onSendToTerminal}
                      onMarkSentToTerminal={() => onMarkSentToTerminal(task.id)}
                      onSetStatus={(status) => onSetTaskStatus(task.id, status)}
                      onDragStart={(e) => handleCardDragStart(e, task.id)}
                      onDragOver={(e) => handleCardDragOver(e)}
                      onDrop={(e) => handleCardDrop(e, index)}
                      autoFocusTitle={task.id === newTaskId}
                      defaultExpanded={task.id === newTaskId}
                    />
                  ))}
                </div>
              ));
            })()}

            {/* Clear done button */}
            {activeFilter === 'done' && tasks.length > 0 && (
              <button
                onClick={() => {
                  if (confirmClearDone) { onClearDone(); setConfirmClearDone(false); }
                  else { setConfirmClearDone(true); }
                }}
                onMouseLeave={() => setConfirmClearDone(false)}
                style={{
                  padding: '6px 12px', fontSize: 'var(--font-size-sm)',
                  color: confirmClearDone ? 'var(--accent-red)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)', textAlign: 'left', width: '100%',
                  cursor: 'pointer', background: 'transparent', border: 'none',
                }}
                onMouseEnter={(e) => { if (!confirmClearDone) e.currentTarget.style.color = 'var(--accent-red)'; }}
              >
                {confirmClearDone ? 'confirm clear done?' : 'Clear done'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Status filter bar (bottom) */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          height: 44, padding: '0 12px', borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)', flexShrink: 0,
        }}
        onDragLeave={handleStatusTabDragLeave}
      >
        {statuses.map((status) => (
          <div
            key={status}
            onClick={() => onSetActiveFilter(status)}
            onDragOver={(e) => handleStatusTabDragOver(e, status)}
            onDrop={(e) => handleStatusTabDrop(e, status)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 12px', cursor: 'pointer', borderRadius: 4,
              background: dragOverStatus === status ? 'var(--bg-tertiary)' : activeFilter === status ? 'var(--bg-tertiary)' : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_DOT_COLORS[status] }} />
            <span style={{
              color: activeFilter === status ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: activeFilter === status ? 500 : 'normal',
            }}>
              {STATUS_LABELS[status]}
            </span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {counts[status]}
            </span>
          </div>
        ))}
      </div>

      {/* Import modal */}
      {importModalOpen && (
        <ImportTasksModal
          onImport={(csv) => { onImportCsv(csv); setImportModalOpen(false); }}
          onCancel={() => setImportModalOpen(false)}
        />
      )}
    </div>
  );
}
