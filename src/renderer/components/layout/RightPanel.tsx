import { useState, useRef, useEffect, useCallback } from 'react';
import { LogEntry } from '../../../shared/types';
import { PreviewStatus } from '../../../shared/types';
import { LogFilter } from '../../lib/types';
import UrlBar from '../preview/UrlBar';
import PreviewFrame from '../preview/PreviewFrame';
import LogDrawer from '../logger/LogDrawer';
import AttachLogsModal from '../logger/AttachLogsModal';
import TasksPanel from '../panels/TasksPanel';
import type { Task, TaskStatus, TaskStore } from '../../hooks/useTasks';

type RightTab = 'preview' | 'claude' | 'tasks';

interface Props {
  url: string;
  status: PreviewStatus;
  activeDeviceName: string | null;
  onNavigate: (url: string) => void;
  onSelectDevice: (name: string | null) => void;
  onUrlChange: (url: string) => void;
  logs: LogEntry[];
  allLogs: LogEntry[];
  logFilter: LogFilter;
  setLogFilter: (f: LogFilter) => void;
  logsOpen: boolean;
  toggleLogs: () => void;
  clearLogs: () => void;
  onAttachLogs: (text: string) => void;
  onAttachScreenshot: () => void;
  // Tasks
  taskStore: TaskStore;
  taskActiveListId: string | null;
  taskActiveFilter: TaskStatus;
  onTaskSetActiveListId: (id: string) => void;
  onTaskSetActiveFilter: (status: TaskStatus) => void;
  onTaskAddList: () => string;
  onTaskRemoveList: (id: string) => void;
  onTaskRenameList: (id: string, name: string) => void;
  onTaskAddTask: (listId: string, status?: TaskStatus) => string;
  onTaskUpdateTask: (taskId: string, updates: Partial<Pick<Task, 'title' | 'body' | 'status' | 'category' | 'images' | 'order'>>) => void;
  onTaskDeleteTask: (taskId: string) => void;
  onTaskSetTaskStatus: (taskId: string, status: TaskStatus) => void;
  onTaskToggleDone: (taskId: string) => void;
  onTaskReorderTask: (taskId: string, newOrder: number) => void;
  onTaskAddComment: (taskId: string, text: string) => void;
  onTaskAddImage: (taskId: string, dataUrl: string) => void;
  onTaskRemoveImage: (taskId: string, index: number) => void;
  onTaskUpdateImage: (taskId: string, index: number, dataUrl: string) => void;
  onTaskClearDone: (listId: string) => void;
  onTaskImportCsv: (listId: string, csv: string) => number;
  onTaskSendToTerminal: (text: string, images: string[]) => void;
  taskGetFilteredTasks: (listId: string, status: TaskStatus) => Task[];
  taskGetStatusCounts: (listId: string) => Record<TaskStatus, number>;
  taskNonDoneCount: number;
}

