import type { SliceStateCreator } from "@vef-framework-react/core";
import type { OnConnect, OnEdgesChange, OnNodesChange, XYPosition } from "@xyflow/react";

import type { FlowValidationError } from "../shared/flow-validation";
import type { ConditionBranchDefinition, FlowDefinition, FlowEdge, FlowNode, NodeData, NodeKind } from "../types";

/**
 * Graph data CRUD — nodes, edges, and their event handlers
 */
export interface GraphSlice {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodesChange: OnNodesChange<FlowNode>;
  onEdgesChange: OnEdgesChange<FlowEdge>;
  onConnect: OnConnect;
  /**
   * Add a node of the given kind. Returns the new node's id, or null when the
   * add was refused (readonly, or the kind's max count is reached) so callers
   * can chain follow-up interactions like selecting the new node.
   */
  addNode: (type: NodeKind, position: XYPosition, data?: Partial<NodeData>) => string | null;
  /**
   * Remove a node together with its connected edges. Refused for readonly
   * editors and non-deletable kinds (start/end). Prunes rollback-target
   * references pointing at the removed node, mirroring the Backspace path.
   */
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  updateNodeData: (nodeId: string, data: Partial<NodeData>) => void;
  /**
   * Batch-update node positions for a committed layout (e.g. auto-layout). Marks
   * the flow dirty and bumps changeVersion so the new positions reach onChange.
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
   * Remove a branch from a condition node. Cascades removal of the edges
   * connected to the branch handle — branch and edges form one graph invariant,
   * so the store owns the consistency, not the config UI.
   */
  removeConditionBranch: (nodeId: string, branchId: string) => void;
}

/**
 * UI interaction state
 */
export interface InteractionSlice {
  selectedNodeId: string | null;
  hoveredEdgeId: string | null;
  readonly: boolean;
  selectNode: (nodeId: string | null) => void;
  setHoveredEdgeId: (edgeId: string | null) => void;
  setReadonly: (readonly: boolean) => void;
}

/**
 * Live structural validation surfaced on the canvas. Issues are produced by
 * `validateFlowDefinition` (the deploy-contract mirror), so a clean canvas
 * means a deployable flow.
 */
export interface ValidationSlice {
  validationIssues: FlowValidationError[];
  /**
   * Issue count per node id — node chrome subscribes to its own entry so an
   * unrelated node's problem never re-renders it.
   */
  nodeIssueCounts: Record<string, number>;
  setValidationIssues: (issues: FlowValidationError[]) => void;
}

/**
 * Serialization and dirty tracking
 */
export interface FlowSlice {
  isDirty: boolean;
  /**
   * @internal
   */
  changeVersion: number;
  loadDefinition: (definition: FlowDefinition) => void;
  toDefinition: () => FlowDefinition;
  reset: () => void;
}

/**
 * One step of the undo timeline: the whole graph as it was before an edit.
 * Whole-snapshot entries are cheap here — immer's copy-on-write means an
 * entry shares every untouched node/edge object with its neighbors.
 */
export interface HistoryEntry {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * How a checkpoint folds into the undo timeline. Consecutive checkpoints
 * sharing a `coalesceKey` collapse into one step (the run's first snapshot
 * wins — it captured the pre-run state). `gesture` additionally ends the run
 * at the end of the current microtask, so the multiple xyflow callbacks of
 * ONE user gesture (a Backspace delete fires both onNodesChange and
 * onEdgesChange) fold together while the next gesture starts a fresh step.
 */
export interface CheckpointOptions {
  coalesceKey?: string;
  gesture?: boolean;
}

/**
 * Undo timeline. View state (selection, hover, viewport) is never
 * checkpointed — only the serialized graph contract (nodes + edges).
 */
export interface HistorySlice {
  past: HistoryEntry[];
  future: HistoryEntry[];
  /**
   * Called by graph mutators before they apply a user edit.
   *
   * @internal
   */
  checkpoint: (options?: CheckpointOptions) => void;
  /**
   * Starts a new undo step (selection changes, drag end, undo/redo).
   *
   * @internal
   */
  breakCoalescing: () => void;
  undo: () => void;
  redo: () => void;
}

/**
 * Combined editor state
 */
export type EditorState = GraphSlice & InteractionSlice & FlowSlice & ValidationSlice & HistorySlice;

/**
 * Slice creator matching the middleware signature of createComponentStore
 */
export type EditorSliceCreator<T> = SliceStateCreator<EditorState, T>;
