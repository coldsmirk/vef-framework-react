import type { ApprovalNodeData, AssigneeDefinition, CcNodeData, HandleNodeData } from "../types";

import { describe, expect, it } from "vitest";

import { APPROVAL_NODE_DEFAULTS, normalizeNodeData, TASK_NODE_DEFAULTS } from "./normalize-node-data";

describe("normalizeNodeData", () => {
  it("resolves omitted approval fields to designer defaults", () => {
    const normalized = normalizeNodeData("approval", { name: "审批节点" });

    expect(normalized.name).toBe("审批节点");
    expect(normalized.approvalMethod).toBe("parallel");
    expect(normalized.passRule).toBe("all");
    expect(normalized.passRatio).toBe(100);
    expect(normalized.executionType).toBe("manual");
    expect(normalized.emptyAssigneeAction).toBe("auto_pass");
    expect(normalized.sameApplicantAction).toBe("self_approve");
    expect(normalized.consecutiveApproverAction).toBe("none");
    expect(normalized.rollbackType).toBe("previous");
    expect(normalized.rollbackDataStrategy).toBe("keep");
    expect(normalized.timeoutAction).toBe("none");
    expect(normalized.isTransferAllowed).toBe(true);
    expect(normalized.isRollbackAllowed).toBe(true);
    expect(normalized.isAddAssigneeAllowed).toBe(true);
    expect(normalized.isRemoveAssigneeAllowed).toBe(true);
    expect(normalized.isManualCcAllowed).toBe(true);
    expect(normalized.addAssigneeTypes).toEqual(["before", "after", "parallel"]);
  });

  it("preserves explicit values including false", () => {
    const data: ApprovalNodeData = {
      name: "严格节点",
      approvalMethod: "sequential",
      passRule: "any",
      isRollbackAllowed: false,
      isTransferAllowed: false,
      isManualCcAllowed: false,
      addAssigneeTypes: ["before"]
    };

    const normalized = normalizeNodeData("approval", data);

    expect(normalized.approvalMethod).toBe("sequential");
    expect(normalized.passRule).toBe("any");
    expect(normalized.isRollbackAllowed).toBe(false);
    expect(normalized.isTransferAllowed).toBe(false);
    expect(normalized.isManualCcAllowed).toBe(false);
    expect(normalized.addAssigneeTypes).toEqual(["before"]);
  });

  it("folds rollbackType none into the isRollbackAllowed switch", () => {
    // "none" is deny-by-configuration on the backend; the editor expresses
    // that as isRollbackAllowed=false and never renders "none" in its
    // target-type select.
    const normalized = normalizeNodeData("approval", { name: "审批", rollbackType: "none" });

    expect(normalized.isRollbackAllowed).toBe(false);
    expect(normalized.rollbackType).toBe("previous");
  });

  it("does not share the default addAssigneeTypes array between nodes", () => {
    const first = normalizeNodeData("approval", {});
    const second = normalizeNodeData("approval", {});

    expect(first.addAssigneeTypes).not.toBe(second.addAssigneeTypes);
    expect(first.addAssigneeTypes).not.toBe(APPROVAL_NODE_DEFAULTS.addAssigneeTypes);
  });

  it("does not alias nested input arrays after normalization", () => {
    const assignees: AssigneeDefinition[] = [
      {
        kind: "user",
        ids: ["u1"],
        sortOrder: 1
      }
    ];

    const normalized = normalizeNodeData("approval", { name: "审批", assignees });

    expect(normalized.assignees).toEqual(assignees);
    expect(normalized.assignees).not.toBe(assignees);
    expect(normalized.assignees?.[0]).not.toBe(assignees[0]);
  });

  it("resolves handle defaults from the shared task defaults", () => {
    const normalized: HandleNodeData = normalizeNodeData("handle", { name: "办理节点" });

    expect(normalized.executionType).toBe(TASK_NODE_DEFAULTS.executionType);
    expect(normalized.emptyAssigneeAction).toBe("auto_pass");
    expect(normalized.isTransferAllowed).toBe(true);
    expect(normalized.isOpinionRequired).toBe(false);
  });

  it("resolves cc defaults", () => {
    const normalized: CcNodeData = normalizeNodeData("cc", { name: "抄送节点" });

    expect(normalized.isReadConfirmRequired).toBe(false);
  });

  it("returns start/end/condition data as a detached deep copy", () => {
    const conditionData = {
      name: "条件",
      branches: [
        {
          id: "b1",
          label: "条件1",
          priority: 1
        }
      ]
    };

    expect(normalizeNodeData("start", { name: "开始" })).toEqual({ name: "开始" });

    const normalized = normalizeNodeData("condition", conditionData);

    expect(normalized).toEqual(conditionData);
    expect(normalized).not.toBe(conditionData);
    expect(normalized.branches).not.toBe(conditionData.branches);
    expect(normalized.branches?.[0]).not.toBe(conditionData.branches[0]);
  });
});
