import type { RefCallback } from "react";

import type { DataEntryRef } from "../../store/form-store";
import type { DraftSession } from "./use-draft-session";

import { useLatest } from "@vef-framework-react/hooks";
import { useCallback } from "react";

import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";
import { useDraftSession } from "./use-draft-session";

export type DataEntrySession<T> = DraftSession<T>;

export interface DataEntryEditor<T> {
  session: DataEntrySession<T> | null;
  editingId: string | null;
  openCreate: () => void;
  openEdit: (entry: T) => void;
  close: () => void;
  closeIfEditing: (id: string) => void;
  handleAfterClose: () => void;
  rowRef: (id: string) => RefCallback<HTMLDivElement>;
}

/**
 * The editing session behind one list of the `数据` tab (data sources or form
 * variables): specializes {@link useDraftSession} for `pendingDataEdit` jumps
 * by entry id and blank-entry creation.
 */
export function useDataEntryEditor<T extends { id: string }>(args: {
  createBlank: () => T;
  entries: readonly T[];
  kind: DataEntryRef["kind"];
}): DataEntryEditor<T> {
  const {
    createBlank,
    entries,
    kind
  } = args;
  const storeApi = useFormEditorStoreApi();
  const pendingEdit = useFormEditorStore(s => s.pendingDataEdit?.kind === kind ? s.pendingDataEdit : null);
  const createBlankRef = useLatest(createBlank);
  const entriesRef = useLatest(entries);

  const {
    close,
    closeIfEditing,
    editingId,
    handleAfterClose,
    openCreate: openCreateDraft,
    openEdit,
    rowRef,
    session
  } = useDraftSession<T, DataEntryRef>({
    jump: {
      pending: pendingEdit,
      clear: () => storeApi.getState().clearPendingDataEdit(),
      resolve: target => {
        const entry = entriesRef.current.find(candidate => candidate.id === target.id);

        return entry === undefined ? undefined : { entry };
      }
    }
  });

  const openCreate = useCallback((): void => {
    openCreateDraft(createBlankRef.current());
  }, [createBlankRef, openCreateDraft]);

  return {
    session,
    editingId,
    openCreate,
    openEdit,
    close,
    closeIfEditing,
    handleAfterClose,
    rowRef
  };
}
