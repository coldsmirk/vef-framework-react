import type { FlowDefinition, FormFieldDefinition, NodeDefinition } from "../types";

import { describe, expect, it } from "vitest";

import { validateFlowDefinition } from "./flow-validation";

/**
 * Build a minimal valid start → approval → end definition; callers override
 * the approval node to provoke specific violations.
 */
function flowWith(approvalNode: Partial<Extract<NodeDefinition, { kind: "approval" }>>): FlowDefinition {
  return {
    nodes: [
      {
        id: "start_1",
        kind: "start",
        position: { x: 0, y: 0 },
        data: { name: "开始" }
      },
      {
        id: "approval_1",
        kind: "approval",
        position: { x: 200, y: 0 },
        data: { name: "审批" },
        ...approvalNode
      },
      {
        id: "end_1",
        kind: "end",
        position: { x: 400, y: 0 },
        data: { name: "结束" }
      }
    ],
    edges: [
      {
        id: "e1",
        source: "start_1",
        target: "approval_1"
      },
      {
        id: "e2",
        source: "approval_1",
        target: "end_1"
      }
    ]
  };
}

function codesOf(definition: FlowDefinition, formFields: FormFieldDefinition[] = []): string[] {
  return validateFlowDefinition(definition, formFields).map(e => e.code);
}

