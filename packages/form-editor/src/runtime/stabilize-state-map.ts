import type { RuntimeStateMap } from "./types";

import { isDeepEqual } from "@vef-framework-react/shared";

/**
 * Reference-reconcile a freshly-evaluated runtime state map against the prior
 * one. `evaluateRuntimeStates` rebuilds every `RuntimeFieldState` on each call,
 * so a per-field selector would see a new object for every unchanged field and
 * re-render the whole tree. This preserves the prior object reference for any
 * field whose state is deeply equal — so `Object.is(map[id], prev[id])` holds
 * for the n-k unchanged fields and only the k flipped fields re-render — and
 * returns the prior whole-map reference when nothing changed at all (which the
 * assignment effect relies on, replacing the old whole-map `useDeepMemo`).
 */
export function stabilizeStateMap(
  prev: RuntimeStateMap | undefined,
  next: RuntimeStateMap
): RuntimeStateMap {
  if (!prev) {
    return next;
  }

  const reconciled: RuntimeStateMap = {};
  const nextKeys = Object.keys(next);
  let changed = false;

  for (const id of nextKeys) {
    const nextEntry = next[id];

    if (nextEntry === undefined) {
      continue;
    }

    const prevEntry = prev[id];

    if (prevEntry !== undefined && isDeepEqual(prevEntry, nextEntry)) {
      // Preserve identity so the consumer's Object.is selector bails.
      reconciled[id] = prevEntry;
    } else {
      reconciled[id] = nextEntry;
      changed = true;
    }
  }

  // No entry changed and the key set is identical → the whole map is stable.
  if (!changed && nextKeys.length === Object.keys(prev).length) {
    return prev;
  }

  return reconciled;
}
