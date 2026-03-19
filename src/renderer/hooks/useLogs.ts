import { useState, useEffect, useCallback } from 'react';
import { LogEntry } from '../../shared/types';
import { LogFilter } from '../lib/types';

const MAX_LOGS = 500;

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<LogFilter>('all');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const cleanup = window.vibeAPI.logs.onEntry((entry) => {
      setLogs((prev) => {
        const next = [...prev, entry];
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
      });
    });
    return cleanup;
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    if (filter === 'errors') return log.type === 'error' || log.type === 'network-error';
    if (filter === 'network') return log.type.startsWith('network-');
    if (filter === 'console') return ['log', 'warn', 'error', 'info'].includes(log.type);
    return true;
  });

  const clearLogs = useCallback(() => setLogs([]), []);
  const toggleOpen = useCallback(() => setIsOpen((v) => !v), []);

  return { logs: filteredLogs, allLogs: logs, filter, setFilter, isOpen, toggleOpen, clearLogs };
}