describe("validateFlowDefinition node config rules", () => {
  it("accepts a bare designer-default approval node", () => {
    expect(codesOf(flowWith({}))).toEqual([]);
  });

  it("rejects a ratio pass rule without a usable ratio", () => {
    expect(codesOf(flowWith({ data: { name: "审批", passRule: "ratio" } })))
      .toContain("pass_ratio_range");
    expect(codesOf(flowWith({
      data: {
        name: "审批",
        passRule: "ratio",
        passRatio: 120
      }
    })))
      .toContain("pass_ratio_range");
    expect(codesOf(flowWith({
      data: {
        name: "审批",
        passRule: "ratio",
        // Percentage convention: 0.6 means 0.6%, an unusual but legal threshold.
        passRatio: 0.6
      }
    })))
      .toEqual([]);
  });

  it("rejects out-of-vocabulary enum values", () => {
    expect(codesOf(flowWith({ data: { name: "审批", executionType: "auto" as never } })))
      .toContain("invalid_execution_type");
    expect(codesOf(flowWith({ data: { name: "审批", passRule: "any_reject" as never } })))
      .toContain("invalid_pass_rule");
    expect(codesOf(flowWith({ data: { name: "审批", rollbackType: "first" as never } })))
      .toContain("invalid_rollback_type");
    expect(codesOf(flowWith({ data: { name: "审批", emptyAssigneeAction: "skip" as never } })))
      .toContain("invalid_empty_assignee_action");
  });

  it("rejects out-of-vocabulary addAssigneeTypes entries", () => {
    // The backend rejects these at JSON decode time (strict UnmarshalJSON on
    // AddAssigneeType), so the editor validator must catch them pre-deploy.
    expect(codesOf(flowWith({ data: { name: "审批", addAssigneeTypes: ["before", "sideways" as never] } })))
      .toContain("invalid_add_assignee_type");
    expect(codesOf(flowWith({ data: { name: "审批", addAssigneeTypes: ["before", "after", "parallel"] } })))
      .toEqual([]);
  });

  it("rejects auto_reject on handle nodes", () => {
    const definition = flowWith({});
    const handleNode = definition.nodes[1]!;
    Object.assign(handleNode, {
      kind: "handle",
      data: {
        name: "办理",
        executionType: "auto_reject",
        timeoutAction: "auto_reject"
      }
    });

    const codes = validateFlowDefinition(definition).map(e => e.code);

    expect(codes).toContain("handle_execution_auto_reject");
    expect(codes).toContain("handle_timeout_auto_reject");
  });

  it("rejects duplicate non-default branch priorities", () => {
    const definition: FlowDefinition = {
      nodes: [
        {
          id: "start_1",
          kind: "start",
          position: { x: 0, y: 0 },
          data: { name: "开始" }
        },
        {
          id: "cond_1",
          kind: "condition",
          position: { x: 200, y: 0 },
          data: {
            name: "条件",
            branches: [
              {
                id: "b1",
                label: "条件1",
                priority: 1,
                conditionGroups: [
                  {
                    conditions: [
                      {
                        kind: "expression",
                        subject: "",
                        operator: "",
                        value: undefined,
                        expression: "true"
                      }
                    ]
                  }
                ]
              },
              {
                id: "b2",
                label: "条件2",
                priority: 1,
                conditionGroups: [
                  {
                    conditions: [
                      {
                        kind: "expression",
                        subject: "",
                        operator: "",
                        value: undefined,
                        expression: "true"
                      }
                    ]
                  }
                ]
              },
              {
                id: "b_default",
                label: "默认",
                priority: 99,
                isDefault: true
              }
            ]
          }
        },
        {
          id: "end_1",
          kind: "end",
          position: { x: 400, y: 0 },
          data: { name: "结束" }
        }
      ],
      edges: [
        {
          id: "e1",
          source: "start_1",
          target: "cond_1"
        },
        {
          id: "e2",
          source: "cond_1",
          target: "end_1",
          sourceHandle: "b1"
        },
        {
          id: "e3",
          source: "cond_1",
          target: "end_1",
          sourceHandle: "b2"
        },
        {
          id: "e4",
          source: "cond_1",
          target: "end_1",
          sourceHandle: "b_default"
        }
      ]
    };

    expect(codesOf(definition)).toContain("duplicate_branch_priority");
  });

  it("rejects dangling and self rollback targets", () => {
    expect(codesOf(flowWith({
      data: {
        name: "审批",
        rollbackType: "specified",
        rollbackTargetKeys: ["ghost"]
      }
    }))).toContain("rollback_target_unknown");

    expect(codesOf(flowWith({
      data: {
        name: "审批",
        rollbackType: "specified",
        rollbackTargetKeys: ["approval_1"]
      }
    }))).toContain("rollback_target_self");
  });

  it("requires fallback users for transfer_specified", () => {
    expect(codesOf(flowWith({ data: { name: "审批", emptyAssigneeAction: "transfer_specified" } })))
      .toContain("fallback_users_required");
    expect(codesOf(flowWith({
      data: {
        name: "审批",
        emptyAssigneeAction: "transfer_specified",
        fallbackUserIds: ["u1"]
      }
    }))).toEqual([]);
  });

  it("requires admin users for transfer_admin", () => {
    expect(codesOf(flowWith({ data: { name: "审批", emptyAssigneeAction: "transfer_admin" } })))
      .toContain("admin_users_required");
  });

  it("requires rollback targets for specified rollback", () => {
    expect(codesOf(flowWith({ data: { name: "审批", rollbackType: "specified" } })))
      .toContain("rollback_targets_required");
  });

  it("requires a form field for form_field assignees and ccs", () => {
    expect(codesOf(flowWith({
      data: { name: "审批", assignees: [{ kind: "form_field", sortOrder: 1 }] }
    }))).toContain("assignee_form_field_required");

    expect(codesOf(flowWith({
      data: { name: "审批", ccs: [{ kind: "form_field" }] }
    }))).toContain("cc_form_field_required");
  });

  it("rejects unknown assignee and cc kinds", () => {
    expect(codesOf(flowWith({
      data: { name: "审批", assignees: [{ kind: "robot" as never, sortOrder: 1 }] }
    }))).toContain("invalid_assignee_kind");

    expect(codesOf(flowWith({
      data: { name: "审批", ccs: [{ kind: "robot" as never }] }
    }))).toContain("invalid_cc_kind");
  });

  it("validates branch conditions on condition nodes", () => {
    const definition: FlowDefinition = {
      nodes: [
        {
          id: "start_1",
          kind: "start",
          position: { x: 0, y: 0 },
          data: { name: "开始" }
        },
        {
          id: "cond_1",
          kind: "condition",
          position: { x: 200, y: 0 },
          data: {
            name: "条件",
            branches: [
              {
                id: "b1",
                label: "空字段",
                priority: 1,
                conditionGroups: [
                  {
                    conditions: [
                      {
                        kind: "field",
                        subject: "",
                        operator: "eq",
                        value: 1,
                        expression: ""
                      }
                    ]
                  }
                ]
              },
              {
                id: "b2",
                label: "空表达式",
                priority: 2,
                conditionGroups: [
                  {
                    conditions: [
                      {
                        kind: "expression",
                        subject: "",
                        operator: "eq",
                        value: undefined,
                        expression: "  "
                      }
                    ]
                  }
                ]
              },
              {
                id: "b_default",
                label: "默认",
                priority: 99,
                isDefault: true
              }
            ]
          }
        },
        {
          id: "end_1",
          kind: "end",
          position: { x: 400, y: 0 },
          data: { name: "结束" }
        }
      ],
      edges: [
        {
          id: "e1",
          source: "start_1",
          target: "cond_1"
        },
        {
          id: "e2",
          source: "cond_1",
          target: "end_1",
          sourceHandle: "b1"
        },
        {
          id: "e3",
          source: "cond_1",
          target: "end_1",
          sourceHandle: "b2"
        },
        {
          id: "e4",
          source: "cond_1",
          target: "end_1",
          sourceHandle: "b_default"
        }
      ]
    };

    const codes = codesOf(definition);

    expect(codes).toContain("condition_subject_required");
    expect(codes).toContain("condition_expression_required");
  });
});

