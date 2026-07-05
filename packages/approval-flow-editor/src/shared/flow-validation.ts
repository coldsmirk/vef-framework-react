import type {
  AddAssigneeType,
  ApprovalMethod,
  ApprovalNodeData,
  AssigneeKind,
  CcDefinition,
  ConditionBranchDefinition,
  ConditionDefinition,
  ConsecutiveApproverAction,
  EmptyAssigneeAction,
  ExecutionType,
  FlowDefinition,
  PassRule,
  RollbackDataStrategy,
  RollbackType,
  SameApplicantAction,
  TaskNodeData,
  TimeoutAction
} from "../types";

import { isNodeKind } from "../constants";
import { CONDITION_OPERATORS as CONDITION_OPERATOR_LIST } from "../types";

/**
 * Stable codes for structural validation problems. Each mirrors a rule enforced
 * by the backend `ValidateFlowDefinition` (service/flow_definition.go +
 * node_config_validation.go), so a definition that passes this validator
 * passes backend deploy validation.
 */
export type FlowValidationCode
  = | "no_nodes"
    | "empty_node_id"
    | "duplicate_node_id"
    | "invalid_node_kind"
    | "start_node_count"
    | "end_node_count"
    | "empty_edge_id"
    | "duplicate_edge_id"
    | "unknown_source_node"
    | "unknown_target_node"
    | "start_incoming"
    | "start_outgoing"
    | "end_outgoing"
    | "end_incoming"
    | "node_outgoing_count"
    | "node_source_handle"
    | "graph_cycle"
    | "node_unreachable"
    | "node_cannot_reach_end"
    | "condition_min_branches"
    | "condition_empty_branch_id"
    | "condition_duplicate_branch_id"
    | "condition_default_count"
    | "condition_missing_handle"
    | "condition_unknown_handle"
    | "condition_duplicate_handle"
    | "condition_branch_no_edge"
    | "invalid_assignee_kind"
    | "assignee_form_field_required"
    | "invalid_cc_kind"
    | "invalid_cc_timing"
    | "cc_form_field_required"
    | "invalid_execution_type"
    | "invalid_empty_assignee_action"
    | "invalid_timeout_action"
    | "invalid_approval_method"
    | "invalid_pass_rule"
    | "invalid_same_applicant_action"
    | "invalid_consecutive_approver_action"
    | "invalid_rollback_type"
    | "invalid_rollback_data_strategy"
    | "invalid_add_assignee_type"
    | "handle_execution_auto_reject"
    | "handle_timeout_auto_reject"
    | "fallback_users_required"
    | "admin_users_required"
    | "pass_ratio_range"
    | "rollback_targets_required"
    | "rollback_target_unknown"
    | "rollback_target_self"
    | "duplicate_branch_priority"
    | "condition_subject_required"
    | "invalid_condition_operator"
    | "condition_expression_required"
    | "invalid_condition_kind";

/**
 * Build a Set from a Record keyed by every member of a string union: omitting
 * a member (or adding a stray key) is a compile error, so each allow-list
 * below stays in lockstep with its type — and the types mirror the backend
 * enums.
 */
function enumSet<T extends string>(members: Record<T, null>): Set<string> {
  return new Set(Object.keys(members));
}

