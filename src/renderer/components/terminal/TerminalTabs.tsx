import { useState, useRef, useCallback } from 'react';
import { TabState } from '../../lib/types';

interface Props {
  tabs: TabState[];
  activeTabId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleNotes: () => void;
  onToggleMd: () => void;
  onToggleChecklists: () => void;
  notesOpen: boolean;
  mdOpen: boolean;
  checklistsOpen: boolean;
}

export default function TerminalTabs({
  tabs,
  activeTabId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
  onReorder,
  onToggleNotes,
  onToggleMd,
  onToggleChecklists,
  notesOpen,
  mdOpen,
  checklistsOpen,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const editRef = useRef<HTMLSpanElement>(null);

  const handleDoubleClick = useCallback((id: string) => {
    setEditingId(id);
    setTimeout(() => {
      if (editRef.current) {
        editRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(editRef.current);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);
  }, []);

  const handleEditBlur = useCallback(
    (id: string) => {
      if (editRef.current) {
        const text = editRef.current.textContent?.trim();
        if (text) onRename(id, text);
      }
      setEditingId(null);
    },
    [onRename],
  );

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEditBlur(id);
      } else if (e.key === 'Escape') {
        setEditingId(null);
      }
    },
    [handleEditBlur],
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 'var(--tab-height)',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        paddingLeft: 0,
        // @ts-expect-error Electron-specific CSS property
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      }}
    >
      {/* Logo — visible only in fullscreen (traffic lights hidden) */}
      <div style={{ width: 76, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <img
          src={require('../../../../assets/sunglasses.png')}
          alt=""
          className="fullscreen-logo"
          style={{ height: 14, objectFit: 'contain', opacity: 0.85 }}
        />
      </div>

      {/* Scrollable tabs area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          height: '100%',
          scrollbarWidth: 'none',
        }}
        // Hide scrollbar via inline workaround
        ref={(el) => {
          if (el) el.style.setProperty('-ms-overflow-style', 'none');
        }}
      >
        <style>{`.tab-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div className="tab-scroll" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                draggable
                onDragStart={() => setDragIndex(idx)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== idx) {
                    onReorder(dragIndex, idx);
                  }
                  setDragIndex(null);
                }}
                onClick={() => onSelect(tab.id)}
                onDoubleClick={() => handleDoubleClick(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '0 12px',
                  height: '100%',
                  background: isActive ? 'var(--bg-primary)' : 'transparent',
                  borderTop: isActive ? '1px solid var(--border)' : '1px solid transparent',
                  borderLeft: isActive ? '1px solid var(--border)' : '1px solid transparent',
                  borderRight: isActive ? '1px solid var(--border)' : '1px solid transparent',
                  borderBottom: isActive ? '1px solid var(--bg-primary)' : '1px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  // @ts-expect-error Electron-specific CSS property
                  WebkitAppRegion: 'no-drag',
                }}
              >
                {tab.hasActivity && !isActive && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--accent-green)',
                      flexShrink: 0,
                    }}
                  />
                )}
                {editingId === tab.id ? (
                  <span
                    ref={editRef}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={() => handleEditBlur(tab.id)}
                    onKeyDown={(e) => handleEditKeyDown(e, tab.id)}
                    style={{ outline: 'none', minWidth: 40 }}
                  >
                    {tab.title}
                  </span>
                ) : (
                  <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tab.title}
                  </span>
                )}
                {(
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('This will terminate the running process.')) {
                        onRemove(tab.id);
                      }
                    }}
                    style={{
                      width: 16,
                      height: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: 12,
                      borderRadius: 4,
                      opacity: 0.6,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}

          {/* Add tab button */}
          <button
            onClick={onAdd}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: 16,
              borderRadius: 6,
              marginLeft: 4,
              flexShrink: 0,
              // @ts-expect-error Electron-specific CSS property
              WebkitAppRegion: 'no-drag',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            +
          </button>
        </div>
      </div>

      {/* Pinned right side: MDs + Notes */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          paddingLeft: 8,
          paddingRight: 8,
          flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          height: '100%',
          alignItems: 'center',
          // @ts-expect-error Electron-specific CSS property
          WebkitAppRegion: 'no-drag',
        }}
      >
        <button
          onClick={onToggleMd}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 'var(--font-size-sm)',
            color: mdOpen ? 'var(--accent-cyan)' : 'var(--text-muted)',
            background: mdOpen ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
          }}
          onMouseEnter={(e) => { if (!mdOpen) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
          onMouseLeave={(e) => { if (!mdOpen) e.currentTarget.style.background = 'transparent'; }}
        >
          MDs
        </button>
        <button
          onClick={onToggleChecklists}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 'var(--font-size-sm)',
            color: checklistsOpen ? 'var(--accent-yellow)' : 'var(--text-muted)',
            background: checklistsOpen ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
          }}
          onMouseEnter={(e) => { if (!checklistsOpen) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
          onMouseLeave={(e) => { if (!checklistsOpen) e.currentTarget.style.background = 'transparent'; }}
        >
          Checklists
        </button>
        <button
          onClick={onToggleNotes}
          style={{
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 'var(--font-size-sm)',
            color: notesOpen ? 'var(--accent-green)' : 'var(--text-muted)',
            background: notesOpen ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
          }}
          onMouseEnter={(e) => { if (!notesOpen) e.currentTarget.style.background = 'var(--bg-tertiary)'; }}
          onMouseLeave={(e) => { if (!notesOpen) e.currentTarget.style.background = 'transparent'; }}
        >
          Notes
        </button>
      </div>
    </div>
  );
}
