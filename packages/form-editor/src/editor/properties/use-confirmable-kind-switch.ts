import { useState } from "react";

export interface ConfirmableKindSwitch<K> {
  /**
   * The kind awaiting confirmation, or `null` when no confirmation is open.
   * Drives the `Popconfirm`'s `open`.
   */
  pendingKind: K | null;
  /**
   * Picker `onChange`: ignore a no-op (same kind), defer to the confirmation
   * when a switch would discard work, else commit immediately. The caller
   * type-guards the raw control value before calling this.
   */
  requestKind: (kind: K) => void;
  /**
   * Apply the pending kind and close the confirmation (`Popconfirm.onConfirm`).
   */
  confirm: () => void;
  /**
   * Dismiss the confirmation without switching (`Popconfirm.onCancel`).
   */
  cancel: () => void;
}

/**
 * The confirm-gated kind-switch flow shared by the data-source, option-source,
 * and linkage-trigger editors. Each picks a value with several mutually
 * exclusive *kinds* whose payloads do not overlap, so switching a configured
 * value to another kind discards work and must be confirmed — while an
 * unconfigured value switches instantly.
 *
 * The hook owns only the pending-kind lifecycle (the one piece that must stay in
 * sync across editors). Each caller keeps its own picker control (`Segmented` /
 * `Select`), its own `needsConfirm` predicate (a payload check, or a prop), and
 * its own per-union `commit` reducer — none of which generalize.
 */
export function useConfirmableKindSwitch<K>(args: {
  current: K;
  needsConfirm: boolean;
  commit: (kind: K) => void;
}): ConfirmableKindSwitch<K> {
  const {
    commit,
    current,
    needsConfirm
  } = args;
  const [pendingKind, setPendingKind] = useState<K | null>(null);

  const requestKind = (kind: K): void => {
    if (kind === current) {
      return;
    }

    if (needsConfirm) {
      setPendingKind(kind);
      return;
    }

    commit(kind);
  };

  const confirm = (): void => {
    if (pendingKind !== null) {
      commit(pendingKind);
    }

    setPendingKind(null);
  };

  const cancel = (): void => {
    setPendingKind(null);
  };

  return {
    pendingKind,
    requestKind,
    confirm,
    cancel
  };
}