const ASSIGNEE_KINDS = enumSet<AssigneeKind>({
  user: null,
  role: null,
  department: null,
  self: null,
  superior: null,
  department_leader: null,
  form_field: null
});
const CC_KINDS = enumSet<CcDefinition["kind"]>({
  user: null,
  role: null,
  department: null,
  form_field: null
});
const CC_TIMINGS = enumSet<NonNullable<CcDefinition["timing"]>>({
  always: null,
  on_approve: null,
  on_reject: null
});
const EXECUTION_TYPES = enumSet<ExecutionType>({
  manual: null,
  auto_pass: null,
  auto_reject: null
});
const EMPTY_ASSIGNEE_ACTIONS = enumSet<EmptyAssigneeAction>({
  auto_pass: null,
  transfer_admin: null,
  transfer_superior: null,
  transfer_applicant: null,
  transfer_specified: null
});
const TIMEOUT_ACTIONS = enumSet<TimeoutAction>({
  none: null,
  auto_pass: null,
  auto_reject: null,
  notify: null,
  transfer_admin: null
});
const APPROVAL_METHODS = enumSet<ApprovalMethod>({ sequential: null, parallel: null });
const PASS_RULES = enumSet<PassRule>({
  all: null,
  any: null,
  ratio: null
});
const SAME_APPLICANT_ACTIONS = enumSet<SameApplicantAction>({
  auto_pass: null,
  self_approve: null,
  transfer_superior: null
});
const CONSECUTIVE_APPROVER_ACTIONS = enumSet<ConsecutiveApproverAction>({ none: null, auto_pass: null });
const ROLLBACK_TYPES = enumSet<RollbackType>({
  none: null,
  previous: null,
  start: null,
  any: null,
  specified: null
});
const ROLLBACK_DATA_STRATEGIES = enumSet<RollbackDataStrategy>({ clear: null, keep: null });
const ADD_ASSIGNEE_TYPES = enumSet<AddAssigneeType>({
  before: null,
  after: null,
  parallel: null
});
// The operator vocabulary is the closed set in types.ts (which the backend's
// approval.ConditionOperator mirrors) — never re-declared here.
const CONDITION_OPERATORS = new Set<string>(CONDITION_OPERATOR_LIST);

/**
 * A single structural problem with the flow definition.
 */
export interface FlowValidationError {
  code: FlowValidationCode;
  /**
   * Human-readable description (Chinese, matching the editor's UI language).
   */
  message: string;
  /**
   * The offending node, when the problem is node-scoped.
   */
  nodeId?: string;
  /**
   * The offending edge, when the problem is edge-scoped.
   */
  edgeId?: string;
  /**
   * The offending condition branch, when the problem is branch-scoped.
   */
  branchId?: string;
}

/**
 * Validate the structural integrity of a flow definition, mirroring the
 * backend's deploy-time `ValidateFlowDefinition`. Unlike the backend (which
 * returns the first error), this collects every violation so the editor can
 * surface them all at once. An empty array means the flow is deploy-ready.
 *
 * Pass the `value` / `onChange` definition (or `toDefinition()` output) — the
 * `kind` discriminator and node `data` are read exactly as the backend reads
 * them off the wire.
 */
