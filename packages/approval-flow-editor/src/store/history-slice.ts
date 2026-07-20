import type { EditorSliceCreator, HistoryEntry, HistorySlice } from "./types";

/**
 * Bounded so a long editing session cannot grow memory without limit. Entries
 * share structure with each other (immer copy-on-write rebuilds only what an
 * edit touched), so each one costs roughly one path, not one graph.
 */
const HISTORY_LIMIT = 100;

/**
 * Undo timeline for the graph. Mirrors the form editor's hand-rolled design
 * (no temporal middleware): mutators call {@link HistorySlice.checkpoint}
 * with the PRE-edit state before applying themselves, coalescing folds a run
 * of related checkpoints into one step, and undo/redo swap whole snapshots.
 *
 * Undo/redo bump `changeVersion` and mark the flow dirty — a restored graph
 * must reach `onChange` like any other edit, or the host's copy silently
 * drifts from the canvas.
 */
export const createHistorySlice: EditorSliceCreator<HistorySlice> = (set, get) => {
  // The active coalescing run. Closure-held (not reactive state): nothing
  // renders from it, and a stale subscription must never extend a run.
  let activeCoalesceKey: string | null = null;

  const snapshot = (): HistoryEntry => {
    const { nodes, edges } = get();

    return { nodes, edges };
  };

  return {
    past: [],
    future: [],

    checkpoint: options => {
      const key = options?.coalesceKey ?? null;

      if (key !== null && key === activeCoalesceKey) {
        // Mid-run: the run's first checkpoint already captured the pre-run
        // state; folding means simply not pushing again.
        return;
      }

      activeCoalesceKey = key;

      if (key !== null && options?.gesture) {
        // One user gesture can fan out into several xyflow callbacks within
        // the same tick (Backspace: node removal + cascaded edge removal).
        // Ending the run at the end of the microtask folds those together
        // while keeping the NEXT gesture a separate undo step.
        queueMicrotask(() => {
          if (activeCoalesceKey === key) {
            activeCoalesceKey = null;
          }
        });
      }

      const entry = snapshot();

      set(state => {
        state.future = [];
        state.past.push(entry);

        if (state.past.length > HISTORY_LIMIT) {
          state.past.shift();
        }
      });
    },

    breakCoalescing: () => {
      activeCoalesceKey = null;
    },

    undo: () => {
      const { past, readonly } = get();
      const entry = past.at(-1);

      if (readonly || !entry) {
        return;
      }

      const current = snapshot();
      activeCoalesceKey = null;

      set(state => {
        state.past.pop();
        state.future.push(current);
        // Strip the selection flags xyflow wrote onto the snapshotted nodes —
        // history restores the graph contract, never view state.
        state.nodes = entry.nodes.map(node => node.selected ? { ...node, selected: false } : node);
        state.edges = entry.edges;

        if (state.selectedNodeId !== null && entry.nodes.every(node => node.id !== state.selectedNodeId)) {
          state.selectedNodeId = null;
        }

        state.hoveredEdgeId = null;
        // The restored graph must reach onChange like any other edit.
        state.isDirty = true;
        state.changeVersion++;
      });
    },

    redo: () => {
      const { future, readonly } = get();
      const entry = future.at(-1);

      if (readonly || !entry) {
        return;
      }

      const current = snapshot();
      activeCoalesceKey = null;

      set(state => {
        state.future.pop();
        state.past.push(current);
        state.nodes = entry.nodes.map(node => node.selected ? { ...node, selected: false } : node);
        state.edges = entry.edges;

        if (state.selectedNodeId !== null && entry.nodes.every(node => node.id !== state.selectedNodeId)) {
          state.selectedNodeId = null;
        }

        state.hoveredEdgeId = null;
        state.isDirty = true;
        state.changeVersion++;
      });
    }
  };
};
