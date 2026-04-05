import { useState, useEffect, useCallback, useRef } from 'react';

export type TaskStatus = 'ideas' | 'todo' | 'in_progress' | 'done';

export interface TaskComment {
  id: string;
  text: string;
  timestamp: number;
}

export interface Task {
  id: string;
  listId: string;
  title: string;
  body: string;
  status: TaskStatus;
  category: string;
  images: string[];
  comments: TaskComment[];
  order: number;
}

export interface TaskList {
  id: string;
  name: string;
}

export interface TaskStore {
  lists: TaskList[];
  tasks: Task[];
}

let idCounter = 0;
function uid(): string {
  return `task-${++idCounter}-${Date.now()}`;
}

const EMPTY_STORE: TaskStore = { lists: [], tasks: [] };

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export function useTasks() {
  const [store, setStore] = useState<TaskStore>(EMPTY_STORE);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TaskStatus>('todo');
  const loaded = useRef(false);

  // Load on mount
  useEffect(() => {
    window.vibeAPI.tasks.load().then((raw: string) => {
      try {
        const parsed: TaskStore = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.lists) && parsed.lists.length > 0) {
          setStore(parsed);
          setActiveListId(parsed.lists[0].id);
          loaded.current = true;
          return;
        }
      } catch { /* ignore */ }
      // Default: create "Project 1"
      const defaultId = uid();
      const defaultStore: TaskStore = { lists: [{ id: defaultId, name: 'Project 1' }], tasks: [] };
      setStore(defaultStore);
      setActiveListId(defaultId);
      loaded.current = true;
    });
  }, []);

  // Save on change (debounced 500ms)
  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => {
      window.vibeAPI.tasks.save(JSON.stringify(store));
    }, 500);
    return () => clearTimeout(timer);
  }, [store]);

  // --- List CRUD ---

  const addList = useCallback(() => {
    const id = uid();
    const newList: TaskList = { id, name: `Project ${store.lists.length + 1}` };
    setStore((prev) => ({ ...prev, lists: [...prev.lists, newList] }));
    setActiveListId(id);
    return id;
  }, [store.lists.length]);

  const removeList = useCallback((id: string) => {
    setStore((prev) => ({
      lists: prev.lists.filter((l) => l.id !== id),
      tasks: prev.tasks.filter((t) => t.listId !== id),
    }));
    setActiveListId((curr) => {
      if (curr !== id) return curr;
      const remaining = store.lists.filter((l) => l.id !== id);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }, [store.lists]);

  const renameList = useCallback((id: string, name: string) => {
    setStore((prev) => ({
      ...prev,
      lists: prev.lists.map((l) => l.id === id ? { ...l, name } : l),
    }));
  }, []);

  // --- Task CRUD ---

  const addTask = useCallback((listId: string, status?: TaskStatus): string => {
    const id = uid();
    const tasksInStatus = store.tasks.filter((t) => t.listId === listId && t.status === (status || activeFilter));
    const order = tasksInStatus.length > 0
      ? Math.max(...tasksInStatus.map((t) => t.order)) + 1
      : 0;
    const newTask: Task = {
      id,
      listId,
      title: '',
      body: '',
      status: status || activeFilter,
      category: '',
      images: [],
      comments: [],
      order,
    };
    setStore((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    return id;
  }, [store.tasks, activeFilter]);

  const updateTask = useCallback((taskId: string, updates: Partial<Pick<Task, 'title' | 'body' | 'status' | 'category' | 'images' | 'order'>>) => {
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t),
    }));
  }, []);

  const deleteTask = useCallback((taskId: string) => {
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  }, []);

  // --- Status change ---

  const setTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    setStore((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      // Get max order in target status
      const tasksInTarget = prev.tasks.filter((t) => t.listId === task.listId && t.status === status && t.id !== taskId);
      const maxOrder = tasksInTarget.length > 0 ? Math.max(...tasksInTarget.map((t) => t.order)) + 1 : 0;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, status, order: maxOrder } : t),
      };
    });
  }, []);

  // --- Checkbox (mark done) ---

  const toggleDone = useCallback((taskId: string) => {
    setStore((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
      const tasksInTarget = prev.tasks.filter((t) => t.listId === task.listId && t.status === newStatus && t.id !== taskId);
      const maxOrder = tasksInTarget.length > 0 ? Math.max(...tasksInTarget.map((t) => t.order)) + 1 : 0;
      return {
        ...prev,
        tasks: prev.tasks.map((t) => t.id === taskId ? { ...t, status: newStatus, order: maxOrder } : t),
      };
    });
  }, []);

  // --- Reorder within same status ---

  const reorderTask = useCallback((taskId: string, newOrder: number) => {
    setStore((prev) => {
      const task = prev.tasks.find((t) => t.id === taskId);
      if (!task) return prev;
      const siblings = prev.tasks
        .filter((t) => t.listId === task.listId && t.status === task.status && t.id !== taskId)
        .sort((a, b) => a.order - b.order);
      // Insert at newOrder position
      siblings.splice(newOrder, 0, task);
      const reordered = siblings.map((t, i) => ({ ...t, order: i }));
      const otherTasks = prev.tasks.filter((t) => !(t.listId === task.listId && t.status === task.status));
      return { ...prev, tasks: [...otherTasks, ...reordered] };
    });
  }, []);

  // --- Comments ---

  const addComment = useCallback((taskId: string, text: string) => {
    const comment: TaskComment = { id: uid(), text, timestamp: Date.now() };
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t
      ),
    }));
  }, []);

  // --- Images ---

  const addImage = useCallback((taskId: string, dataUrl: string) => {
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, images: [...t.images].concat(dataUrl).slice(0, 10) } : t
      ),
    }));
  }, []);

  const removeImage = useCallback((taskId: string, index: number) => {
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, images: t.images.filter((_, i) => i !== index) } : t
      ),
    }));
  }, []);

  const updateImage = useCallback((taskId: string, index: number, dataUrl: string) => {
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) =>
        t.id === taskId ? { ...t, images: t.images.map((img, i) => i === index ? dataUrl : img) } : t
      ),
    }));
  }, []);

  // --- Import from CSV ---

  const importTasksFromCsv = useCallback((listId: string, csv: string): number => {
    const lines = csv.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return 0; // need header + at least one row

    // Parse header to find column indices
    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const titleIdx = header.findIndex((h) => h === 'title' || h === 'name' || h === 'task');
    const bodyIdx = header.findIndex((h) => h === 'body' || h === 'description' || h === 'details' || h === 'notes');
    const statusIdx = header.findIndex((h) => h === 'status' || h === 'state');
    const categoryIdx = header.findIndex((h) => h === 'category' || h === 'group' || h === 'tag');

    if (titleIdx === -1) return 0; // must have a title column

    const validStatuses: Record<string, TaskStatus> = {
      'ideas': 'ideas', 'idea': 'ideas',
      'todo': 'todo', 'to do': 'todo', 'to-do': 'todo',
      'in progress': 'in_progress', 'in_progress': 'in_progress', 'inprogress': 'in_progress', 'wip': 'in_progress',
      'done': 'done', 'complete': 'done', 'completed': 'done',
    };

    const newTasks: Task[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const title = cols[titleIdx]?.trim();
      if (!title) continue;

      const rawStatus = statusIdx >= 0 ? cols[statusIdx]?.trim().toLowerCase() : '';
      const status: TaskStatus = validStatuses[rawStatus] || activeFilter;

      newTasks.push({
        id: uid(),
        listId,
        title,
        body: bodyIdx >= 0 ? (cols[bodyIdx]?.trim() || '') : '',
        status,
        category: categoryIdx >= 0 ? (cols[categoryIdx]?.trim() || '') : '',
        images: [],
        comments: [],
        order: i - 1,
      });
    }

    if (newTasks.length === 0) return 0;

    setStore((prev) => {
      // Offset orders by existing task count per status
      const adjusted = newTasks.map((t) => {
        const existing = prev.tasks.filter((e) => e.listId === listId && e.status === t.status);
        const maxOrder = existing.length > 0 ? Math.max(...existing.map((e) => e.order)) + 1 : 0;
        return { ...t, order: t.order + maxOrder };
      });
      return { ...prev, tasks: [...prev.tasks, ...adjusted] };
    });

    return newTasks.length;
  }, [activeFilter]);

  // --- Clear done ---

  const clearDone = useCallback((listId: string) => {
    setStore((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => !(t.listId === listId && t.status === 'done')),
    }));
  }, []);

  // --- Derived data ---

  const getFilteredTasks = useCallback((listId: string, status: TaskStatus): Task[] => {
    return store.tasks
      .filter((t) => t.listId === listId && t.status === status)
      .sort((a, b) => a.order - b.order);
  }, [store.tasks]);

  const getStatusCounts = useCallback((listId: string): Record<TaskStatus, number> => {
    const counts: Record<TaskStatus, number> = { ideas: 0, todo: 0, in_progress: 0, done: 0 };
    for (const t of store.tasks) {
      if (t.listId === listId) counts[t.status]++;
    }
    return counts;
  }, [store.tasks]);

  const getNonDoneCount = useCallback((): number => {
    return store.tasks.filter((t) => t.status !== 'done').length;
  }, [store.tasks]);

  return {
    store,
    activeListId, setActiveListId,
    activeFilter, setActiveFilter,
    // Lists
    addList, removeList, renameList,
    // Tasks
    addTask, updateTask, deleteTask,
    setTaskStatus, toggleDone, reorderTask,
    // Comments
    addComment,
    // Images
    addImage, removeImage, updateImage,
    // Bulk
    clearDone, importTasksFromCsv,
    // Derived
    getFilteredTasks, getStatusCounts, getNonDoneCount,
  };
}
