import { generateId } from "@vef-framework-react/shared";
import { useRef } from "react";

/**
 * Stable per-row React keys for editable lists whose items carry no id of their
 * own (the wire format owns the item shape, so an id cannot be added there).
 * Index keys would make React reuse row instances across deletions, leaking
 * internal state (e.g. a host picker's search box) from a removed row into its
 * successor — the same problem antd's Form.List solves with internal key
 * bookkeeping.
 *
 * Keys are reconciled to the current length on render: appended rows receive
 * fresh keys automatically. Call `remove(index)` alongside the row deletion so
 * the remaining keys stay aligned with their rows.
 */
export function useRowKeys(length: number): {
  keys: readonly string[];
  remove: (index: number) => void;
} {
  const keysRef = useRef<string[]>([]);
  const keys = keysRef.current;

  while (keys.length < length) {
    keys.push(generateId());
  }

  if (keys.length > length) {
    keys.length = length;
  }

  return {
    keys,
    remove: index => {
      keys.splice(index, 1);
    }
  };
}
