import { useReducer, useCallback } from 'react';
import { TabState, TabAction } from '../lib/types';

interface TabsState {
  tabs: TabState[];
  activeTabId: string;
}

function tabsReducer(state: TabsState, action: TabAction): TabsState {
  switch (action.type) {
    case 'ADD_TAB':
      return {
        ...state,
        tabs: [...state.tabs, action.tab],
        activeTabId: action.tab.id,
      };
    case 'REMOVE_TAB': {
      const idx = state.tabs.findIndex((t) => t.id === action.id);
      const newTabs = state.tabs.filter((t) => t.id !== action.id);
      if (newTabs.length === 0) return state; // Don't remove last tab
      let newActive = state.activeTabId;
      if (state.activeTabId === action.id) {
        const newIdx = Math.min(idx, newTabs.length - 1);
        newActive = newTabs[newIdx].id;
      }
      return { tabs: newTabs, activeTabId: newActive };
    }
    case 'SET_ACTIVE':
      return {
        ...state,
        activeTabId: action.id,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, hasActivity: false } : t,
        ),
      };
    case 'RENAME_TAB':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, title: action.title } : t,
        ),
      };
    case 'SET_ACTIVITY':
      return {
        ...state,
        tabs: state.tabs.map((t) =>
          t.id === action.id ? { ...t, hasActivity: action.hasActivity } : t,
        ),
      };
    case 'REORDER_TABS': {
      const newTabs = [...state.tabs];
      const [moved] = newTabs.splice(action.fromIndex, 1);
      newTabs.splice(action.toIndex, 0, moved);
      return { ...state, tabs: newTabs };
    }
    default:
      return state;
  }
}

let tabCounter = 0;

export function createTabId(): string {
  return `tab-${++tabCounter}-${Date.now()}`;
}

export function useTabs() {
  const initialId = createTabId();
  const [state, dispatch] = useReducer(tabsReducer, {
    tabs: [{ id: initialId, title: 'Terminal 1', hasActivity: false }],
    activeTabId: initialId,
  });

  const addTab = useCallback(() => {
    const id = createTabId();
    dispatch({ type: 'ADD_TAB', tab: { id, title: `Terminal ${tabCounter}`, hasActivity: false } });
    return id;
  }, []);

  const removeTab = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TAB', id });
  }, []);

  const setActiveTab = useCallback((id: string) => {
    dispatch({ type: 'SET_ACTIVE', id });
  }, []);

  const renameTab = useCallback((id: string, title: string) => {
    dispatch({ type: 'RENAME_TAB', id, title });
  }, []);

  const setTabActivity = useCallback((id: string, hasActivity: boolean) => {
    dispatch({ type: 'SET_ACTIVITY', id, hasActivity });
  }, []);

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    dispatch({ type: 'REORDER_TABS', fromIndex, toIndex });
  }, []);

  return {
    tabs: state.tabs,
    activeTabId: state.activeTabId,
    addTab,
    removeTab,
    setActiveTab,
    renameTab,
    setTabActivity,
    reorderTabs,
  };
}