export function validateFlowDefinition(definition: FlowDefinition): FlowValidationError[] {
  const errors: FlowValidationError[] = [];

  const { nodes, edges } = definition;

  if (nodes.length === 0) {
    return [{ code: "no_nodes", message: "流程至少需要一个节点" }];
  }

  // --- Phase 1: node validation ---
  const nodeIds = new Set<string>();
  const conditionBranches = new Map<string, ConditionBranchDefinition[] | undefined>();
  const taskNodeIds = new Set<string>();
  const rollbackRefs: Array<{ nodeId: string; keys: string[] }> = [];
  let startCount = 0;
  let endCount = 0;
  let startId: string | undefined;
  const endIds: string[] = [];

  for (const node of nodes) {
    if (!node.id) {
      errors.push({ code: "empty_node_id", message: "节点 ID 不能为空" });
      continue;
    }

    if (nodeIds.has(node.id)) {
      errors.push({
        code: "duplicate_node_id",
        message: `节点 ID 重复：${node.id}`,
        nodeId: node.id
      });
      continue;
    }

    nodeIds.add(node.id);

    if (!isNodeKind(node.kind)) {
      errors.push({
        code: "invalid_node_kind",
        message: `未知的节点类型：${node.kind}`,
        nodeId: node.id
      });
      continue;
    }

    if (node.kind === "start") {
      startCount++;
      startId = node.id;
      continue;
    }

    if (node.kind === "end") {
      endCount++;
      endIds.push(node.id);
      continue;
    }

    if (node.kind === "condition") {
      conditionBranches.set(node.id, node.data?.branches);
      validateBranchConditions(node.id, node.data?.branches, errors);
      continue;
    }

    if (node.kind === "approval") {
      taskNodeIds.add(node.id);
      validateTaskNodeConfig(node.id, node.data, errors);
      validateApprovalNodeConfig(node.id, node.data, errors);

      if (node.data?.rollbackTargetKeys?.length) {
        rollbackRefs.push({ nodeId: node.id, keys: node.data.rollbackTargetKeys });
      }

      continue;
    }

    if (node.kind === "handle") {
      taskNodeIds.add(node.id);
      validateTaskNodeConfig(node.id, node.data, errors);
      validateHandleNodeConfig(node.id, node.data, errors);
      continue;
    }

    if (node.kind === "cc") {
      validateCcDefinitions(node.id, node.data?.ccs, errors);
    }
  }

  if (startCount !== 1) {
    errors.push({ code: "start_node_count", message: `流程必须有且仅有 1 个开始节点（当前 ${startCount} 个）` });
  }

  if (endCount < 1) {
    errors.push({ code: "end_node_count", message: "流程至少需要 1 个结束节点" });
  }

  // Rollback target keys are cross-node references, resolvable only once all
  // node IDs are known. Mirrors the backend: targets must be existing
  // approval / handle nodes and never the node itself.
  for (const { nodeId, keys } of rollbackRefs) {
    for (const key of keys) {
      if (key === nodeId) {
        errors.push({
          code: "rollback_target_self",
          message: "回退目标不能包含节点自身",
          nodeId
        });
      } else if (!taskNodeIds.has(key)) {
        errors.push({
          code: "rollback_target_unknown",
          message: `回退目标引用了不存在的任务节点：${key}`,
          nodeId
        });
      }
    }
  }

  // --- Phase 2: edge validation & adjacency ---
  const edgeIds = new Set<string>();
  const outEdges = new Map<string, FlowDefinition["edges"]>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  const reversedAdj = new Map<string, string[]>();

  for (const edge of edges) {
    if (!edge.id) {
      errors.push({ code: "empty_edge_id", message: "连线 ID 不能为空" });
      continue;
    }

    if (edgeIds.has(edge.id)) {
      errors.push({
        code: "duplicate_edge_id",
        message: `连线 ID 重复：${edge.id}`,
        edgeId: edge.id
      });
      continue;
    }

    edgeIds.add(edge.id);

    const knownSource = nodeIds.has(edge.source);
    const knownTarget = nodeIds.has(edge.target);

    if (!knownSource) {
      errors.push({
        code: "unknown_source_node",
        message: `连线 ${edge.id} 的起点节点不存在：${edge.source}`,
        edgeId: edge.id
      });
    }

    if (!knownTarget) {
      errors.push({
        code: "unknown_target_node",
        message: `连线 ${edge.id} 的终点节点不存在：${edge.target}`,
        edgeId: edge.id
      });
    }

    // Only feed well-formed edges into the topology so degree/reachability
    // checks stay meaningful when other edges are broken.
    if (knownSource && knownTarget) {
      pushTo(outEdges, edge.source, edge);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
      pushTo(adjacency, edge.source, edge.target);
      pushTo(reversedAdj, edge.target, edge.source);
    }
  }

  // --- Phase 3: degree constraints ---
  if (startId) {
    if ((inDegree.get(startId) ?? 0) > 0) {
      errors.push({
        code: "start_incoming",
        message: "开始节点不能有入边",
        nodeId: startId
      });
    }

    const startOut = outEdges.get(startId)?.length ?? 0;

    if (startOut !== 1) {
      errors.push({
        code: "start_outgoing",
        message: `开始节点必须有且仅有 1 条出边（当前 ${startOut} 条）`,
        nodeId: startId
      });
    }
  }

  for (const endId of endIds) {
    if ((outEdges.get(endId)?.length ?? 0) > 0) {
      errors.push({
        code: "end_outgoing",
        message: "结束节点不能有出边",
        nodeId: endId
      });
    }

    if ((inDegree.get(endId) ?? 0) === 0) {
      errors.push({
        code: "end_incoming",
        message: "结束节点至少需要 1 条入边",
        nodeId: endId
      });
    }
  }

  for (const node of nodes) {
    if (!node.id || node.kind === "start" || node.kind === "end" || !isNodeKind(node.kind)) {
      continue;
    }

    const outs = outEdges.get(node.id) ?? [];

    if (node.kind === "condition") {
      validateConditionEdges(node.id, conditionBranches.get(node.id), outs, errors);
      continue;
    }

    if (outs.length !== 1) {
      errors.push({
        code: "node_outgoing_count",
        message: `节点必须有且仅有 1 条出边（当前 ${outs.length} 条）`,
        nodeId: node.id
      });
    } else if (outs[0]?.sourceHandle !== undefined && outs[0].sourceHandle !== null) {
      errors.push({
        code: "node_source_handle",
        message: "非条件节点的出边不应带分支句柄",
        nodeId: node.id,
        edgeId: outs[0].id
      });
    }
  }

  // --- Phase 4: topology ---
  const nodeIdList = nodes.map(n => n.id).filter(Boolean);

  if (detectCycle(nodeIdList, adjacency)) {
    errors.push({ code: "graph_cycle", message: "流程图中存在环路" });
  }

  if (startId) {
    const reachable = collectReachable(adjacency, [startId]);

    for (const node of nodes) {
      if (node.id && !reachable.has(node.id)) {
        errors.push({
          code: "node_unreachable",
          message: "节点无法从开始节点到达",
          nodeId: node.id
        });
      }
    }
  }

  if (endIds.length > 0) {
    const canReachEnd = collectReachable(reversedAdj, endIds);

    for (const node of nodes) {
      if (node.id && !canReachEnd.has(node.id)) {
        errors.push({
          code: "node_cannot_reach_end",
          message: "节点无法到达任何结束节点",
          nodeId: node.id
        });
      }
    }
  }

  return errors;
}

