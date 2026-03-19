import { useState, useEffect, useCallback, useRef } from 'react';

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}

let idCounter = 0;
function uid(): string {
  return `cl-${++idCounter}-${Date.now()}`;
}

export function useChecklists() {
  const [lists, setLists] = useState<Checklist[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const loaded = useRef(false);

  // Load on mount
  useEffect(() => {
    window.vibeAPI.checklists.load().then((raw: string) => {
      try {
        const parsed = JSON.parse(raw || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          setLists(parsed);
          setActiveListId(parsed[0].id);
        }
      } catch { /* ignore */ }
      loaded.current = true;
    });
  }, []);

  // Save on change (debounced)
  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => {
      window.vibeAPI.checklists.save(JSON.stringify(lists));
    }, 500);
    return () => clearTimeout(timer);
  }, [lists]);

  const addList = useCallback(() => {
    const id = uid();
    const newList: Checklist = { id, name: `List ${lists.length + 1}`, items: [] };
    setLists((prev) => [...prev, newList]);
    setActiveListId(id);
  }, [lists.length]);

  const removeList = useCallback((id: string) => {
    setLists((prev) => {
      const next = prev.filter((l) => l.id !== id);
      if (activeListId === id) {
        setActiveListId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  }, [activeListId]);

  const renameList = useCallback((id: string, name: string) => {
    setLists((prev) => prev.map((l) => l.id === id ? { ...l, name } : l));
  }, []);

  const addItem = useCallback((listId: string, text: string) => {
    setLists((prev) => prev.map((l) =>
      l.id === listId ? { ...l, items: [...l.items, { id: uid(), text, done: false }] } : l
    ));
  }, []);

  const toggleItem = useCallback((listId: string, itemId: string) => {
    setLists((prev) => prev.map((l) =>
      l.id === listId ? { ...l, items: l.items.map((i) => i.id === itemId ? { ...i, done: !i.done } : i) } : l
    ));
  }, []);

  const removeItem = useCallback((listId: string, itemId: string) => {
    setLists((prev) => prev.map((l) =>
      l.id === listId ? { ...l, items: l.items.filter((i) => i.id !== itemId) } : l
    ));
  }, []);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);

  return {
    lists, activeListId, setActiveListId, isOpen,
    addList, removeList, renameList,
    addItem, toggleItem, removeItem,
    toggle, close,
  };
}
