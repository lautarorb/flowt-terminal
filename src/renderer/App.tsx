import { useEffect, useCallback, useState, useRef } from 'react';
import { useTabs } from './hooks/useTabs';
import { usePreview } from './hooks/usePreview';
import { useNotes } from './hooks/useNotes';
import { useLogs } from './hooks/useLogs';
import { useChecklists } from './hooks/useChecklists';
import { useTasks } from './hooks/useTasks';
import SplitLayout from './components/layout/SplitLayout';
import LeftPanel from './components/layout/LeftPanel';
import RightPanel from './components/layout/RightPanel';
import { InputBarHandle } from './components/terminal/InputBar';

export default function App() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, renameTab, setTabActivity, reorderTabs } = useTabs();
  const { url, status, activeDevice, navigate, selectDevice, updateBounds, setUrl } = usePreview();
  const { content: notesContent, isOpen: notesOpen, updateContent: updateNotes, toggle: toggleNotes, close: closeNotes } = useNotes();
  const { logs, allLogs, filter: logFilter, setFilter: setLogFilter, isOpen: logsOpen, toggleOpen: toggleLogs, clearLogs } = useLogs();
  const {
    lists: checklists, activeListId: activeChecklistId, setActiveListId: setActiveChecklistId, isOpen: checklistsOpen,
    addList: addChecklist, removeList: removeChecklist, renameList: renameChecklist,
    addItem: addChecklistItem, toggleItem: toggleChecklistItem, removeItem: removeChecklistItem,
    toggle: toggleChecklists, close: closeChecklists,
  } = useChecklists();
  const {
    store: taskStore,
    activeListId: taskActiveListId, setActiveListId: setTaskActiveListId,
    activeFilter: taskActiveFilter, setActiveFilter: setTaskActiveFilter,
    addList: addTaskList, removeList: removeTaskList, renameList: renameTaskList,
    addTask, updateTask, deleteTask,
    setTaskStatus, toggleDone: toggleTaskDone, reorderTask,
    addComment: addTaskComment,
    addImage: addTaskImage, removeImage: removeTaskImage, updateImage: updateTaskImage,
    clearDone: clearTaskDone, importTasksFromCsv,
    getFilteredTasks, getStatusCounts, getNonDoneCount,
  } = useTasks();
  const [mdOpen, setMdOpen] = useState(false);
  const inputBarRef = useRef<InputBarHandle>(null);

  // Fullscreen detection — toggle body class for CSS
  useEffect(() => {
    const cleanup = window.vibeAPI.window.onFullscreenChanged((isFullscreen) => {
      document.body.classList.toggle('is-fullscreen', isFullscreen);
    });
    return cleanup;
  }, []);

  // UI zoom (Cmd+Option+/- scales all app fonts)
  useEffect(() => {
    const defaults = { terminal: 13, ui: 12, sm: 11 };
    let scale = 0; // offset in px from defaults
    const cleanup = window.vibeAPI.ui.onZoom((dir) => {
      if (dir === 'in') scale = Math.min(8, scale + 1);
      else if (dir === 'out') scale = Math.max(-4, scale - 1);
      else if (dir === 'reset') scale = 0;
      const root = document.documentElement;
      root.style.setProperty('--font-size-terminal', (defaults.terminal + scale) + 'px');
      root.style.setProperty('--font-size-ui', (defaults.ui + scale) + 'px');
      root.style.setProperty('--font-size-sm', (defaults.sm + scale) + 'px');
    });
    return cleanup;
  }, []);

  // Menu shortcuts
  useEffect(() => {
    const cleanupNew = window.vibeAPI.menu.onNewTab(() => addTab());
    const cleanupClose = window.vibeAPI.menu.onCloseTab(() => {
      if (tabs.length > 1 && window.confirm('This will terminate the running process.')) {
        window.vibeAPI.pty.destroy(activeTabId);
        removeTab(activeTabId);
      }
    });
    const cleanupReload = window.vibeAPI.menu.onReloadPreview(() => {
      window.vibeAPI.preview.reload();
    });
    return () => {
      cleanupNew();
      cleanupClose();
      cleanupReload();
    };
  }, [addTab, removeTab, activeTabId, tabs.length]);

  // Keyboard shortcuts for tab switching
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (idx < tabs.length) {
          setActiveTab(tabs[idx].id);
        }
      } else if (e.metaKey && e.shiftKey && e.key === '[') {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        if (idx > 0) setActiveTab(tabs[idx - 1].id);
      } else if (e.metaKey && e.shiftKey && e.key === ']') {
        e.preventDefault();
        const idx = tabs.findIndex((t) => t.id === activeTabId);
        if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1].id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [tabs, activeTabId, setActiveTab]);

  const handleAddTab = useCallback(() => {
    addTab();
  }, [addTab]);

  const handleRemoveTab = useCallback(
    (id: string) => {
      window.vibeAPI.pty.destroy(id);
      removeTab(id);
    },
    [removeTab],
  );

  const handleAttachLogs = useCallback((text: string) => {
    inputBarRef.current?.appendText(text);
  }, []);

  const handleAttachScreenshot = useCallback(async () => {
    const dataUrl = await window.vibeAPI.preview.capture();
    if (dataUrl) {
      inputBarRef.current?.addImage(dataUrl);
    }
  }, []);

  const handleTaskSendToTerminal = useCallback((text: string, images: string[]) => {
    inputBarRef.current?.appendText(text, 'task details');
    for (const img of images) {
      inputBarRef.current?.addImage(img);
    }
  }, []);

  return (
    <SplitLayout
      left={
        <LeftPanel
          ref={inputBarRef}
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTab}
          onAddTab={handleAddTab}
          onRemoveTab={handleRemoveTab}
          onRenameTab={renameTab}
          onReorderTabs={reorderTabs}
          onTabActivity={setTabActivity}
          notesContent={notesContent}
          notesOpen={notesOpen}
          onNotesChange={updateNotes}
          onNotesToggle={() => { toggleNotes(); setMdOpen(false); closeChecklists(); }}
          onNotesClose={closeNotes}
          mdOpen={mdOpen}
          onMdToggle={() => { setMdOpen((v) => !v); closeNotes(); closeChecklists(); }}
          onMdClose={() => setMdOpen(false)}
          checklistsOpen={checklistsOpen}
          onChecklistsToggle={() => { toggleChecklists(); closeNotes(); setMdOpen(false); }}
          onChecklistsClose={closeChecklists}
          checklists={checklists}
          activeChecklistId={activeChecklistId}
          onSelectChecklist={setActiveChecklistId}
          onAddChecklist={addChecklist}
          onRemoveChecklist={removeChecklist}
          onRenameChecklist={renameChecklist}
          onAddChecklistItem={addChecklistItem}
          onToggleChecklistItem={toggleChecklistItem}
          onRemoveChecklistItem={removeChecklistItem}
        />
      }
      right={
        <RightPanel
          url={url}
          status={status}
          activeDeviceName={activeDevice?.name || null}
          onNavigate={navigate}
          onSelectDevice={selectDevice}
          onUrlChange={setUrl}
          logs={logs}
          allLogs={allLogs}
          logFilter={logFilter}
          setLogFilter={setLogFilter}
          logsOpen={logsOpen}
          toggleLogs={toggleLogs}
          clearLogs={clearLogs}
          onAttachLogs={handleAttachLogs}
          onAttachScreenshot={handleAttachScreenshot}
          taskStore={taskStore}
          taskActiveListId={taskActiveListId}
          taskActiveFilter={taskActiveFilter}
          onTaskSetActiveListId={setTaskActiveListId}
          onTaskSetActiveFilter={setTaskActiveFilter}
          onTaskAddList={addTaskList}
          onTaskRemoveList={removeTaskList}
          onTaskRenameList={renameTaskList}
          onTaskAddTask={addTask}
          onTaskUpdateTask={updateTask}
          onTaskDeleteTask={deleteTask}
          onTaskSetTaskStatus={setTaskStatus}
          onTaskToggleDone={toggleTaskDone}
          onTaskReorderTask={reorderTask}
          onTaskAddComment={addTaskComment}
          onTaskAddImage={addTaskImage}
          onTaskRemoveImage={removeTaskImage}
          onTaskUpdateImage={updateTaskImage}
          onTaskClearDone={clearTaskDone}
          onTaskImportCsv={importTasksFromCsv}
          onTaskSendToTerminal={handleTaskSendToTerminal}
          taskGetFilteredTasks={getFilteredTasks}
          taskGetStatusCounts={getStatusCounts}
          taskNonDoneCount={getNonDoneCount()}
        />
      }
    />
  );
}
