import type { EditorSliceCreator, InteractionSlice } from "./types";

export const createInteractionSlice: EditorSliceCreator<InteractionSlice> = (set, get) => {
  return {
    selectedNodeId: null,
    hoveredEdgeId: null,
    readonly: false,

    selectNode: nodeId => {
      // A selection change ends the active history-coalescing run: re-editing
      // the same node after clicking away starts a fresh undo step.
      get().breakCoalescing();

      set(state => {
        state.selectedNodeId = nodeId;
      });
    },

    setHoveredEdgeId: edgeId => {
      set(state => {
        state.hoveredEdgeId = edgeId;
      });
    },

    setReadonly: readonly => {
      set(state => {
        state.readonly = readonly;
      });
    }
  };
};