export default function RightPanel({
  url,
  status,
  activeDeviceName,
  onNavigate,
  onSelectDevice,
  onUrlChange,
  logs,
  allLogs,
  logFilter,
  setLogFilter,
  logsOpen,
  toggleLogs,
  clearLogs,
  onAttachLogs,
  onAttachScreenshot,
  // Tasks
  taskStore,
  taskActiveListId,
  taskActiveFilter,
  onTaskSetActiveListId,
  onTaskSetActiveFilter,
  onTaskAddList,
  onTaskRemoveList,
  onTaskRenameList,
  onTaskAddTask,
  onTaskUpdateTask,
  onTaskDeleteTask,
  onTaskSetTaskStatus,
  onTaskToggleDone,
  onTaskReorderTask,
  onTaskAddComment,
  onTaskAddImage,
  onTaskRemoveImage,
  onTaskUpdateImage,
  onTaskClearDone,
  onTaskImportCsv,
  onTaskSendToTerminal,
  taskGetFilteredTasks,
  taskGetStatusCounts,
  taskNonDoneCount,
}: Props) {
  const [activeTab, setActiveTab] = useState<RightTab>('preview');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const claudeFrameRef = useRef<HTMLDivElement>(null);

  // The preview WebContentsView should be hidden when:
  // 1. The device selector dropdown is open (it renders above DOM)
  // 2. The Claude tab is active
  const previewHidden = dropdownOpen || activeTab !== 'preview';

  // Hide/show preview WebContentsView
  useEffect(() => {
    if (previewHidden) {
      window.vibeAPI.preview.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    } else {
      window.vibeAPI.preview.setBounds({ x: 999, y: 0, width: 1, height: 1 }); // non-zero = show
    }
  }, [previewHidden]);

  // Report Claude frame bounds when active
  const reportClaudeBounds = useCallback(() => {
    const el = claudeFrameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    window.vibeAPI.claude.setBounds({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }, []);

  // Show/hide Claude view based on active tab
  useEffect(() => {
    if (activeTab === 'claude') {
      // Show Claude after a frame
      requestAnimationFrame(() => {
        const el = claudeFrameRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          window.vibeAPI.claude.show({
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          });
        }
      });
    } else {
      // Hide Claude
      window.vibeAPI.claude.hide();
    }
  }, [activeTab]);

  // Keep Claude bounds updated on resize
  useEffect(() => {
    if (activeTab !== 'claude') return;
    const el = claudeFrameRef.current;
    if (!el) return;

    const observer = new ResizeObserver(reportClaudeBounds);
    observer.observe(el);
    window.addEventListener('resize', reportClaudeBounds);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', reportClaudeBounds);
    };
  }, [activeTab, reportClaudeBounds]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 'var(--tab-height)',
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          onClick={() => setActiveTab('preview')}
          style={{
            padding: '0 16px',
            height: '100%',
            fontSize: 'var(--font-size-sm)',
            color: activeTab === 'preview' ? 'var(--text-primary)' : 'var(--text-muted)',
            background: activeTab === 'preview' ? 'var(--bg-primary)' : 'transparent',
            borderBottom: activeTab === 'preview' ? '2px solid var(--text-primary)' : '2px solid transparent',
          }}
          onMouseEnter={(e) => { if (activeTab !== 'preview') e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { if (activeTab !== 'preview') e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Preview
        </button>
        <button
          onClick={() => setActiveTab('claude')}
          style={{
            padding: '0 16px',
            height: '100%',
            fontSize: 'var(--font-size-sm)',
            color: activeTab === 'claude' ? 'var(--text-primary)' : 'var(--text-muted)',
            background: activeTab === 'claude' ? 'var(--bg-primary)' : 'transparent',
            borderBottom: activeTab === 'claude' ? '2px solid #c15f3c' : '2px solid transparent',
          }}
          onMouseEnter={(e) => { if (activeTab !== 'claude') e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { if (activeTab !== 'claude') e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Claude
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            padding: '0 16px',
            height: '100%',
            fontSize: 'var(--font-size-sm)',
            color: activeTab === 'tasks' ? 'var(--text-primary)' : 'var(--text-muted)',
            background: activeTab === 'tasks' ? 'var(--bg-primary)' : 'transparent',
            borderBottom: activeTab === 'tasks' ? '2px solid var(--text-primary)' : '2px solid transparent',
            fontWeight: activeTab === 'tasks' ? 'bold' : 'normal',
          }}
          onMouseEnter={(e) => { if (activeTab !== 'tasks') e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseLeave={(e) => { if (activeTab !== 'tasks') e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Tasks{taskNonDoneCount > 0 ? ` (${taskNonDoneCount})` : ''}
        </button>
        {activeTab === 'claude' && (
          <button
            onClick={() => window.vibeAPI.claude.reload()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
              height: '100%',
              color: 'var(--text-muted)',
              background: 'transparent',
              fontSize: 12,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            title="Reload Claude"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </button>
        )}
      </div>

      {/* Preview content */}
      <div style={{ flex: 1, display: activeTab === 'preview' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
        <UrlBar
          url={url}
          status={status}
          activeDeviceName={activeDeviceName}
          onNavigate={onNavigate}
          onSelectDevice={onSelectDevice}
          onUrlChange={onUrlChange}
          onDropdownOpenChange={setDropdownOpen}
        />
        <PreviewFrame url={url} status={status} />

        {/* Action buttons */}
        <div
          style={{
            display: 'flex',
            gap: 0,
            borderTop: '1px solid var(--border)',
            height: 36,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setLogsModalOpen(true)}
            style={{
              flex: 1,
              padding: '0 12px',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--accent-cyan)',
              background: 'var(--bg-secondary)',
              borderRight: '1px solid var(--border)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
          >
            ← Add logs
          </button>
          <button
            onClick={onAttachScreenshot}
            style={{
              flex: 1,
              padding: '0 12px',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--accent-green)',
              background: 'var(--bg-secondary)',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
          >
            ← Add screenshot
          </button>
        </div>

        <LogDrawer
          logs={logs}
          allLogs={allLogs}
          filter={logFilter}
          setFilter={setLogFilter}
          isOpen={logsOpen}
          toggleOpen={toggleLogs}
          clearLogs={clearLogs}
        />
      </div>

      {/* Claude content -- placeholder div for WebContentsView */}
      <div
        ref={claudeFrameRef}
        style={{
          flex: 1,
          display: activeTab === 'claude' ? 'block' : 'none',
          background: 'var(--bg-primary)',
        }}
      />

      {/* Tasks content */}
      <div style={{ flex: 1, display: activeTab === 'tasks' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
        <TasksPanel
          store={taskStore}
          activeListId={taskActiveListId}
          activeFilter={taskActiveFilter}
          onSetActiveListId={onTaskSetActiveListId}
          onSetActiveFilter={onTaskSetActiveFilter}
          onAddList={onTaskAddList}
          onRemoveList={onTaskRemoveList}
          onRenameList={onTaskRenameList}
          onAddTask={onTaskAddTask}
          onUpdateTask={onTaskUpdateTask}
          onDeleteTask={onTaskDeleteTask}
          onSetTaskStatus={onTaskSetTaskStatus}
          onToggleDone={onTaskToggleDone}
          onReorderTask={onTaskReorderTask}
          onAddComment={onTaskAddComment}
          onAddImage={onTaskAddImage}
          onRemoveImage={onTaskRemoveImage}
          onUpdateImage={onTaskUpdateImage}
          onClearDone={onTaskClearDone}
          onImportCsv={onTaskImportCsv}
          onSendToTerminal={onTaskSendToTerminal}
          getFilteredTasks={taskGetFilteredTasks}
          getStatusCounts={taskGetStatusCounts}
        />
      </div>

      {/* Attach logs modal */}
      {logsModalOpen && (
        <AttachLogsModal
          logs={allLogs.filter((l) => l.type !== 'verbose')}
          onAttach={(text) => {
            onAttachLogs(text);
            setLogsModalOpen(false);
          }}
          onCancel={() => setLogsModalOpen(false)}
        />
      )}
    </div>
  );
}
