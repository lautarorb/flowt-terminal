import { useEffect, useCallback, useState, useRef } from 'react';
import { useTabs } from './hooks/useTabs';
import { usePreview } from './hooks/usePreview';
import { useNotes } from './hooks/useNotes';
import { useLogs } from './hooks/useLogs';
import { useChecklists } from './hooks/useChecklists';
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
  const [mdOpen, setMdOpen] = useState(false);
  const inputBarRef = useRef<InputBarHandle>(null);

  // Fullscreen detection — toggle body class for CSS
  useEffect(() => {
    const cleanup = window.vibeAPI.window.onFullscreenChanged((isFullscreen) => {
      document.body.classList.toggle('is-fullscreen', isFullscreen);
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
    return () => {
      cleanupNew();
      cleanupClose();
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
        />
      }
    />
  );
}
