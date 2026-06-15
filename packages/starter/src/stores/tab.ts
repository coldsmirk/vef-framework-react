import type { AnyObject } from "@vef-framework-react/shared";

import { createPersistedStore, originalState } from "@vef-framework-react/core";

import { INDEX_ROUTE_PATH } from "../constants";

export interface Tab {
  id: string;
  fullPath: string;
  params: AnyObject;
  search: AnyObject;
  label: string;
}

export interface TabState {
  activeTabId?: string;
  tabs: Tab[];
  setActiveTabId: (id: string) => void;
  setTabs: (tabs: Tab[]) => void;
  addTab: (tab: Tab) => void;
  removeTab: (id: string, navigate: (tab?: Tab) => void) => void;
  removeAllTabs: (navigate: (tab?: Tab) => void) => void;
  removeAllTabsExcept: (id: string, navigate: (tab?: Tab) => void) => void;
  removeLeftTabs: (id: string, navigate: (tab?: Tab) => void) => void;
  removeRightTabs: (id: string, navigate: (tab?: Tab) => void) => void;
}

export const useTabStore = createPersistedStore<TabState>(
  set => {
    return {
      tabs: [],

      setActiveTabId(id) {
        set(state => {
          state.activeTabId = id;
        });
      },

      setTabs(tabs) {
        set(state => {
          state.tabs = tabs;
        });
      },

      addTab(tab) {
        set(state => {
          const exists = state.tabs.some(existedTab => existedTab.id === tab.id);

          if (!exists) {
            state.tabs.push(tab);
          }
        });
      },

      removeTab(id, navigate) {
        set(state => {
          const currentIndex = state.tabs.findIndex(tab => tab.id === id);

          if (currentIndex === -1) {
            return;
          }

          const remainingTabs = state.tabs.filter(tab => tab.id !== id);

          if (state.activeTabId === id) {
            if (remainingTabs.length > 0) {
              const nextActiveTab = remainingTabs[Math.min(currentIndex, remainingTabs.length - 1)]!;
              navigate(originalState(nextActiveTab));
            } else {
              navigate();
            }
          }

          state.tabs = remainingTabs;
        });
      },

      removeAllTabs(navigate) {
        set(state => {
          const activeTab = state.tabs.find(tab => tab.id === state.activeTabId);
          state.tabs = activeTab && activeTab.fullPath === INDEX_ROUTE_PATH ? [activeTab] : [];
          navigate();
        });
      },

      removeAllTabsExcept(id, navigate) {
        set(state => {
          state.tabs = state.tabs.filter(tab => tab.id === id);
          navigate(originalState(state.tabs.find(tab => tab.id === id)));
        });
      },

      removeLeftTabs(id, navigate) {
        set(state => {
          const index = state.tabs.findIndex(tab => tab.id === id);

          if (index === -1) {
            return;
          }

          const removedTabs = state.tabs.slice(0, index);
          state.tabs = state.tabs.slice(index);

          if (removedTabs.some(tab => tab.id === state.activeTabId)) {
            navigate(originalState(state.tabs.find(tab => tab.id === id)));
          }
        });
      },

      removeRightTabs(id, navigate) {
        set(state => {
          const index = state.tabs.findIndex(tab => tab.id === id);

          if (index === -1) {
            return;
          }

          const removedTabs = state.tabs.slice(index + 1);
          state.tabs = state.tabs.slice(0, index + 1);

          if (removedTabs.some(tab => tab.id === state.activeTabId)) {
            navigate(originalState(state.tabs.find(tab => tab.id === id)));
          }
        });
      }
    };
  },
  {
    name: "tab",
    storage: "local",
    selector: ({ activeTabId, tabs }) => { return { activeTabId, tabs }; }
  }
);
