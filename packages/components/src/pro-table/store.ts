import type { DragEndEvent, PaginationParams } from "@vef-framework-react/core";
import type { EventEmitter, Key } from "@vef-framework-react/shared";
import type { ReactNode } from "react";

import type { OrderSpec } from "../_base/types";
import type { TableColumn } from "../table";
import type { ProTableEvents } from "./event";

import { createComponentStore, moveDragItem } from "@vef-framework-react/core";
import { isFunction, isNumber } from "@vef-framework-react/shared";

import { pageSizeOptions } from "../table";
import { createEventEmitter } from "./event";

/**
 * Column setting configuration
 */
export interface ColumnSetting {
  /**
   * Column unique identifier
   */
  id: Key;
  /**
   * Column display title
   */
  title: ReactNode;
  /**
   * Column fixed position
   */
  fixed?: "start" | "end" | false;
  /**
   * Column width in pixels
   */
  width?: number;
  /**
   * Whether the column is visible
   */
  visible: boolean;
  /**
   * Original column index for reference
   */
  originalIndex: number;
}

/**
 * State for the ProTable component
 */
export interface ProTableState {
  /**
   * Internal event bus used for cross-part communication within ProTable.
   */
  eventEmitter: EventEmitter<ProTableEvents>;
  /**
   * Current pagination parameters
   */
  paginationParams: PaginationParams;
  /**
   * Update pagination parameters
   */
  setPaginationParams: (params: PaginationParams) => void;
  /**
   * Current sort order specifications
   */
  sort: OrderSpec[];
  /**
   * Update sort order specifications
   */
  setSort: (sort: OrderSpec[]) => void;
  /**
   * Refetch data with current query params, current pagination and sort parameters
   */
  refetch: () => void;
  /**
   * Column settings state for customization
   */
  columnSettings: ColumnSetting[];
  /**
   * Original column settings for reset functionality
   */
  originalColumnSettings: ColumnSetting[];
  /**
   * Initialize column settings from columns prop
   */
  initColumnSettings: (columns: TableColumn[]) => void;
  /**
   * Set column settings directly
   */
  setColumnSettings: (settings: ColumnSetting[]) => void;
  /**
   * Reorder columns by drag event
   */
  reorderColumns: (event: DragEndEvent) => void;
  /**
   * Toggle column fixed state
   */
  setColumnFixed: (id: Key, fixed: "start" | "end" | false) => void;
  /**
   * Update column width
   */
  setColumnWidth: (id: Key, width: number) => void;
  /**
   * Toggle column visibility
   */
  setColumnVisible: (id: Key, visible: boolean) => void;
  /**
   * Reset column settings to original state
   *
   * @param clearStorage - Optional callback to clear localStorage
   */
  resetColumnSettings: (clearStorage?: () => void) => void;
}

export function getColumnId(column: TableColumn, index: number): string {
  const id = column.key ?? column.dataIndex ?? `col-${index}`;
  return String(id);
}

function normalizeFixed(fixed: TableColumn["fixed"]): "start" | "end" | false {
  if (fixed === true || fixed === "left") {
    return "start";
  }

  if (fixed === "right") {
    return "end";
  }

  if (fixed === false || fixed === undefined) {
    return false;
  }

  return fixed;
}

export function createColumnSetting(column: TableColumn, index: number): ColumnSetting {
  return {
    id: getColumnId(column, index),
    title: column.title as ReactNode,
    fixed: normalizeFixed(column.fixed),
    width: isNumber(column.width) ? column.width : undefined,
    visible: true,
    originalIndex: index
  };
}

export const {
  StoreProvider: ProTableStoreProvider,
  useStore: useProTableStore,
  useStoreApi: useProTableStoreApi
} = createComponentStore<ProTableState>(
  "ProTable",
  (set, get) => {
    return {
      eventEmitter: createEventEmitter(),
      paginationParams: {
        page: 1,
        size: pageSizeOptions[1]
      },
      setPaginationParams: params => {
        set(state => {
          state.paginationParams = params;
        });
      },
      sort: [],
      setSort: sort => {
        set(state => {
          state.sort = sort;
        });
      },
      refetch: () => {
        get().eventEmitter.emit("refetch");
      },
      columnSettings: [],
      originalColumnSettings: [],
      initColumnSettings: columns => {
        const currentSettings = get().columnSettings;
        const currentSettingsMap = new Map(currentSettings.map(cs => [cs.id, cs]));
        const filteredColumns = columns.filter(column => !isFunction(column.title));
        const newOriginalSettings = filteredColumns.map((column, index) => createColumnSetting(column, index));

        const newSettings = filteredColumns.map((column, index) => {
          const cs = createColumnSetting(column, index);
          const existing = currentSettingsMap.get(cs.id);

          if (existing) {
            return {
              ...existing,
              title: column.title,
              originalIndex: index
            } as ColumnSetting;
          }

          return cs;
        });

        set(state => {
          state.columnSettings = newSettings;
          state.originalColumnSettings = newOriginalSettings;
        });
      },
      setColumnSettings: settings => {
        set(state => {
          state.columnSettings = settings;
        });
      },
      reorderColumns: event => {
        set(state => {
          state.columnSettings = moveDragItem(state.columnSettings, event);
        });
      },
      setColumnFixed: (id, fixed) => {
        set(state => {
          const column = state.columnSettings.find(cs => cs.id === id);

          if (column) {
            column.fixed = fixed;
          }
        });
      },
      setColumnWidth: (id, width) => {
        set(state => {
          const column = state.columnSettings.find(cs => cs.id === id);

          if (column) {
            column.width = width;
          }
        });
      },
      setColumnVisible: (id, visible) => {
        set(state => {
          const column = state.columnSettings.find(cs => cs.id === id);

          if (column) {
            column.visible = visible;
          }
        });
      },
      resetColumnSettings: clearStorage => {
        clearStorage?.();
        set(state => {
          state.columnSettings = state.originalColumnSettings.map(cs => {
            return {
              ...cs
            };
          });
        });
      }
    };
  }
);