/**
 * Validate the configuration shared by approval and handle nodes: enum
 * fields, assignee and CC definitions, plus the companion fields the
 * selected empty-assignee action depends on. Mirrors the backend
 * `validateTaskNodeData` — an omitted enum is fine (deploy resolves it to
 * the designer default), an out-of-vocabulary value is not.
 */
function validateTaskNodeConfig(
  nodeId: string,
  data: TaskNodeData | undefined,
  errors: FlowValidationError[]
): void {
  if (data?.executionType && !EXECUTION_TYPES.has(data.executionType)) {
    errors.push({
      code: "invalid_execution_type",
      message: `未知的执行类型：${data.executionType}`,
      nodeId
    });
  }

  if (data?.emptyAssigneeAction && !EMPTY_ASSIGNEE_ACTIONS.has(data.emptyAssigneeAction)) {
    errors.push({
      code: "invalid_empty_assignee_action",
      message: `未知的无审批人处理方式：${data.emptyAssigneeAction}`,
      nodeId
    });
  }

  if (data?.timeoutAction && !TIMEOUT_ACTIONS.has(data.timeoutAction)) {
    errors.push({
      code: "invalid_timeout_action",
      message: `未知的超时处理方式：${data.timeoutAction}`,
      nodeId
    });
  }

  const assignees = data?.assignees ?? [];

  for (const assignee of assignees) {
    if (!ASSIGNEE_KINDS.has(assignee.kind)) {
      errors.push({
        code: "invalid_assignee_kind",
        message: `未知的审批人类型：${assignee.kind}`,
        nodeId
      });
      continue;
    }

    if (assignee.kind === "form_field" && !assignee.formField?.trim()) {
      errors.push({
        code: "assignee_form_field_required",
        message: "表单字段审批人必须选择字段",
        nodeId
      });
    }
  }

  if (data?.emptyAssigneeAction === "transfer_specified" && !data.fallbackUserIds?.length) {
    errors.push({
      code: "fallback_users_required",
      message: "无审批人转交指定人员时必须选择转交人",
      nodeId
    });
  }

  if (data?.emptyAssigneeAction === "transfer_admin" && !data.adminUserIds?.length) {
    errors.push({
      code: "admin_users_required",
      message: "无审批人转交管理员时必须选择节点管理员",
      nodeId
    });
  }

  validateCcDefinitions(nodeId, data?.ccs, errors);
}

