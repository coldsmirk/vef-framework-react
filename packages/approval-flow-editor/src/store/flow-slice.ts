import type { EditorSliceCreator, FlowSlice } from "./types";

import { createSeedFlow } from "../shared/seed-flow";
import { fromFlowDefinition, toFlowDefinition } from "../shared/serialization";

export const createFlowSlice: EditorSliceCreator<FlowSlice> = (set, get) => {
  return {
    isDirty: false,
    changeVersion: 0,

    loadDefinition: definition => {
      // An empty definition hydrates to the seed flow (start → end): start/end
      // are neither deletable nor addable, so the editor must guarantee them.
      const { nodes, edges } = definition.nodes.length > 0 ? fromFlowDefinition(definition) : createSeedFlow();

      // A reload is a new document — its undo timeline starts empty.
      get().breakCoalescing();

      set(state => {
        state.nodes = nodes;
        state.edges = edges;
        state.selectedNodeId = null;
        state.hoveredEdgeId = null;
        state.isDirty = false;
        state.past = [];
        state.future = [];
      });
    },

    toDefinition: () => {
      const { nodes, edges } = get();
      return toFlowDefinition(nodes, edges);
    },

    reset: () => {
      const { nodes, edges } = createSeedFlow();

      get().breakCoalescing();

      set(state => {
        state.nodes = nodes;
        state.edges = edges;
        state.selectedNodeId = null;
        state.hoveredEdgeId = null;
        state.isDirty = false;
        state.changeVersion = 0;
        state.past = [];
        state.future = [];
      });
    }
  };
};
