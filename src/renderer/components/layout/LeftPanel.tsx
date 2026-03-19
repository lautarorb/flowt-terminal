import { useCallback, forwardRef } from 'react';
import { TabState } from '../../lib/types';
import TerminalTabs from '../terminal/TerminalTabs';
import TerminalView from '../terminal/TerminalView';
import QuickResponse from '../terminal/QuickResponse';
import InputBar, { InputBarHandle } from '../terminal/InputBar';
import NotesPanel from '../panels/NotesPanel';
import MarkdownPanel from '../panels/MarkdownPanel';

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
        notesOpen={notesOpen}
        mdOpen={mdOpen}
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
