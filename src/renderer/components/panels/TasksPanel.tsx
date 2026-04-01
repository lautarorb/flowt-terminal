import { useState, useRef, useCallback, DragEvent } from 'react';
import TaskCard from './TaskCard';
import type { Task, TaskStatus } from '../../hooks/useTasks';
import type { TaskList, TaskStore } from '../../hooks/useTasks';

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

interface Props {
  store: TaskStore;
  activeListId: string | null;
  activeFilter: TaskStatus;
  onSetActiveListId: (id: string) => void;
  onSetActiveFilter: (status: TaskStatus) => void;
  onAddList: () => string;
  onRemoveList: (id: string) => void;
  onRenameList: (id: string, name: string) => void;
  onAddTask: (listId: string, status?: TaskStatus) => string;
  onUpdateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'body' | 'status' | 'images' | 'order'>>) => void;
  onDeleteTask: (taskId: string) => void;
  onSetTaskStatus: (taskId: string, status: TaskStatus) => void;
  onToggleDone: (taskId: string) => void;
  onReorderTask: (taskId: string, newOrder: number) => void;
  onAddComment: (taskId: string, text: string) => void;
  onAddImage: (taskId: string, dataUrl: string) => void;
  onRemoveImage: (taskId: string, index: number) => void;
  onUpdateImage: (taskId: string, index: number, dataUrl: string) => void;
  onClearDone: (listId: string) => void;
  onSendToTerminal: (text: string, images: string[]) => void;
  getFilteredTasks: (listId: string, status: TaskStatus) => Task[];
  getStatusCounts: (listId: string) => Record<TaskStatus, number>;
}

