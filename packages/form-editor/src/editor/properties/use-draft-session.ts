import type { RefCallback } from "react";

import { useLatest } from "@vef-framework-react/hooks";
import { useCallback, useEffect, useRef, useState } from "react";

export interface DraftSession<T, E = undefined> {
  /**
   * Distinct per opening, so each modal session mounts a fresh draft.
   */
  key: number;
  mode: "create" | "edit";
  initial: T;
  /**
   * Caller-specific metadata attached to this opening (for example a linkage
   * rule's 1-based number and initial focused step).
   */
  extra: E;
  /**
   * `false` while the modal plays its close transition.
   */
  open: boolean;
}

export type DraftSessionJumpTarget<T, E = undefined> = E extends undefined
  ? { entry: T; extra?: E }
  : { entry: T; extra: E };

export interface DraftSessionJumpConfig<T extends { id: string }, J, E = undefined> {
  /**
   * Current pending jump token, or `null` when idle. Each distinct non-null
   * reference triggers one jump.
   */
  pending: J | null;
  /**
   * Clear the consumed jump token from its store.
   */
  clear: () => void;
  /**
   * Resolve `jump` to the entry to edit (plus session `extra`), or `undefined`
   * when nothing should open (e.g. a removed entry, or a jump that only brings
   * the list itself into view).
   */
  resolve: (jump: J) => DraftSessionJumpTarget<T, E> | undefined;
}

export interface UseDraftSessionOptions<T extends { id: string }, J = never, E = undefined> {
  jump?: DraftSessionJumpConfig<T, J, E>;
}

export interface DraftSessionController<T extends { id: string }, E = undefined> {
  session: DraftSession<T, E> | null;
  editingId: string | null;
  openCreate: (initial: T, ...args: E extends undefined ? [extra?: E] : [extra: E]) => void;
  openEdit: (entry: T, ...args: E extends undefined ? [extra?: E] : [extra: E]) => void;
  close: () => void;
  /**
   * Close the active session if it is currently editing `id` (e.g. its row was
   * deleted while the modal was open).
   */
  closeIfEditing: (id: string) => void;
  /**
   * Unmount the closed modal once its exit transition finishes; a session
   * reopened mid-transition stays mounted.
   */
  handleAfterClose: () => void;
  /**
   * Referentially stable row registration callback for memoized list rows.
   */
  registerRow: (id: string, node: HTMLDivElement | null) => void;
  /**
   * Convenience per-row ref callback backed by {@link registerRow}.
   */
  rowRef: (id: string) => RefCallback<HTMLDivElement>;
}

/**
 * Shared draft-modal session machinery behind every compact list + draft-modal
 * editor (data sources, form variables, and linkage rule lists). Owns the
 * monotonic session key, `editingId`, keeping the modal mounted through its
 * close transition, the row-element map, and scrolling + opening on a
 * diagnostic jump.
 */
export function useDraftSession<T extends { id: string }, J = never, E = undefined>(
  options?: UseDraftSessionOptions<T, J, E>
): DraftSessionController<T, E> {
  const rowsRef = useRef(new Map<string, HTMLDivElement>());
  const nextKeyRef = useRef(0);
  const [session, setSession] = useState<DraftSession<T, E> | null>(null);

  const pending = options?.jump?.pending ?? null;
  const clearRef = useLatest(options?.jump?.clear);
  const resolveRef = useLatest(options?.jump?.resolve);

  const openSession = useCallback((mode: DraftSession<T, E>["mode"], initial: T, extra: E): void => {
    nextKeyRef.current += 1;
    setSession({
      key: nextKeyRef.current,
      mode,
      initial,
      extra,
      open: true
    });
  }, []);

  useEffect(() => {
    if (pending === null) {
      return;
    }

    clearRef.current?.();

    const target = resolveRef.current?.(pending);

    if (target !== undefined) {
      rowsRef.current.get(target.entry.id)?.scrollIntoView?.({ block: "nearest" });
      openSession("edit", target.entry, target.extra as E);
    }
  }, [pending, clearRef, resolveRef, openSession]);

  const openCreate = useCallback(
    (initial: T, ...args: E extends undefined ? [extra?: E] : [extra: E]): void => {
      openSession("create", initial, args[0] as E);
    },
    [openSession]
  );

  const openEdit = useCallback(
    (entry: T, ...args: E extends undefined ? [extra?: E] : [extra: E]): void => {
      openSession("edit", entry, args[0] as E);
    },
    [openSession]
  );

  const close = useCallback((): void => {
    setSession(previous => previous && { ...previous, open: false });
  }, []);

  const closeIfEditing = useCallback((id: string): void => {
    setSession(previous => previous?.mode === "edit" && previous.initial.id === id ? { ...previous, open: false } : previous);
  }, []);

  // A session reopened during the transition stays.
  const handleAfterClose = useCallback((): void => {
    setSession(previous => previous?.open ? previous : null);
  }, []);

  const registerRow = useCallback((id: string, node: HTMLDivElement | null): void => {
    if (node === null) {
      rowsRef.current.delete(id);
    } else {
      rowsRef.current.set(id, node);
    }
  }, []);

  const rowRef = useCallback(
    (id: string): RefCallback<HTMLDivElement> => node => registerRow(id, node),
    [registerRow]
  );

  return {
    session,
    editingId: session?.open && session.mode === "edit" ? session.initial.id : null,
    openCreate,
    openEdit,
    close,
    closeIfEditing,
    handleAfterClose,
    registerRow,
    rowRef
  };
}
