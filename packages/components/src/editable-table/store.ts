import type { AnyObject } from "@vef-framework-react/shared";

import { createComponentStore } from "@vef-framework-react/core";
import { createThrowNotImplementedFn } from "@vef-framework-react/shared";

/**
 * State for the EditableTable component. Holds the single editing-row key and
 * a set of behavior slots whose real implementations are injected by the host
 * component (which owns `value` / `onChange` / the draft form). Leaf cells and
 * row actions subscribe to `editingKey` to toggle their own render, so the top
 * level never has to.
 */
export interface EditableTableState {
  /**
   * Key of the row currently being edited, or `null` when none.
   */
  editingKey: string | null;
  setEditingKey: (key: string | null) => void;
  /**
   * Enter edit mode for a row (resets the draft form to the row's values).
   */
  startEdit: (rowKey: string, row: AnyObject) => void;
  /**
   * Validate the editing row and, on success, write it back via `onChange`.
   */
  save: () => Promise<void>;
  /**
   * Leave edit mode, discarding the draft.
   */
  cancel: () => void;
  /**
   * Append a new row and enter edit mode for it.
   */
  addRow: () => void;
  /**
   * Remove a row by key via `onChange`.
   */
  deleteRow: (rowKey: string) => void;
}

export const {
  StoreProvider: EditableTableStoreProvider,
  useStore: useEditableTableStore,
  useStoreApi: useEditableTableStoreApi
} = createComponentStore<EditableTableState>("EditableTable", set => {
  return {
    editingKey: null,
    setEditingKey: key => {
      set(state => {
        state.editingKey = key;
      });
    },
    startEdit: createThrowNotImplementedFn("startEdit"),
    save: createThrowNotImplementedFn("save"),
    cancel: createThrowNotImplementedFn("cancel"),
    addRow: createThrowNotImplementedFn("addRow"),
    deleteRow: createThrowNotImplementedFn("deleteRow")
  };
});