/**
 * Build a start → condition(+branches) → approval → end definition for
 * branch-condition rules; the condition node routes b1 to the approval node
 * and the default branch shares that edge target via a second handle edge.
 */
function conditionFlowWith(branches: unknown): FlowDefinition {
  return {
    nodes: [
      {
        id: "start_1",
        kind: "start",
        position: { x: 0, y: 0 },
        data: { name: "开始" }
      },
      {
        id: "cond_1",
        kind: "condition",
        position: { x: 200, y: 0 },
        data: { name: "条件", branches } as never
      },
      {
        id: "approval_1",
        kind: "approval",
        position: { x: 400, y: 0 },
        data: { name: "审批" }
      },
      {
        id: "end_1",
        kind: "end",
        position: { x: 600, y: 0 },
        data: { name: "结束" }
      }
    ],
    edges: [
      {
        id: "e1",
        source: "start_1",
        target: "cond_1"
      },
      {
        id: "e2",
        source: "cond_1",
        target: "approval_1",
        sourceHandle: "b1"
      },
      {
        id: "e3",
        source: "cond_1",
        target: "approval_1",
        sourceHandle: "b_default"
      },
      {
        id: "e4",
        source: "approval_1",
        target: "end_1"
      }
    ]
  };
}

const defaultBranch = {
  id: "b_default",
  label: "默认",
  priority: 99,
  isDefault: true
};

function aggregateBranch(condition: Record<string, unknown>) {
  return [
    {
      id: "b1",
      label: "条件1",
      priority: 1,
      conditionGroups: [
        {
          conditions: [
            {
              kind: "field",
              subject: "items",
              operator: "gt",
              value: 1,
              expression: "",
              ...condition
            }
          ]
        }
      ]
    },
    defaultBranch
  ];
}

describe("validateFlowDefinition branch condition structure", () => {
  it("rejects a non-default branch without condition groups", () => {
    const codes = codesOf(conditionFlowWith([
      {
        id: "b1",
        label: "条件1",
        priority: 1
      },
      defaultBranch
    ]));

    expect(codes).toContain("branch_conditions_required");
  });

  it("rejects an empty condition group", () => {
    const codes = codesOf(conditionFlowWith([
      {
        id: "b1",
        label: "条件1",
        priority: 1,
        conditionGroups: [{ conditions: [] }]
      },
      defaultBranch
    ]));

    expect(codes).toContain("condition_group_empty");
  });
});

