import type { FlowValidationError } from "../shared/flow-validation";
import type { EditorSliceCreator, ValidationSlice } from "./types";

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

export const createValidationSlice: EditorSliceCreator<ValidationSlice> = set => {
  return {
    validationIssues: [],
    nodeIssueCounts: {},

    setValidationIssues: issues => {
      set(state => {
        state.validationIssues = issues;
        state.nodeIssueCounts = countIssuesByNode(issues);
      });
    }
  };
};
