import { useState, useEffect, useCallback, useRef } from 'react';

export type TaskStatus = 'ideas' | 'todo' | 'in_progress' | 'done';

export interface TaskComment {
  timestamp: string; // "YYYY-MM-DD HH:MM"
  text: string;
}

export interface Task {
  id: string;
  title: string;
  body: string;
  status: TaskStatus;
  category: string;
  images: string[];
  feedback: TaskComment[];
  comments: TaskComment[];
  order: number;
}

export interface MdTaskFileState {
  generated: string;
  spec: string;
  tasks: Task[];
}

type LoadStatus = 'loading' | 'ok' | 'not_found' | 'error' | 'parse_error';

function nowTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function generateTaskId(tasks: Task[]): string {
  let maxNum = 0;
  for (const t of tasks) {
    const match = t.id.match(/^task-(\d+)$/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNum) maxNum = num;
    }
  }
  return `task-${String(maxNum + 1).padStart(3, '0')}`;
}

// Convert internal state to the MdTaskFile format for writing
function toMdFile(state: MdTaskFileState): any {
  return {
    generated: state.generated,
    spec: state.spec,
    tasks: state.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      category: t.category,
      body: t.body,
      feedback: t.feedback,
      comments: t.comments,
    })),
  };
}

// Convert parsed MdTaskFile to internal state
function fromMdFile(parsed: any): MdTaskFileState {
  return {
    generated: parsed.generated || '',
    spec: parsed.spec || '',
    tasks: (parsed.tasks || []).map((t: any, i: number) => ({
      id: t.id,
      title: t.title,
      body: t.body,
      status: t.status,
      category: t.category,
      images: [] as string[],
      feedback: t.feedback || [],
      comments: t.comments || [],
      order: i,
    })),
  };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

const EMPTY_STATE: MdTaskFileState = { generated: '', spec: '', tasks: [] };

export function useTasks(activeTabId: string) {
  const [state, setState] = useState<MdTaskFileState>(EMPTY_STATE);
  const [activeFilter, setActiveFilter] = useState<TaskStatus>('todo');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [cwd, setCwd] = useState('');
  const cwdRef = useRef('');
  const loaded = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Persistence helpers ---

  const save = useCallback((newState: MdTaskFileState) => {
    setState(newState);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.vibeAPI.tasks.saveMd(activeTabId, JSON.stringify(toMdFile(newState)));
    }, 300);
  }, [activeTabId]);

  // --- Load function ---

  const loadFromCwd = useCallback(() => {
    window.vibeAPI.tasks.loadMd(activeTabId).then((raw: string) => {
      try {
        const result = JSON.parse(raw);
        if (result.status === 'ok') {
          setState(fromMdFile(result.data));
          setCwd(result.cwd); cwdRef.current = result.cwd;
          setLoadStatus('ok');
        } else if (result.status === 'not_found') {
          setState(EMPTY_STATE);
          setCwd(result.cwd); cwdRef.current = result.cwd;
          setLoadStatus('not_found');
        } else {
          setErrorMessage(result.error || 'Unknown error');
          setLoadStatus('error');
        }
      } catch {
        setLoadStatus('parse_error');
        setErrorMessage('Failed to parse response');
      }
      loaded.current = true;
    });
  }, [activeTabId]);

  // --- Load on mount and when tab changes ---

  useEffect(() => {
    loaded.current = false;
    setLoadStatus('loading');
    loadFromCwd();

    // Start watching
    window.vibeAPI.tasks.watchMd(activeTabId);

    // Listen for external changes
    const cleanup = window.vibeAPI.tasks.onMdChanged((data: string) => {
      try {
        const parsed = JSON.parse(data);
        setState(fromMdFile(parsed));
        setLoadStatus('ok');
      } catch { /* ignore bad data */ }
    });

    return cleanup;
  }, [activeTabId, loadFromCwd]);

  // --- Poll CWD for changes (user may cd after mount) ---

  useEffect(() => {
    const interval = setInterval(() => {
      window.vibeAPI.app.getCwd(activeTabId).then((newCwd) => {
        if (newCwd && newCwd !== cwdRef.current) {
          loadFromCwd();
          window.vibeAPI.tasks.watchMd(activeTabId);
        }
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [activeTabId, loadFromCwd]);

  // --- Reload ---

  const reload = useCallback(() => {
    setLoadStatus('loading');
    window.vibeAPI.tasks.loadMd(activeTabId).then((raw: string) => {
      try {
        const result = JSON.parse(raw);
        if (result.status === 'ok') {
          setState(fromMdFile(result.data));
          setCwd(result.cwd);
          setLoadStatus('ok');
        } else if (result.status === 'not_found') {
          setState(EMPTY_STATE);
          setLoadStatus('not_found');
        } else {
          setErrorMessage(result.error || 'Unknown error');
          setLoadStatus('error');
        }
      } catch {
        setLoadStatus('parse_error');
      }
    });
  }, [activeTabId]);

  // --- Task CRUD ---

  const addTask = useCallback((status?: TaskStatus): string => {
    const id = generateTaskId(state.tasks);
    const newTask: Task = {
      id,
      title: '',
      body: '',
      status: status || activeFilter,
      category: '',
      images: [],
      feedback: [],
      comments: [],
      order: state.tasks.length,
    };
    const newState: MdTaskFileState = {
      ...state,
      generated: state.generated || new Date().toISOString().slice(0, 10),
      tasks: [...state.tasks, newTask],
    };
    save(newState);
    setLoadStatus('ok'); // file will be created on first save
    return id;
  }, [state, activeFilter, save]);

  const updateTask = useCallback((taskId: string, updates: Partial<Pick<Task, 'title' | 'body' | 'status' | 'category'>>) => {
    const newState = {
      ...state,
      tasks: state.tasks.map((t) => t.id === taskId ? { ...t, ...updates } : t),
    };
    save(newState);
  }, [state, save]);

  const deleteTask = useCallback((taskId: string) => {
    const newState = {
      ...state,
      tasks: state.tasks.filter((t) => t.id !== taskId),
    };
    save(newState);
  }, [state, save]);

  // --- Status change ---

  const setTaskStatus = useCallback((taskId: string, status: TaskStatus) => {
    const newState = {
      ...state,
      tasks: state.tasks.map((t) => t.id === taskId ? { ...t, status } : t),
    };
    save(newState);
  }, [state, save]);

  const toggleDone = useCallback((taskId: string) => {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    const newState = {
      ...state,
      tasks: state.tasks.map((t) => t.id === taskId ? { ...t, status: newStatus } : t),
    };
    save(newState);
  }, [state, save]);

  // --- Reorder ---

  const reorderTask = useCallback((taskId: string, newIndex: number) => {
    const taskIndex = state.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;
    const tasks = [...state.tasks];
    const [moved] = tasks.splice(taskIndex, 1);
    tasks.splice(newIndex, 0, moved);
    save({ ...state, tasks: tasks.map((t, i) => ({ ...t, order: i })) });
  }, [state, save]);

  // --- Comments ---

  const addComment = useCallback((taskId: string, text: string) => {
    const entry: TaskComment = { timestamp: nowTimestamp(), text };
    const newState = {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, comments: [...t.comments, entry] } : t
      ),
    };
    save(newState);
  }, [state, save]);

  // --- Feedback ---

  const addFeedback = useCallback((taskId: string, text: string) => {
    const entry: TaskComment = { timestamp: nowTimestamp(), text };
    const newState = {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, feedback: [...t.feedback, entry] } : t
      ),
    };
    save(newState);
  }, [state, save]);

  // --- Images ---

  const addImage = useCallback((taskId: string, dataUrl: string) => {
    const newState = {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, images: [...t.images, dataUrl].slice(0, 10) } : t
      ),
    };
    save(newState);
  }, [state, save]);

  const removeImage = useCallback((taskId: string, index: number) => {
    const newState = {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, images: t.images.filter((_, i) => i !== index) } : t
      ),
    };
    save(newState);
  }, [state, save]);

  const updateImage = useCallback((taskId: string, index: number, dataUrl: string) => {
    const newState = {
      ...state,
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, images: t.images.map((img, i) => i === index ? dataUrl : img) } : t
      ),
    };
    save(newState);
  }, [state, save]);

  // --- Clear done ---

  const clearDone = useCallback(() => {
    const newState = {
      ...state,
      tasks: state.tasks.filter((t) => t.status !== 'done'),
    };
    save(newState);
  }, [state, save]);

  // --- Import CSV ---

  const importTasksFromCsv = useCallback((csv: string): number => {
    const lines = csv.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length < 2) return 0;

    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const titleIdx = header.findIndex((h) => h === 'title' || h === 'name' || h === 'task');
    const bodyIdx = header.findIndex((h) => h === 'body' || h === 'description' || h === 'details' || h === 'notes');
    const statusIdx = header.findIndex((h) => h === 'status' || h === 'state');
    const categoryIdx = header.findIndex((h) => h === 'category' || h === 'group' || h === 'tag');
    if (titleIdx === -1) return 0;

    const validStatuses: Record<string, TaskStatus> = {
      'ideas': 'ideas', 'idea': 'ideas',
      'todo': 'todo', 'to do': 'todo', 'to-do': 'todo',
      'in progress': 'in_progress', 'in_progress': 'in_progress', 'inprogress': 'in_progress', 'wip': 'in_progress',
      'done': 'done', 'complete': 'done', 'completed': 'done',
    };

    let existingTasks = [...state.tasks];
    const newTasks: Task[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const title = cols[titleIdx]?.trim();
      if (!title) continue;
      const rawStatus = statusIdx >= 0 ? cols[statusIdx]?.trim().toLowerCase() : '';
      const id = generateTaskId([...existingTasks, ...newTasks]);
      newTasks.push({
        id,
        title,
        body: bodyIdx >= 0 ? (cols[bodyIdx]?.trim() || '') : '',
        status: validStatuses[rawStatus] || activeFilter,
        category: categoryIdx >= 0 ? (cols[categoryIdx]?.trim() || '') : '',
        images: [],
        feedback: [],
        comments: [],
        order: existingTasks.length + newTasks.length,
      });
    }

    if (newTasks.length === 0) return 0;
    const newState: MdTaskFileState = {
      ...state,
      generated: state.generated || new Date().toISOString().slice(0, 10),
      tasks: [...state.tasks, ...newTasks],
    };
    save(newState);
    setLoadStatus('ok');
    return newTasks.length;
  }, [state, activeFilter, save]);

  // --- Send to terminal helper ---

  const markSentToTerminal = useCallback((taskId: string) => {
    const comment: TaskComment = { timestamp: nowTimestamp(), text: 'Sent to terminal' };
    const newState = {
      ...state,
      tasks: state.tasks.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          status: t.status === 'todo' ? 'in_progress' as TaskStatus : t.status,
          comments: [...t.comments, comment],
        };
      }),
    };
    save(newState);
  }, [state, save]);

  // --- Derived data ---

  const getFilteredTasks = useCallback((status: TaskStatus): Task[] => {
    return state.tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.order - b.order);
  }, [state.tasks]);

  const getStatusCounts = useCallback((): Record<TaskStatus, number> => {
    const counts: Record<TaskStatus, number> = { ideas: 0, todo: 0, in_progress: 0, done: 0 };
    for (const t of state.tasks) counts[t.status]++;
    return counts;
  }, [state.tasks]);

  const getNonDoneCount = useCallback((): number => {
    return state.tasks.filter((t) => t.status !== 'done').length;
  }, [state.tasks]);

  return {
    state, loadStatus, errorMessage, cwd,
    activeFilter, setActiveFilter,
    reload,
    // Tasks
    addTask, updateTask, deleteTask,
    setTaskStatus, toggleDone, reorderTask,
    // Comments & Feedback
    addComment, addFeedback,
    // Images
    addImage, removeImage, updateImage,
    // Bulk
    clearDone, importTasksFromCsv,
    // Send to terminal
    markSentToTerminal,
    // Derived
    getFilteredTasks, getStatusCounts, getNonDoneCount,
  };
}
