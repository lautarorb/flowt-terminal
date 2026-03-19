import type { VibeAPI } from '../../preload/index';

declare global {
  interface Window {
    vibeAPI: VibeAPI;
  }
}

export type InputMode = 'chat' | 'terminal';

export interface TabState {
  id: string;
  title: string;
  hasActivity: boolean;
}

export type TabAction =
  | { type: 'ADD_TAB'; tab: TabState }
  | { type: 'REMOVE_TAB'; id: string }
  | { type: 'SET_ACTIVE'; id: string }
  | { type: 'RENAME_TAB'; id: string; title: string }
  | { type: 'SET_ACTIVITY'; id: string; hasActivity: boolean }
  | { type: 'REORDER_TABS'; fromIndex: number; toIndex: number };

export type LogFilter = 'all' | 'errors' | 'network' | 'console';
