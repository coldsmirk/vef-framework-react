import type { MaybeNull } from "@vef-framework-react/shared";

import type { ColumnSetting } from "../store";

import { useEffect, useRef } from "react";

import { useProTableStore, useProTableStoreApi } from "../store";

const STORAGE_KEY_PREFIX = "__VEF_PRO_TABLE_COLUMN_SETTINGS__";

// Per-storageKey skip flags to avoid interference between multiple table instances
const skipSaveFlags = new Map<string, boolean>();

/**
 * Serializable column setting for localStorage
 */
interface StoredColumnSetting {
  id: string;
  fixed?: "start" | "end" | false;
  width?: number;
  visible: boolean;
}

function getStorageKey(key: string): string {
  return `${STORAGE_KEY_PREFIX}${key.replaceAll(".", "_").toUpperCase()}__`;
}

function loadFromStorage(storageKey: string): MaybeNull<StoredColumnSetting[]> {
  const data = localStorage.getItem(getStorageKey(storageKey));
  return data ? JSON.parse(data) : null;
}

function saveToStorage(storageKey: string, settings: ColumnSetting[]): void {
  const data: StoredColumnSetting[] = settings.map(cs => {
    return {
      id: cs.id,
      fixed: cs.fixed,
      width: cs.width,
      visible: cs.visible
    };
  });
  localStorage.setItem(getStorageKey(storageKey), JSON.stringify(data));
}

export function clearColumnSettingsStorage(storageKey: string): { skipNextSave: () => void } {
  localStorage.removeItem(getStorageKey(storageKey));
  return {
    skipNextSave() {
      skipSaveFlags.set(storageKey, true);
    }
  };
}

/**
 * Hook to handle column settings persistence to localStorage
 */
export function useColumnSettingsPersistence(storageKey: string | undefined): void {
  const originalColumnSettings = useProTableStore(state => state.originalColumnSettings);
  const storeApi = useProTableStoreApi();
  const isLoadedRef = useRef(false);

  // Load from storage on mount (when originalColumnSettings is ready)
  useEffect(() => {
    if (!storageKey || isLoadedRef.current || originalColumnSettings.length === 0) {
      return;
    }

    const stored = loadFromStorage(storageKey);
    isLoadedRef.current = true;

    if (!stored || stored.length === 0) {
      return;
    }

    const newSettings: ColumnSetting[] = [];
    const usedIds = new Set<string>();

    // First, add columns in stored order
    for (const storedSetting of stored) {
      const original = originalColumnSettings.find(cs => cs.id === storedSetting.id);

      if (original) {
        newSettings.push({
          ...original,
          fixed: storedSetting.fixed,
          width: storedSetting.width ?? original.width,
          visible: storedSetting.visible
        });
        usedIds.add(storedSetting.id);
      }
    }

    // Then, add any new columns not in storage
    for (const original of originalColumnSettings) {
      if (!usedIds.has(original.id)) {
        newSettings.push({ ...original });
      }
    }

    storeApi.getState().setColumnSettings(newSettings);
  }, [storageKey, originalColumnSettings, storeApi]);

  // Subscribe to store changes for persistence
  useEffect(() => {
    if (!storageKey) {
      return;
    }

    return storeApi.subscribe(
      state => state.columnSettings,
      settings => {
        if (skipSaveFlags.get(storageKey)) {
          skipSaveFlags.delete(storageKey);
          return;
        }

        if (isLoadedRef.current && settings.length > 0) {
          saveToStorage(storageKey, settings);
        }
      }
    );
  }, [storageKey, storeApi]);
}