/**
 * Validate approval-specific enums and dependent fields. Mirrors the backend
 * `validateApprovalNodeData`.
 */
function validateApprovalNodeConfig(
  nodeId: string,
  data: ApprovalNodeData | undefined,
  errors: FlowValidationError[]
): void {
  if (data?.approvalMethod && !APPROVAL_METHODS.has(data.approvalMethod)) {
    errors.push({
      code: "invalid_approval_method",
      message: `未知的审批方式：${data.approvalMethod}`,
      nodeId
    });
  }

  if (data?.passRule && !PASS_RULES.has(data.passRule)) {
    errors.push({
      code: "invalid_pass_rule",
      message: `未知的通过规则：${data.passRule}`,
      nodeId
    });
  }

  if (data?.passRule === "ratio") {
    const ratio = data.passRatio ?? 0;

    // Single storage convention shared with the backend: a percentage in
    // (0, 100], consumed verbatim by the engine.
    if (ratio <= 0 || ratio > 100) {
      errors.push({
        code: "pass_ratio_range",
        message: "按比例通过时必须设置 (0, 100] 范围内的通过比例（百分比）",
        nodeId
      });
    }
  }

  if (data?.sameApplicantAction && !SAME_APPLICANT_ACTIONS.has(data.sameApplicantAction)) {
    errors.push({
      code: "invalid_same_applicant_action",
      message: `未知的同申请人处理方式：${data.sameApplicantAction}`,
      nodeId
    });
  }

  if (data?.consecutiveApproverAction && !CONSECUTIVE_APPROVER_ACTIONS.has(data.consecutiveApproverAction)) {
    errors.push({
      code: "invalid_consecutive_approver_action",
      message: `未知的重复审批人处理方式：${data.consecutiveApproverAction}`,
      nodeId
    });
  }

  if (data?.rollbackType && !ROLLBACK_TYPES.has(data.rollbackType)) {
    errors.push({
      code: "invalid_rollback_type",
      message: `未知的回退类型：${data.rollbackType}`,
      nodeId
    });
  }

  if (data?.rollbackType === "specified" && !data.rollbackTargetKeys?.length) {
    errors.push({
      code: "rollback_targets_required",
      message: "回退指定节点时必须选择至少一个目标节点",
      nodeId
    });
  }

  if (data?.rollbackDataStrategy && !ROLLBACK_DATA_STRATEGIES.has(data.rollbackDataStrategy)) {
    errors.push({
      code: "invalid_rollback_data_strategy",
      message: `未知的回退数据策略：${data.rollbackDataStrategy}`,
      nodeId
    });
  }

  // Unlike the other enums (rejected by backend deploy validation), an invalid
  // AddAssigneeType fails on the backend at JSON decode time (its strict
  // UnmarshalJSON), so it must be caught here for this validator to keep its
  // "passes here ⇒ deploys" guarantee.
  const addAssigneeTypes = data?.addAssigneeTypes ?? [];

  for (const type of addAssigneeTypes) {
    if (!ADD_ASSIGNEE_TYPES.has(type)) {
      errors.push({
        code: "invalid_add_assignee_type",
        message: `未知的加签类型：${type}`,
        nodeId
      });
    }
  }
}

/**
 * Validate the handle-specific restriction: a handle node performs work, it
 * is not a decision point, so neither its execution type nor its timeout
 * action may reject the whole instance. Mirrors the backend
 * `validateHandleNodeData`.
 */
