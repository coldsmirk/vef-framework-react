import type { Connection } from "@xyflow/react";

import type { ConditionBranchDefinition, FlowNode, NodeDataMap } from "../types";
import type { EditorSliceCreator, GraphSlice } from "./types";

import { generateId } from "@vef-framework-react/shared";
import { addEdge, applyEdgeChanges, applyNodeChanges } from "@xyflow/react";

import { DEFAULT_NODE_DATA, NODE_RULES } from "../constants";
import { validateConnection } from "../shared/connection-rules";
import { normalizeNodeData } from "../shared/normalize-node-data";

/**
 * Drop rollback-target references that point at removed nodes, so the
 * serialized definition never carries dangling keys. Shared by the xyflow
 * delete flow (Backspace) and the explicit removeNode action.
 */
function pruneRollbackTargetRefs(nodes: FlowNode[], removedNodeIds: ReadonlySet<string>): void {
  for (const node of nodes) {
    if (node.type !== "approval" || !node.data.rollbackTargetKeys?.length) {
      continue;
    }

    const pruned = node.data.rollbackTargetKeys.filter(key => !removedNodeIds.has(key));

    if (pruned.length !== node.data.rollbackTargetKeys.length) {
      node.data.rollbackTargetKeys = pruned;
    }
  }
}