describe("validateFlowDefinition aggregate conditions", () => {
  it("accepts a well-formed sum aggregate", () => {
    const codes = codesOf(conditionFlowWith(aggregateBranch({ aggregate: "sum", column: "qty" })));

    expect(codes).toEqual([]);
  });

  it("accepts count without a column", () => {
    const codes = codesOf(conditionFlowWith(aggregateBranch({ aggregate: "count" })));

    expect(codes).toEqual([]);
  });

  it("rejects an unknown aggregate kind", () => {
    const codes = codesOf(conditionFlowWith(aggregateBranch({ aggregate: "median", column: "qty" })));

    expect(codes).toContain("invalid_aggregate");
  });

  it("rejects non-numeric operators over a fold", () => {
    const codes = codesOf(conditionFlowWith(aggregateBranch({
      aggregate: "sum",
      column: "qty",
      operator: "contains"
    })));

    expect(codes).toContain("aggregate_operator");
  });

  it("rejects count with a column", () => {
    const codes = codesOf(conditionFlowWith(aggregateBranch({ aggregate: "count", column: "qty" })));

    expect(codes).toContain("aggregate_column_forbidden");
  });

  it("rejects sum without a column", () => {
    const codes = codesOf(conditionFlowWith(aggregateBranch({ aggregate: "sum" })));

    expect(codes).toContain("aggregate_column_required");
  });

  it("rejects an aggregate on an expression condition", () => {
    const codes = codesOf(conditionFlowWith(aggregateBranch({
      kind: "expression",
      expression: "true",
      aggregate: "sum",
      column: "qty"
    })));

    expect(codes).toContain("aggregate_on_expression");
  });
});

describe("validateFlowDefinition sequential add-assignee", () => {
  it("rejects the parallel add-assignee type on sequential nodes", () => {
    const codes = codesOf(flowWith({
      data: {
        name: "审批",
        approvalMethod: "sequential",
        addAssigneeTypes: ["before", "parallel"]
      } as never
    }));

    expect(codes).toContain("sequential_parallel_add_assignee");
  });

  it("accepts before/after on sequential nodes", () => {
    const codes = codesOf(flowWith({
      data: {
        name: "审批",
        approvalMethod: "sequential",
        addAssigneeTypes: ["before", "after"]
      } as never
    }));

    expect(codes).toEqual([]);
  });
});

const FORM_FIELDS: FormFieldDefinition[] = [
  {
    key: "reason",
    kind: "input",
    label: "原因"
  },
  {
    key: "amount",
    kind: "number",
    label: "金额"
  }
];

/**
 * Build a start → cc → end definition, swapping the default approval node for
 * a cc node the same way {@link flowWith} builds approval-node cases — mirrors
 * the existing handle-node swap (see "rejects auto_reject on handle nodes").
 */
function ccFlowWith(fieldPermissions: Record<string, string>): FlowDefinition {
  const definition = flowWith({});
  const ccNode = definition.nodes[1]!;

  Object.assign(ccNode, {
    kind: "cc",
    data: { name: "抄送", fieldPermissions }
  });

  return definition;
}

describe("validateFlowDefinition field permissions", () => {
  it("accepts the full vocabulary on an approval node", () => {
    const codes = codesOf(flowWith({
      data: {
        name: "审批",
        fieldPermissions: {
          reason: "visible",
          amount: "editable"
        }
      }
    }), FORM_FIELDS);

    expect(codes).toEqual([]);
  });

  it("accepts visible/hidden on a cc node", () => {
    const codes = codesOf(ccFlowWith({ reason: "visible", amount: "hidden" }), FORM_FIELDS);

    expect(codes).toEqual([]);
  });

  it("rejects an out-of-enum permission value", () => {
    const codes = codesOf(flowWith({
      data: { name: "审批", fieldPermissions: { reason: "locked" as never } }
    }), FORM_FIELDS);

    expect(codes).toContain("invalid_field_permission");
  });

  it("rejects an unknown field key", () => {
    const codes = codesOf(flowWith({
      data: { name: "审批", fieldPermissions: { ghost: "visible" } }
    }), FORM_FIELDS);

    expect(codes).toContain("field_permission_key_unknown");
  });

  it("rejects editable on a cc node", () => {
    const codes = codesOf(ccFlowWith({ reason: "editable" }), FORM_FIELDS);

    expect(codes).toContain("cc_field_permission_not_allowed");
  });

  it("rejects required on a cc node", () => {
    const codes = codesOf(ccFlowWith({ reason: "required" }), FORM_FIELDS);

    expect(codes).toContain("cc_field_permission_not_allowed");
  });

  it("accepts a node without field permissions", () => {
    expect(codesOf(flowWith({}), FORM_FIELDS)).toEqual([]);
  });

  it("rejects field permissions when the form has zero fields", () => {
    const codes = codesOf(flowWith({
      data: { name: "审批", fieldPermissions: { reason: "visible" } }
    }));

    expect(codes).toContain("field_permission_key_unknown");
  });

  it("does not gate required on a conditionally-hidden field", () => {
    // The required-on-conditionally-hidden deadlock hint is a NON-blocking
    // FieldPermissionTable tooltip, never a validation issue — the consumers
    // (handlePublish, the wizard step) gate on `errors.length === 0`, so a
    // warning here would wrongly block publish. hasConditionalVisibility rides
    // the field inventory but validateFlowDefinition only reads the key, so the
    // gate stays clean.
    const conditionallyHidden: FormFieldDefinition[] = [
      {
        key: "reason",
        kind: "input",
        label: "原因",
        hasConditionalVisibility: true
      }
    ];
    const codes = codesOf(flowWith({
      data: { name: "审批", fieldPermissions: { reason: "required" } }
    }), conditionallyHidden);

    expect(codes).toEqual([]);
  });
});