function validateHandleNodeConfig(
  nodeId: string,
  data: TaskNodeData | undefined,
  errors: FlowValidationError[]
): void {
  if (data?.executionType === "auto_reject") {
    errors.push({
      code: "handle_execution_auto_reject",
      message: "办理节点不支持自动拒绝执行类型",
      nodeId
    });
  }

  if (data?.timeoutAction === "auto_reject") {
    errors.push({
      code: "handle_timeout_auto_reject",
      message: "办理节点不支持超时自动拒绝",
      nodeId
    });
  }
}

/**
 * Validate CC recipient definitions. Mirrors the backend `validateCCDefinitions`.
 */
function validateCcDefinitions(
  nodeId: string,
  ccs: CcDefinition[] | undefined,
  errors: FlowValidationError[]
): void {
  const ccItems = ccs ?? [];

  for (const cc of ccItems) {
    if (!CC_KINDS.has(cc.kind)) {
      errors.push({
        code: "invalid_cc_kind",
        message: `未知的抄送人类型：${cc.kind}`,
        nodeId
      });
      continue;
    }

    if (cc.kind === "form_field" && !cc.formField?.trim()) {
      errors.push({
        code: "cc_form_field_required",
        message: "表单字段抄送人必须选择字段",
        nodeId
      });
    }

    if (cc.timing !== undefined && !CC_TIMINGS.has(cc.timing)) {
      errors.push({
        code: "invalid_cc_timing",
        message: `未知的抄送时机：${cc.timing}`,
        nodeId
      });
    }
  }
}

/**
 * Validate every branch condition is executable: known kind, subject +
 * whitelisted operator for field conditions, non-blank source for expression
 * conditions. Non-default branches must also carry unique priorities —
 * "first match wins" needs a total evaluation order. Mirrors the backend
 * `validateConditionBranches`.
 */
function validateBranchConditions(
  nodeId: string,
  branches: ConditionBranchDefinition[] | undefined,
  errors: FlowValidationError[]
): void {
  const seenPriorities = new Set<number>();
  const conditionBranches = branches ?? [];

  for (const branch of conditionBranches) {
    if (branch.isDefault) {
      continue;
    }

    if (seenPriorities.has(branch.priority)) {
      errors.push({
        code: "duplicate_branch_priority",
        message: `分支「${branch.label || branch.id}」与其他分支的优先级重复：${branch.priority}`,
        nodeId,
        branchId: branch.id
      });
    } else {
      seenPriorities.add(branch.priority);
    }
  }

  for (const branch of conditionBranches) {
    const conditionGroups = branch.conditionGroups ?? [];

    for (const group of conditionGroups) {
      for (const condition of group.conditions) {
        validateBranchCondition(nodeId, branch, condition, errors);
      }
    }
  }
}

function validateBranchCondition(
  nodeId: string,
  branch: ConditionBranchDefinition,
  condition: ConditionDefinition,
  errors: FlowValidationError[]
): void {
  switch (condition.kind) {
    case "field": {
      if (!condition.subject) {
        errors.push({
          code: "condition_subject_required",
          message: `分支「${branch.label || branch.id}」存在未选择字段的条件`,
          nodeId,
          branchId: branch.id
        });
      } else if (!CONDITION_OPERATORS.has(condition.operator)) {
        errors.push({
          code: "invalid_condition_operator",
          message: `分支「${branch.label || branch.id}」存在未选择运算符的条件`,
          nodeId,
          branchId: branch.id
        });
      }

      return;
    }

    case "expression": {
      if (!condition.expression.trim()) {
        errors.push({
          code: "condition_expression_required",
          message: `分支「${branch.label || branch.id}」的表达式不能为空`,
          nodeId,
          branchId: branch.id
        });
      }

      return;
    }

    default: {
      errors.push({
        code: "invalid_condition_kind",
        message: `分支「${branch.label || branch.id}」存在未知的条件类型`,
        nodeId,
        branchId: branch.id
      });
    }
  }
}

/**
 * Validate a condition node's branches and that its outgoing edges match the
 * branches exactly (one edge per branch, handle === branch id).
 */
