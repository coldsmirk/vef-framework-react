import type {
  ApprovalNodeData,
  CcNodeData,
  HandleNodeData,
  NodeDataMap,
  NodeKind,
  TaskNodeData
} from "../types";

/**
 * Designer defaults for the fields shared by approval and handle nodes.
 * Mirrors the backend's `approval.Default*` constants (node_data.go) — the
 * two lists must stay in lockstep so "what the designer shows" and "what the
 * engine runs" are identical by construction.
 */
export const TASK_NODE_DEFAULTS = {
  executionType: "manual",
  emptyAssigneeAction: "auto_pass",
  isTransferAllowed: true,
  isOpinionRequired: false,
  timeoutHours: 0,
  timeoutAction: "none",
  timeoutNotifyBeforeHours: 0,
  urgeCooldownMinutes: 0
} as const satisfies Partial<TaskNodeData>;

/**
 * Designer defaults specific to approval nodes.
 */
export const APPROVAL_NODE_DEFAULTS = {
  ...TASK_NODE_DEFAULTS,
  approvalMethod: "parallel",
  passRule: "all",
  // Stored as a percentage in (0, 100] — the single convention shared with
  // the backend engine, which consumes the value verbatim.
  passRatio: 100,
  sameApplicantAction: "self_approve",
  consecutiveApproverAction: "none",
  rollbackType: "previous",
  rollbackDataStrategy: "keep",
  isRollbackAllowed: true,
  isAddAssigneeAllowed: true,
  addAssigneeTypes: ["before", "after", "parallel"],
  isRemoveAssigneeAllowed: true,
  isManualCcAllowed: true
} as const satisfies Partial<ApprovalNodeData>;

/**
 * Designer defaults specific to CC nodes.
 */
export const CC_NODE_DEFAULTS = {
  isReadConfirmRequired: false
} as const satisfies Partial<CcNodeData>;

/**
 * Resolve omitted fields of a node's data to their designer defaults.
 *
 * Every path into the editor store (hydrating a stored definition, adding a
 * node from the toolbar) runs through this, so node data is always explicit:
 * the serialized definition carries exactly the values the config panels
 * display, and the backend never has to guess what an omitted field meant.
 * Explicitly-set values — including `false` — are never overwritten.
 *
 * The returned object is a deep copy of the (normalized) input: store state
 * hydrated through this function never aliases the caller's data, so a host
 * mutating the definition it passed in cannot rewrite editor state behind
 * zustand's back (`core/immer` disables auto-freeze, so nothing would throw).
 */
export function normalizeNodeData<K extends NodeKind>(kind: K, data: NodeDataMap[K]): NodeDataMap[K] {
  switch (kind) {
    case "approval": {
      const approvalData: ApprovalNodeData = {
        ...APPROVAL_NODE_DEFAULTS,
        ...(data as ApprovalNodeData),
        addAssigneeTypes:
          (data as ApprovalNodeData).addAssigneeTypes ?? [...APPROVAL_NODE_DEFAULTS.addAssigneeTypes]
      };

      return structuredClone(approvalData) as NodeDataMap[K];
    }

    case "handle": {
      const handleData: HandleNodeData = { ...TASK_NODE_DEFAULTS, ...(data as HandleNodeData) };

      return structuredClone(handleData) as NodeDataMap[K];
    }

    case "cc": {
      const ccData: CcNodeData = { ...CC_NODE_DEFAULTS, ...(data as CcNodeData) };

      return structuredClone(ccData) as NodeDataMap[K];
    }

    default: {
      return structuredClone(data);
    }
  }
}
