import { useState, useEffect, useCallback, useRef } from 'react';

export function useNotes() {
  const [content, setContent] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.vibeAPI.notes.load().then((saved) => {
      if (saved) setContent(saved);
    });
  }, []);

  const updateContent = useCallback((newContent: string) => {
    setContent(newContent);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.vibeAPI.notes.save(newContent);
    }, 1000);
  }, []);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { content, isOpen, updateContent, toggle, close };
}