export const createGraphSlice: EditorSliceCreator<GraphSlice> = (set, get) => {
  return {
    nodes: [],
    edges: [],

    // Deletion policy lives on the nodes themselves: start/end carry
    // `deletable: false` (set at construction from NODE_RULES), so xyflow's
    // native delete flow skips them while still cascading edge removal for
    // deleted neighbors. No change filtering is needed here — filtering edge
    // removals would orphan the edges of a deleted node.
    onNodesChange: changes => {
      if (get().readonly) {
        // Dimension changes are xyflow measurement sync, not user edits (the
        // non-readonly path excludes them from dirty tracking for the same
        // reason). Keep applying them so node.measured stays populated and a
        // later readonly → editable flip auto-layouts with real node sizes
        // instead of the NODE_DIMENSIONS fallback. All other change types are
        // user edits and stay dropped.
        const dimensionChanges = changes.filter(change => change.type === "dimensions");

        if (dimensionChanges.length > 0) {
          set(state => {
            state.nodes = applyNodeChanges(dimensionChanges, state.nodes);
          });
        }

        return;
      }

      const hasMeaningfulNodeChange = changes.some(change => {
        if (change.type === "dimensions" || change.type === "select") {
          return false;
        }

        if (change.type === "position" && change.dragging) {
          return false;
        }

        return true;
      });

      const removedNodeIds = new Set(
        changes.filter(change => change.type === "remove").map(change => change.id)
      );

      // History: a discrete batch (removal etc.) folds with the cascaded
      // onEdgesChange of the same gesture via the shared "xyflow:batch" run;
      // a drag checkpoints on its FIRST frame (before any per-frame position
      // applied — `dragging: true` arrives ahead of its own application) and
      // every later frame folds into that entry. The drag-end change breaks
      // the run below, so the next drag starts a fresh undo step.
      const hasDiscreteChange = changes.some(
        change => change.type !== "dimensions" && change.type !== "select" && change.type !== "position"
      );
      const hasPositionChange = changes.some(change => change.type === "position");
      const hasDragEnd = changes.some(change => change.type === "position" && !change.dragging);

      if (hasDiscreteChange) {
        get().checkpoint({ coalesceKey: "xyflow:batch", gesture: true });
      } else if (hasPositionChange) {
        get().checkpoint({ coalesceKey: "drag" });
      }

      set(state => {
        state.nodes = applyNodeChanges(changes, state.nodes);

        if (state.selectedNodeId && !state.nodes.some(node => node.id === state.selectedNodeId)) {
          state.selectedNodeId = null;
        }

        if (removedNodeIds.size > 0) {
          pruneRollbackTargetRefs(state.nodes, removedNodeIds);
        }

        if (hasMeaningfulNodeChange) {
          state.isDirty = true;
          state.changeVersion++;
        }
      });

      if (hasDragEnd) {
        get().breakCoalescing();
      }
    },

    onEdgesChange: changes => {
      if (get().readonly) {
        return;
      }

      const hasMeaningfulEdgeChange = changes.some(change => change.type !== "select");

      if (hasMeaningfulEdgeChange) {
        // Shares the "xyflow:batch" run with onNodesChange: a Backspace
        // delete fires both callbacks in one tick, and they must land in ONE
        // undo step or undo would resurrect the edges without the node.
        get().checkpoint({ coalesceKey: "xyflow:batch", gesture: true });
      }

      set(state => {
        state.edges = applyEdgeChanges(changes, state.edges);

        if (hasMeaningfulEdgeChange) {
          state.isDirty = true;
          state.changeVersion++;
        }
      });
    },

    onConnect: (connection: Connection) => {
      const { edges, readonly } = get();

      if (readonly) {
        return;
      }

      if (!validateConnection(connection, edges)) {
        return;
      }

      get().checkpoint();

      set(state => {
        state.edges = addEdge(connection, state.edges);
        state.isDirty = true;
        state.changeVersion++;
      });
    },

    addNode: (type, position, data) => {
      const { readonly, nodes } = get();

      if (readonly) {
        return null;
      }

      const rule = NODE_RULES[type];

      if (rule.maxCount !== undefined) {
        const nodeCount = nodes.filter(n => n.type === type).length;

        if (nodeCount >= rule.maxCount) {
          return null;
        }
      }

      const id = `${type}_${generateId()}`;
      const defaultData = DEFAULT_NODE_DATA[type] ?? {};
      // structuredClone the shared default so nested mutable data (e.g. a
      // condition node's `branches` array and its branch objects) is never
      // aliased across nodes created from the same DEFAULT_NODE_DATA entry.
      // Normalization then resolves all omitted business fields to their
      // designer defaults so a freshly-added node serializes fully explicit.
      // `type` is a runtime NodeKind here, so the kind ↔ data correlation
      // cannot be proven by the correlated-union check — assert the node.
      const mergedData = normalizeNodeData(type, { ...structuredClone(defaultData), ...data } as NodeDataMap[typeof type]);

      get().checkpoint();

      set(state => {
        state.nodes.push({
          id,
          type,
          position,
          deletable: rule.deletable,
          data: mergedData
        } as FlowNode);
        state.isDirty = true;
        state.changeVersion++;
      });

      return id;
    },

    removeNode: nodeId => {
      const { readonly, nodes } = get();

      if (readonly) {
        return;
      }

      const target = nodes.find(n => n.id === nodeId);

      if (!target || target.deletable === false) {
        return;
      }

      get().checkpoint();

      set(state => {
        state.nodes = state.nodes.filter(n => n.id !== nodeId);
        // Connected edges fall with the node — same cascade xyflow performs
        // for its native delete flow.
        state.edges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
        pruneRollbackTargetRefs(state.nodes, new Set([nodeId]));

        if (state.selectedNodeId === nodeId) {
          state.selectedNodeId = null;
        }

        state.isDirty = true;
        state.changeVersion++;
      });
    },

    removeEdge: edgeId => {
      const { readonly, edges } = get();

      if (readonly || !edges.some(edge => edge.id === edgeId)) {
        return;
      }

      get().checkpoint();

      set(state => {
        state.edges = state.edges.filter(edge => edge.id !== edgeId);
        state.isDirty = true;
        state.changeVersion++;
      });
    },

    updateNodeData: (nodeId, data) => {
      const { readonly, nodes } = get();

      if (readonly || !nodes.some(n => n.id === nodeId)) {
        return;
      }

      // Config-panel edits arrive one keystroke at a time — fold a run of
      // edits to the same node into one undo step (selection changes break
      // the run, so re-editing the node later starts a fresh step).
      get().checkpoint({ coalesceKey: `data:${nodeId}` });

      set(state => {
        const node = state.nodes.find(n => n.id === nodeId);

        if (node) {
          Object.assign(node.data, data);
          state.isDirty = true;
          state.changeVersion++;
        }
      });
    },

    updateNodePositions: positions => {
      if (get().readonly) {
        return;
      }

      // One checkpoint for the whole committed layout: a single undo restores
      // every pre-layout position at once.
      get().checkpoint();

      set(state => {
        for (const node of state.nodes) {
          const pos = positions.get(node.id);

          if (pos) {
            node.position = pos;
          }
        }

        // Positions are part of the serialized contract (toFlowDefinition emits
        // node.position), so a committed layout must bump changeVersion to reach
        // onChange — otherwise auto-layout is silently dropped on save.
        state.isDirty = true;
        state.changeVersion++;
      });
    },

    updateConditionBranch: (nodeId, branchId, patch) => {
      const { readonly, nodes } = get();
      const target = nodes.find(n => n.id === nodeId);

      if (readonly || target?.type !== "condition" || !target.data.branches?.some(b => b.id === branchId)) {
        return;
      }

      // Per-branch keystroke folding, mirroring updateNodeData.
      get().checkpoint({ coalesceKey: `branch:${branchId}` });

      set(state => {
        const node = state.nodes.find(n => n.id === nodeId);

        if (node?.type !== "condition") {
          return;
        }

        const branch = node.data.branches?.find(b => b.id === branchId);

        if (!branch) {
          return;
        }

        Object.assign(branch, patch);
        state.isDirty = true;
        state.changeVersion++;
      });
    },

    addConditionBranch: nodeId => {
      const { readonly, nodes } = get();

      if (readonly || nodes.find(n => n.id === nodeId)?.type !== "condition") {
        return;
      }

      get().checkpoint();

      set(state => {
        const node = state.nodes.find(n => n.id === nodeId);

        if (node?.type !== "condition") {
          return;
        }

        const branches = node.data.branches ??= [];
        // max+1, not count+1: after deleting a low-priority branch, count+1
        // would collide with a surviving branch's priority — and duplicate
        // priorities are rejected at deploy ("first match wins" needs a
        // total evaluation order).
        const nextPriority = Math.max(0, ...branches.filter(b => !b.isDefault).map(b => b.priority)) + 1;
        const newBranch: ConditionBranchDefinition = {
          id: `branch_${generateId()}`,
          label: `条件${nextPriority}`,
          priority: nextPriority
        };
        const defaultIndex = branches.findIndex(b => b.isDefault);

        if (defaultIndex === -1) {
          branches.push(newBranch);
        } else {
          branches.splice(defaultIndex, 0, newBranch);
        }

        state.isDirty = true;
        state.changeVersion++;
      });
    },

    removeConditionBranch: (nodeId, branchId) => {
      const { readonly, nodes } = get();
      const target = nodes.find(n => n.id === nodeId);

      if (readonly || target?.type !== "condition" || !target.data.branches?.some(b => b.id === branchId)) {
        return;
      }

      get().checkpoint();

      set(state => {
        const node = state.nodes.find(n => n.id === nodeId);

        if (node?.type !== "condition" || !node.data.branches) {
          return;
        }

        const nextBranches = node.data.branches.filter(b => b.id !== branchId);

        if (nextBranches.length === node.data.branches.length) {
          return;
        }

        node.data.branches = nextBranches;
        // The branch handle disappears with the branch — its edges must go too,
        // or they would survive invisibly and corrupt the serialized definition.
        state.edges = state.edges.filter(edge => !(edge.source === nodeId && edge.sourceHandle === branchId));
        state.isDirty = true;
        state.changeVersion++;
      });
    }
  };
};
