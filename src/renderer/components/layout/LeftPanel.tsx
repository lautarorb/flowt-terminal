import { useCallback, forwardRef } from 'react';
import { TabState } from '../../lib/types';
import TerminalTabs from '../terminal/TerminalTabs';
import TerminalView from '../terminal/TerminalView';
import QuickResponse from '../terminal/QuickResponse';
import InputBar, { InputBarHandle } from '../terminal/InputBar';
import NotesPanel from '../panels/NotesPanel';
import MarkdownPanel from '../panels/MarkdownPanel';
import ChecklistPanel from '../panels/ChecklistPanel';
import { Checklist } from '../../hooks/useChecklists';

interface Props {
  tabs: TabState[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onAddTab: () => void;
  onRemoveTab: (id: string) => void;
  onRenameTab: (id: string, title: string) => void;
  onReorderTabs: (from: number, to: number) => void;
  onTabActivity: (id: string, hasActivity: boolean) => void;
  notesContent: string;
  notesOpen: boolean;
  onNotesChange: (content: string) => void;
  onNotesToggle: () => void;
  onNotesClose: () => void;
  mdOpen: boolean;
  onMdToggle: () => void;
  onMdClose: () => void;
  checklistsOpen: boolean;
  onChecklistsToggle: () => void;
  onChecklistsClose: () => void;
  checklists: Checklist[];
  activeChecklistId: string | null;
  onSelectChecklist: (id: string) => void;
  onAddChecklist: () => void;
  onRemoveChecklist: (id: string) => void;
  onRenameChecklist: (id: string, name: string) => void;
  onAddChecklistItem: (listId: string, text: string) => void;
  onToggleChecklistItem: (listId: string, itemId: string) => void;
  onRemoveChecklistItem: (listId: string, itemId: string) => void;
}

const LeftPanel = forwardRef<InputBarHandle, Props>(({
  tabs,
  activeTabId,
  onSelectTab,
  onAddTab,
  onRemoveTab,
  onRenameTab,
  onReorderTabs,
  onTabActivity,
  notesContent,
  notesOpen,
  onNotesChange,
  onNotesToggle,
  onNotesClose,
  mdOpen,
  onMdToggle,
  onMdClose,
  checklistsOpen,
  onChecklistsToggle,
  onChecklistsClose,
  checklists,
  activeChecklistId,
  onSelectChecklist,
  onAddChecklist,
  onRemoveChecklist,
  onRenameChecklist,
  onAddChecklistItem,
  onToggleChecklistItem,
  onRemoveChecklistItem,
}, ref) => {
  const handlePtyData = useCallback(
    (tabId: string) => {
      if (tabId !== activeTabId) {
        onTabActivity(tabId, true);
      }
    },
    [activeTabId, onTabActivity],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-primary)',
        position: 'relative',
      }}
    >
      <TerminalTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onSelect={onSelectTab}
        onAdd={onAddTab}
        onRemove={onRemoveTab}
        onRename={onRenameTab}
        onReorder={onReorderTabs}
        onToggleNotes={onNotesToggle}
        onToggleMd={onMdToggle}
        onToggleChecklists={onChecklistsToggle}
        notesOpen={notesOpen}
        mdOpen={mdOpen}
        checklistsOpen={checklistsOpen}
      />

      {/* Terminal area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {tabs.map((tab) => (
          <TerminalView
            key={tab.id}
            tabId={tab.id}
            isActive={tab.id === activeTabId}
            onData={handlePtyData}
          />
        ))}

        {/* Floating panels */}
        {notesOpen && (
          <NotesPanel
            content={notesContent}
            onChange={onNotesChange}
            onClose={onNotesClose}
          />
        )}
        {checklistsOpen && (
          <ChecklistPanel
            lists={checklists}
            activeListId={activeChecklistId}
            onSelectList={onSelectChecklist}
            onAddList={onAddChecklist}
            onRemoveList={onRemoveChecklist}
            onRenameList={onRenameChecklist}
            onAddItem={onAddChecklistItem}
            onToggleItem={onToggleChecklistItem}
            onRemoveItem={onRemoveChecklistItem}
            onClose={onChecklistsClose}
          />
        )}
        {mdOpen && <MarkdownPanel activeTabId={activeTabId} onClose={onMdClose} />}
      </div>

      {/* Quick response popup */}
      <QuickResponse activeTabId={activeTabId} />

      {/* Chat input bar */}
      <InputBar ref={ref} activeTabId={activeTabId} />
    </div>
  );
});

LeftPanel.displayName = 'LeftPanel';
export default LeftPanel;
