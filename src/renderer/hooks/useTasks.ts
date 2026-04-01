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
      images: [],
      comments: [],
      order,
    };
    setStore((prev) => ({ ...prev, tasks: [...prev.tasks, newTask] }));
    return id;
  }, [store.tasks, activeFilter]);

  const updateTask = useCallback((taskId: string, updates: Partial<Pick<Task, 'title' | 'body' | 'status' | 'images' | 'order'>>) => {
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
    clearDone,
    // Derived
    getFilteredTasks, getStatusCounts, getNonDoneCount,
  };
}