function validateConditionEdges(
  nodeId: string,
  branchList: ConditionBranchDefinition[] | undefined,
  outs: FlowDefinition["edges"],
  errors: FlowValidationError[]
): void {
  const branches = branchList ?? [];

  if (branches.length < 2) {
    errors.push({
      code: "condition_min_branches",
      message: `条件节点至少需要 2 个分支（当前 ${branches.length} 个）`,
      nodeId
    });
  }

  const branchIds = new Set<string>();
  let defaultCount = 0;

  for (const branch of branches) {
    if (!branch.id) {
      errors.push({
        code: "condition_empty_branch_id",
        message: "条件节点存在空分支 ID",
        nodeId
      });
      continue;
    }

    if (branchIds.has(branch.id)) {
      errors.push({
        code: "condition_duplicate_branch_id",
        message: `条件节点分支 ID 重复：${branch.id}`,
        nodeId,
        branchId: branch.id
      });
      continue;
    }

    branchIds.add(branch.id);

    if (branch.isDefault) {
      defaultCount++;
    }
  }

  if (defaultCount !== 1) {
    errors.push({
      code: "condition_default_count",
      message: `条件节点必须有且仅有 1 个默认分支(当前 ${defaultCount} 个)`,
      nodeId
    });
  }

  const edgeHandles = new Set<string>();

  for (const edge of outs) {
    if (edge.sourceHandle === undefined || edge.sourceHandle === null) {
      errors.push({
        code: "condition_missing_handle",
        message: "条件节点的出边必须绑定分支",
        nodeId,
        edgeId: edge.id
      });
      continue;
    }

    if (!branchIds.has(edge.sourceHandle)) {
      errors.push({
        code: "condition_unknown_handle",
        message: `出边绑定了不存在的分支：${edge.sourceHandle}`,
        nodeId,
        edgeId: edge.id
      });
      continue;
    }

    if (edgeHandles.has(edge.sourceHandle)) {
      errors.push({
        code: "condition_duplicate_handle",
        message: `同一分支存在多条出边：${edge.sourceHandle}`,
        nodeId,
        branchId: edge.sourceHandle
      });
      continue;
    }

    edgeHandles.add(edge.sourceHandle);
  }

  for (const branch of branches) {
    if (branch.id && !edgeHandles.has(branch.id)) {
      errors.push({
        code: "condition_branch_no_edge",
        message: `分支「${branch.label || branch.id}」没有连出任何节点`,
        nodeId,
        branchId: branch.id
      });
    }
  }
}

/**
 * Returns true if the directed graph contains a cycle (DFS three-coloring).
 */
function detectCycle(nodeIds: string[], adjacency: Map<string, string[]>): boolean {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();

  const visit = (node: string): boolean => {
    color.set(node, GRAY);

    const nextNodes = adjacency.get(node) ?? [];

    for (const next of nextNodes) {
      const c = color.get(next) ?? WHITE;

      if (c === GRAY || (c === WHITE && visit(next))) {
        return true;
      }
    }

    color.set(node, BLACK);

    return false;
  };

  for (const node of nodeIds) {
    if ((color.get(node) ?? WHITE) === WHITE && visit(node)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns the set of nodes reachable from any start via BFS over `adjacency`.
 */
function collectReachable(adjacency: Map<string, string[]>, starts: string[]): Set<string> {
  const visited = new Set<string>(starts);
  const queue = [...starts];

  while (queue.length > 0) {
    const current = queue.shift()!;

    const nextNodes = adjacency.get(current) ?? [];

    for (const next of nextNodes) {
      visitReachableNode(next, visited, queue);
    }
  }

  return visited;
}

function visitReachableNode(next: string, visited: Set<string>, queue: string[]): void {
  if (visited.has(next)) {
    return;
  }

  visited.add(next);
  queue.push(next);
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);

  if (list) {
    list.push(value);
  } else {
    map.set(key, [value]);
  }
}
