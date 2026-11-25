import type { RefCallback } from "react";

import type { DataEntryRef } from "../../store/form-store";

import { useCallback, useEffect, useRef, useState } from "react";

import { useFormEditorStore, useFormEditorStoreApi } from "../../store/form-store";

export interface DataEntrySession<T> {
  /**
   * Distinct per opening, so the modal of a new session mounts a fresh draft.
   */
  key: number;
  mode: "create" | "edit";
  initial: T;
  /**
   * `false` while the modal plays its close transition.
   */
  open: boolean;
}

export interface DataEntryEditor<T> {
  session: DataEntrySession<T> | null;
  editingId: string | null;
  openCreate: () => void;
  openEdit: (entry: T) => void;
  close: () => void;
  handleAfterClose: () => void;
  rowRef: (id: string) => RefCallback<HTMLDivElement>;
}

/**
 * The editing session behind one list of the `数据` tab: which entry's modal is
 * open, kept mounted through its close transition, and opened on a diagnostic
 * jump (`requestDataEdit`) with the entry's row scrolled into view.
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
  const rowsRef = useRef(new Map<string, HTMLDivElement>());
  const [session, setSession] = useState<DataEntrySession<T> | null>(null);

  const openSession = useCallback((mode: DataEntrySession<T>["mode"], initial: T): void => {
    setSession(previous => {
      return {
        key: (previous?.key ?? 0) + 1,
        mode,
        initial,
        open: true
      };
    });
  }, []);

  useEffect(() => {
    if (pendingEdit === null) {
      return;
    }

    storeApi.getState().clearPendingDataEdit();

    const target = entries.find(entry => entry.id === pendingEdit.id);

    if (target !== undefined) {
      rowsRef.current.get(target.id)?.scrollIntoView?.({ block: "nearest" });
      openSession("edit", target);
    }
  }, [pendingEdit, entries, storeApi, openSession]);

  return {
    session,
    editingId: session?.open && session.mode === "edit" ? session.initial.id : null,
    openCreate: () => openSession("create", createBlank()),
    openEdit: entry => openSession("edit", entry),
    close: () => setSession(previous => previous && { ...previous, open: false }),
    // A session reopened during the transition stays.
    handleAfterClose: () => setSession(previous => previous?.open ? previous : null),
    rowRef: id => node => {
      if (node === null) {
        rowsRef.current.delete(id);
      } else {
        rowsRef.current.set(id, node);
      }
    }
  };
}
