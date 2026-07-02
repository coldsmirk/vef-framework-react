import type { FlowValidationError } from "../shared/flow-validation";

import { createComponentStore } from "@vef-framework-react/core";

/**
 * Group issues by their offending node. Issues without a nodeId (graph-level
 * problems like a cycle) have no canvas anchor and only appear in the
 * validation indicator list.
 */
export function countIssuesByNode(issues: FlowValidationError[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const issue of issues) {
    if (issue.nodeId) {
      counts[issue.nodeId] = (counts[issue.nodeId] ?? 0) + 1;
    }
  }

  return counts;
}

/**
 * Editor-local UI state that rides alongside the nodeloom graph store: readonly mirrors the host
 * prop reactively for chrome (the engine gate itself is `EditorOptions.readonly`), hover is pure
 * presentation, and the debounced deploy-contract validation results land here so node chrome and
 * the indicator subscribe to their own slices.
 */
export interface EditorUiState {
  readonly: boolean;
  hoveredEdgeId: string | null;
  validationIssues: FlowValidationError[];
  /**
   * Issue count per node id — node chrome subscribes to its own entry so an
   * unrelated node's problem never re-renders it.
   */
  nodeIssueCounts: Record<string, number>;
  setReadonly: (readonly: boolean) => void;
  setHoveredEdgeId: (edgeId: string | null) => void;
  setValidationIssues: (issues: FlowValidationError[]) => void;
}

export const {
  StoreProvider: EditorUiProvider,
  useStoreApi: useEditorUiStoreApi,
  useStore: useEditorUiStore
} = createComponentStore<EditorUiState, Pick<EditorUiState, "readonly">>(
  "ApprovalEditorUi",
  set => {
    return {
      readonly: false,
      hoveredEdgeId: null,
      validationIssues: [],
      nodeIssueCounts: {},

      setReadonly: readonly => {
        set(state => {
          state.readonly = readonly;
        });
      },

      setHoveredEdgeId: edgeId => {
        set(state => {
          state.hoveredEdgeId = edgeId;
        });
      },

      setValidationIssues: issues => {
        set(state => {
          state.validationIssues = issues;
          state.nodeIssueCounts = countIssuesByNode(issues);
        });
      }
    };
  }
);
