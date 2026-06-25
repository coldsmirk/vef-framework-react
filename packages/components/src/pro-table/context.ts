import { createContext, use } from "react";

const DataContext = createContext<readonly unknown[]>([]);
DataContext.displayName = "DataContext";

export const DataProvider = DataContext.Provider;

export function useData() {
  return use(DataContext);
}

/**
 * Context for column settings storage key
 */
const ColumnSettingsStorageKeyContext = createContext<string | undefined>(undefined);
ColumnSettingsStorageKeyContext.displayName = "ColumnSettingsStorageKeyContext";

export const ColumnSettingsStorageKeyProvider = ColumnSettingsStorageKeyContext.Provider;

export function useColumnSettingsStorageKey() {
  return use(ColumnSettingsStorageKeyContext);
}
