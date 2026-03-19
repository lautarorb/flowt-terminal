import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Checklist } from '../../hooks/useChecklists';

interface Props {
  lists: Checklist[];
  activeListId: string | null;
  onSelectList: (id: string) => void;
  onAddList: () => void;
  onRemoveList: (id: string) => void;
  onRenameList: (id: string, name: string) => void;
  onAddItem: (listId: string, text: string) => void;
  onToggleItem: (listId: string, itemId: string) => void;
  onRemoveItem: (listId: string, itemId: string) => void;
  onClose: () => void;
}

export default function ChecklistPanel({
  lists, activeListId, onSelectList, onAddList, onRemoveList, onRenameList,
  onAddItem, onToggleItem, onRemoveItem, onClose,
}: Props) {
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editRef = useRef<HTMLSpanElement>(null);

  const activeList = lists.find((l) => l.id === activeListId) || null;

  const handleAdd = useCallback(() => {
    const text = inputValue.trim();
    if (!text || !activeListId) return;
    onAddItem(activeListId, text);
    setInputValue('');
    inputRef.current?.focus();
  }, [inputValue, activeListId, onAddItem]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
  }, [handleAdd]);

  const handleRenameStart = useCallback((id: string) => {
    setEditingId(id);
    setTimeout(() => {
      if (editRef.current) {
        editRef.current.focus();
        const range = document.createRange();
        range.selectNodeContents(editRef.current);
        window.getSelection()?.removeAllRanges();
        window.getSelection()?.addRange(range);
      }
    }, 0);
  }, []);

  const handleRenameEnd = useCallback((id: string) => {
    const text = editRef.current?.textContent?.trim();
    if (text) onRenameList(id, text);
    setEditingId(null);
  }, [onRenameList]);

  return (
    <div
      style={{
        width: 320,
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>// checklists</span>
        <button
          onClick={onClose}
          style={{ color: 'var(--text-muted)', fontSize: 14 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ×
        </button>
      </div>

      {/* List tabs */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', overflowX: 'auto', scrollbarWidth: 'none', flexShrink: 0 }}>
        {lists.map((list) => (
          <div
            key={list.id}
            onClick={() => onSelectList(list.id)}
            onDoubleClick={() => handleRenameStart(list.id)}
            style={{
              padding: '6px 10px',
              fontSize: 'var(--font-size-sm)',
              color: list.id === activeListId ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: list.id === activeListId ? '2px solid var(--text-secondary)' : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            {editingId === list.id ? (
              <span
                ref={editRef}
                contentEditable
                suppressContentEditableWarning
                onBlur={() => handleRenameEnd(list.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameEnd(list.id); } }}
                style={{ outline: 'none', minWidth: 30 }}
              >
                {list.name}
              </span>
            ) : (
              <span>{list.name}</span>
            )}
            {lists.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemoveList(list.id); }}
                style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0.5, lineHeight: 1 }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.5'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={onAddList}
          style={{ padding: '6px 8px', color: 'var(--text-muted)', fontSize: 14, flexShrink: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          +
        </button>
      </div>

      {/* Items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {activeList && activeList.items.length === 0 && (
          <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)', textAlign: 'center' }}>
            No items yet
          </div>
        )}
        {activeList?.items.map((item) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              fontSize: 'var(--font-size-ui)',
            }}
          >
            <input
              type="checkbox"
              checked={item.done}
              onChange={() => onToggleItem(activeListId!, item.id)}
              style={{
                appearance: 'none',
                width: 14,
                height: 14,
                border: '1px solid var(--text-muted)',
                borderRadius: 3,
                background: 'transparent',
                backgroundImage: item.done ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M3 7l3 3 5-5' stroke='%2310B981' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")` : 'none',
                cursor: 'pointer',
                flexShrink: 0,
                position: 'relative',
              }}
            />
            <span style={{
              flex: 1,
              color: item.done ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: item.done ? 'line-through' : 'none',
              wordBreak: 'break-word',
            }}>
              {item.text}
            </span>
            <button
              onClick={() => onRemoveItem(activeListId!, item.id)}
              style={{ color: 'var(--text-muted)', fontSize: 10, opacity: 0, flexShrink: 0 }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--accent-red)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '0'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              ×
            </button>
          </div>
        ))}
        {activeList && activeList.items.some((i) => i.done) && (
          <button
            onClick={() => activeList.items.filter((i) => i.done).forEach((i) => onRemoveItem(activeListId!, i.id))}
            style={{
              padding: '6px 12px',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--text-muted)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-red)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Clear done
          </button>
        )}
      </div>

      {/* Add input */}
      {activeList && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add item..."
            style={{
              flex: 1,
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '4px 8px',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-size-sm)',
              outline: 'none',
            }}
          />
          <button
            onClick={handleAdd}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              background: inputValue.trim() ? 'var(--accent-yellow)' : 'var(--bg-tertiary)',
              color: inputValue.trim() ? '#000' : 'var(--text-muted)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 700,
            }}
          >
            +
          </button>
        </div>
      )}

      {/* Empty state — no lists */}
      {lists.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={onAddList}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            Create first checklist
          </button>
        </div>
      )}
    </div>
  );
}
