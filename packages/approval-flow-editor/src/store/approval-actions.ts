import type { EditorState } from "@coldsmirk/nodeloom-core";
import type { XYPosition } from "@xyflow/react";

import type { AnyNodeData, ConditionBranchDefinition, NodeDataMap, NodeKind } from "../types";

import { createNode, useEditorStoreApi } from "@coldsmirk/nodeloom-core";
import { generateId } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { normalizeNodeData } from "../shared/normalize-node-data";
import { nodeConfig } from "./config-access";
import { engineNodeRegistry } from "./engine-specs";

/**
 * Domain actions over the nodeloom store — the approval editor's mutators, expressed through the
 * engine's primitives so every edit keeps its invariants: readonly and the add-rule stack gate
 * `addNode`; keystroke edits coalesce into one undo step; the branch ↔ edge invariant commits
 * atomically via `transact`. (Reference pruning on delete lives in `EditorOptions.onElementsDeleted`,
 * not here — it must cover canvas-native deletion too.)
 */
export interface ApprovalActions {
  /**
   * Add a node of the given kind. Returns the new node's id (already selected — the engine's
   * `addNode` selects what it appends), or `null` when the engine refuses (readonly, or the
   * kind's `maxCount` is reached) so callers can chain follow-up interactions.
   */
  addNode: <K extends NodeKind>(kind: K, position: XYPosition, data?: Partial<NodeDataMap[K]>) => string | null;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  /**
   * Merge a patch into the node's business fields, folding a run of keystrokes into one undo step.
   */
  updateNodeData: (nodeId: string, data: Partial<AnyNodeData>) => void;
  /**
   * Batch-update node positions for a committed layout (e.g. auto-layout): dispatched as one
   * position-change batch, so a single undo restores every pre-layout position at once.
   */
  updateNodePositions: (positions: Map<string, XYPosition>) => void;
  /**
   * Patch one branch of a condition node (label, priority, conditionGroups, …).
   */
  updateConditionBranch: (nodeId: string, branchId: string, patch: Partial<ConditionBranchDefinition>) => void;
  /**
   * Append a new branch to a condition node, inserted before the default branch.
   */
  addConditionBranch: (nodeId: string) => void;
  /**
   * Remove a branch from a condition node. The branch and the edges connected to its handle form
   * one graph invariant, so they leave in one atomic step (`transact`): a single undo restores both.
   */
  removeConditionBranch: (nodeId: string, branchId: string) => void;
}

function conditionBranches(state: EditorState, nodeId: string): ConditionBranchDefinition[] | undefined {
  const node = state.nodes.find(candidate => candidate.id === nodeId);

  return nodeConfig(node, "condition")?.branches;
}

function buildActions(getState: () => EditorState): ApprovalActions {
  return {
    addNode: (kind, position, data) => {
      const spec = engineNodeRegistry.get(kind);

      if (!spec) {
        return null;
      }

      const id = `${kind}_${generateId()}`;
      const node = createNode(spec, position, id);

      if (data) {
        // Overrides land on top of the spec's normalized defaults; re-normalize so a partial
        // override still serializes fully explicit.
        node.data = {
          ...node.data,
          config: normalizeNodeData(kind, { ...node.data.config, ...data } as NodeDataMap[typeof kind])
        };
      }

      return getState().addNode(node) ? id : null;
    },

    removeNode: nodeId => getState().deleteNode(nodeId),

    removeEdge: edgeId => getState().deleteEdge(edgeId),

    updateNodeData: (nodeId, data) => {
      getState().updateNodeConfig(nodeId, data, { coalesce: true });
    },

    updateNodePositions: positions => {
      // One change batch = one persistence boundary = one undo step; `dragging` absent marks the
      // positions as settled, so the engine persists them.
      const changes = [...positions].map(([id, position]) => {
        return {
          type: "position" as const,
          id,
          position
        };
      });

      if (changes.length > 0) {
        getState().onNodesChange(changes);
      }
    },

    updateConditionBranch: (nodeId, branchId, patch) => {
      const current = conditionBranches(getState(), nodeId);

      if (!current?.some(branch => branch.id === branchId)) {
        return;
      }

      const branches = current.map(branch => branch.id === branchId ? { ...branch, ...patch } : branch);

      getState().updateNodeConfig(nodeId, { branches }, { coalesce: true });
    },

    addConditionBranch: nodeId => {
      const state = getState();
      const node = state.nodes.find(candidate => candidate.id === nodeId);
      const config = nodeConfig(node, "condition");

      if (!config) {
        return;
      }

      const branches = config.branches ?? [];
      // max+1, not count+1: after deleting a low-priority branch, count+1 would collide with a
      // surviving branch's priority — and duplicate priorities are rejected at deploy ("first
      // match wins" needs a total evaluation order).
      const nextPriority = Math.max(0, ...branches.filter(branch => !branch.isDefault).map(branch => branch.priority)) + 1;
      const newBranch: ConditionBranchDefinition = {
        id: `branch_${generateId()}`,
        label: `条件${nextPriority}`,
        priority: nextPriority
      };
      const defaultIndex = branches.findIndex(branch => branch.isDefault);
      const next = defaultIndex === -1
        ? [...branches, newBranch]
        : [...branches.slice(0, defaultIndex), newBranch, ...branches.slice(defaultIndex)];

      state.updateNodeConfig(nodeId, { branches: next });
    },

    removeConditionBranch: (nodeId, branchId) => {
      const state = getState();
      const current = conditionBranches(state, nodeId);

      if (!current?.some(branch => branch.id === branchId)) {
        return;
      }

      const branches = current.filter(branch => branch.id !== branchId);
      // The branch handle disappears with the branch — its edges must go too, or they would
      // survive invisibly and corrupt the serialized definition. One atomic boundary: a single
      // undo restores the branch together with its edges.
      const edgeIds = state.edges
        .filter(edge => edge.source === nodeId && edge.sourceHandle === branchId)
        .map(edge => edge.id);

      state.transact(() => {
        state.updateNodeConfig(nodeId, { branches });

        if (edgeIds.length > 0) {
          state.deleteElements({ edgeIds });
        }
      });
    }
  };
}

/**
 * The approval editor's domain actions, bound to the ambient nodeloom store. Identity-stable for
 * the store's lifetime, so subscribing components can list the whole object in dependency arrays.
 */
export function useApprovalActions(): ApprovalActions {
  const storeApi = useEditorStoreApi();

  return useMemo(() => buildActions(() => storeApi.getState()), [storeApi]);
}