describe("validateFlowDefinition formFields tri-state", () => {
  it("skips only the key-existence check when the inventory is unavailable (undefined)", () => {
    // No second argument at all — distinct from codesOf's own `= []` default,
    // which simulates the "form has zero fields" state instead.
    const codes = validateFlowDefinition(flowWith({
      data: { name: "审批", fieldPermissions: { ghost: "locked" as never } }
    })).map(e => e.code);

    expect(codes).not.toContain("field_permission_key_unknown");
    // The enum-validity check needs no inventory and still runs.
    expect(codes).toContain("invalid_field_permission");
  });

  it("still runs the CC visible/hidden-subset check when the inventory is unavailable", () => {
    const codes = validateFlowDefinition(ccFlowWith({ ghost: "editable" })).map(e => e.code);

    expect(codes).not.toContain("field_permission_key_unknown");
    expect(codes).toContain("cc_field_permission_not_allowed");
  });

  it("flags every key as dangling when the inventory is an explicit empty array", () => {
    const codes = codesOf(flowWith({
      data: { name: "审批", fieldPermissions: { reason: "visible" } }
    }), []);

    expect(codes).toContain("field_permission_key_unknown");
  });
});

describe("validateFlowDefinition required field permission vs. auto_pass timeout", () => {
  it("rejects required + auto_pass on an approval node", () => {
    const codes = codesOf(flowWith({
      data: {
        name: "审批",
        timeoutAction: "auto_pass",
        fieldPermissions: { reason: "required" }
      }
    }), FORM_FIELDS);

    expect(codes).toContain("field_permission_required_auto_pass");
  });

  it("rejects required + auto_pass on a handle node", () => {
    const definition = flowWith({});
    const handleNode = definition.nodes[1]!;

    Object.assign(handleNode, {
      kind: "handle",
      data: {
        name: "办理",
        timeoutAction: "auto_pass",
        fieldPermissions: { reason: "required" }
      }
    });

    const codes = codesOf(definition, FORM_FIELDS);

    expect(codes).toContain("field_permission_required_auto_pass");
  });

  it("accepts required + auto_reject", () => {
    const codes = codesOf(flowWith({
      data: {
        name: "审批",
        timeoutAction: "auto_reject",
        fieldPermissions: { reason: "required" }
      }
    }), FORM_FIELDS);

    expect(codes).not.toContain("field_permission_required_auto_pass");
  });

  it("accepts visible-only + auto_pass", () => {
    const codes = codesOf(flowWith({
      data: {
        name: "审批",
        timeoutAction: "auto_pass",
        fieldPermissions: { reason: "visible" }
      }
    }), FORM_FIELDS);

    expect(codes).not.toContain("field_permission_required_auto_pass");
  });

  it("accepts required with an omitted timeout action, mirroring its normalized default (none)", () => {
    // TASK_NODE_DEFAULTS.timeoutAction resolves an omitted field to "none",
    // never "auto_pass", so a required permission alone never conflicts.
    const codes = codesOf(flowWith({
      data: { name: "审批", fieldPermissions: { reason: "required" } }
    }), FORM_FIELDS);

    expect(codes).not.toContain("field_permission_required_auto_pass");
  });

  it("needs no form inventory: still runs when formFields is undefined", () => {
    const codes = validateFlowDefinition(flowWith({
      data: {
        name: "审批",
        timeoutAction: "auto_pass",
        fieldPermissions: { reason: "required" }
      }
    })).map(e => e.code);

    expect(codes).toContain("field_permission_required_auto_pass");
  });
});