export default function TasksPanel({
  store,
  activeListId,
  activeFilter,
  onSetActiveListId,
  onSetActiveFilter,
  onAddList,
  onRemoveList,
  onRenameList,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onSetTaskStatus,
  onToggleDone,
  onReorderTask,
  onAddComment,
  onAddImage,
  onRemoveImage,
  onUpdateImage,
  onClearDone,
  onSendToTerminal,
  getFilteredTasks,
  getStatusCounts,
}: Props) {
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingListName, setEditingListName] = useState('');
  const [newTaskId, setNewTaskId] = useState<string | null>(null);
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);
  const [confirmClearDone, setConfirmClearDone] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const tasks = activeListId ? getFilteredTasks(activeListId, activeFilter) : [];
  const counts = activeListId ? getStatusCounts(activeListId) : { ideas: 0, todo: 0, in_progress: 0, done: 0 };

  const handleAddTask = useCallback(() => {
    if (!activeListId) return;
    const id = onAddTask(activeListId);
    setNewTaskId(id);
  }, [activeListId, onAddTask]);

  const handleStartRenameList = useCallback((list: TaskList) => {
    setEditingListId(list.id);
    setEditingListName(list.name);
  }, []);

  const handleFinishRenameList = useCallback(() => {
    if (editingListId && editingListName.trim()) {
      onRenameList(editingListId, editingListName.trim());
    }
    setEditingListId(null);
  }, [editingListId, editingListName, onRenameList]);

  // --- Drag and drop for cards ---

  const handleCardDragStart = useCallback((e: DragEvent, taskId: string) => {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const handleCardDragOver = useCallback((e: DragEvent, targetTaskId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleCardDrop = useCallback((e: DragEvent, targetTask: Task, targetIndex: number) => {
    e.preventDefault();
    if (!dragTaskId || dragTaskId === targetTask.id) return;
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

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Project list tabs + Add task button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        padding: '0 12px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* Scrollable list tabs */}
        <div
          ref={tabsScrollRef}
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            overflow: 'hidden',
            gap: 0,
            height: '100%',
          }}
        >
          {store.lists.map((list) => (
            <div
              key={list.id}
              onClick={() => onSetActiveListId(list.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                height: '100%',
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                borderBottom: activeListId === list.id ? '2px solid var(--text-secondary)' : '2px solid transparent',
              }}
            >
              {editingListId === list.id ? (
                <input
                  value={editingListName}
                  onChange={(e) => setEditingListName(e.target.value)}
                  onBlur={handleFinishRenameList}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleFinishRenameList(); if (e.key === 'Escape') setEditingListId(null); }}
                  autoFocus
                  style={{
                    width: 80,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 500,
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  onDoubleClick={(e) => { e.stopPropagation(); handleStartRenameList(list); }}
                  style={{
                    color: activeListId === list.id ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: activeListId === list.id ? 500 : 'normal',
                  }}
                >
                  {list.name}
                </span>
              )}
              {store.lists.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRemoveList(list.id); }}
                  style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.5, lineHeight: 1, background: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {/* Add list tab */}
          <div
            onClick={() => {
              onAddList();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 10px',
              height: '100%',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <span
              style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13 }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              +
            </span>
          </div>
        </div>

        {/* Add task button */}
        <div
          onClick={handleAddTask}
          style={{
            padding: '4px 8px',
            cursor: activeListId ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: activeListId ? 'var(--accent-green)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 500,
            }}
            onMouseEnter={(e) => { if (activeListId) e.currentTarget.style.opacity = '0.8'; }}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            [+]
          </span>
        </div>
      </div>

      {/* Task list (scrollable) */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--bg-primary)',
      }}>
        {!activeListId ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}>
            click + to create a project list
          </div>
        ) : tasks.length === 0 ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 100,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
          }}>
            no {STATUS_LABELS[activeFilter].toLowerCase()} tasks
          </div>
        ) : (
          <>
            {tasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleDone={() => onToggleDone(task.id)}
                onUpdateTitle={(title) => onUpdateTask(task.id, { title })}
                onUpdateBody={(body) => onUpdateTask(task.id, { body })}
                onDelete={() => onDeleteTask(task.id)}
                onAddImage={(dataUrl) => onAddImage(task.id, dataUrl)}
                onRemoveImage={(i) => onRemoveImage(task.id, i)}
                onUpdateImage={(i, dataUrl) => onUpdateImage(task.id, i, dataUrl)}
                onAddComment={(text) => onAddComment(task.id, text)}
                onSendToTerminal={onSendToTerminal}
                onSetStatus={(status) => onSetTaskStatus(task.id, status)}
                onDragStart={(e) => handleCardDragStart(e, task.id)}
                onDragOver={(e) => handleCardDragOver(e, task.id)}
                onDrop={(e) => handleCardDrop(e, task, index)}
                autoFocusTitle={task.id === newTaskId}
                defaultExpanded={task.id === newTaskId}
              />
            ))}

            {/* Clear done button */}
            {activeFilter === 'done' && tasks.length > 0 && activeListId && (
              <button
                onClick={() => {
                  if (confirmClearDone) {
                    onClearDone(activeListId);
                    setConfirmClearDone(false);
                  } else {
                    setConfirmClearDone(true);
                  }
                }}
                onMouseLeave={() => setConfirmClearDone(false)}
                style={{
                  padding: '6px 12px',
                  fontSize: 'var(--font-size-sm)',
                  color: confirmClearDone ? 'var(--accent-red)' : 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'left',
                  width: '100%',
                  cursor: 'pointer',
                  background: 'transparent',
                  border: 'none',
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          height: 44,
          padding: '0 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          flexShrink: 0,
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
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '8px 12px',
              cursor: 'pointer',
              borderRadius: 4,
              background: dragOverStatus === status
                ? 'var(--bg-tertiary)'
                : activeFilter === status
                  ? 'var(--bg-tertiary)'
                  : 'transparent',
              transition: 'background 0.1s',
            }}
          >
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: STATUS_DOT_COLORS[status],
            }} />
            <span style={{
              color: activeFilter === status ? 'var(--text-primary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: activeFilter === status ? 500 : 'normal',
            }}>
              {STATUS_LABELS[status]}
            </span>
            <span style={{
              color: activeFilter === status ? 'var(--text-muted)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
            }}>
              {counts[status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
