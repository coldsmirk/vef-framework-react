import type { Edge, Node, XYPosition } from "@xyflow/react";

/**
 * Node kind aligned with backend NodeKind enum.
 *
 * NOTE: inside the editor, React Flow owns the `type` discriminator on a node
 * (it drives `nodeTypes` rendering), so the in-memory `FlowNode` keeps `type`.
 * Only the wire-level `NodeDefinition` (the `value` / `onChange` contract) uses
 * `kind`; `toFlowDefinition` / `fromFlowDefinition` translate between the two.
 */
export type NodeKind = "start" | "approval" | "handle" | "condition" | "cc" | "end";

/**
 * Condition kind aligned with backend ConditionKind enum
 */
export type ConditionKind = "field" | "expression";

/**
 * Closed condition-operator vocabulary — the set the backend's
 * `approval.ConditionOperator` mirrors. The {@link ConditionOperator} type
 * derives from this array: one definition site for both the type and the
 * runtime allow-list flow validation checks against.
 */
export const CONDITION_OPERATORS = [
  "eq",
  "ne",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "in",
  "not_in",
  "is_empty",
  "is_not_empty"
] as const;

/**
 * Operators understood by the approval condition model.
 */
export type ConditionOperator = typeof CONDITION_OPERATORS[number];

/**
 * Closed aggregate vocabulary for detail-table field conditions — mirrors
 * the backend's `approval.AggregateKind`. Semantics follow SQL aggregates:
 * count folds rows, sum over an empty table is 0, avg over an empty table
 * matches no comparison.
 */
export const AGGREGATE_KINDS = ["sum", "count", "avg"] as const;

/**
 * Aggregate kinds understood by the approval condition model.
 */
export type AggregateKind = typeof AGGREGATE_KINDS[number];

/**
 * Operators an aggregate condition may use — a fold produces one number,
 * so only the numeric comparisons apply. Mirrors the backend's
 * `validateConditionAggregateShape` whitelist.
 */
export const AGGREGATE_OPERATORS = ["eq", "ne", "gt", "gte", "lt", "lte"] as const satisfies readonly ConditionOperator[];

/**
 * Approval method
 */
export type ApprovalMethod = "sequential" | "parallel";

/**
 * Pass rule for parallel approval. "all" implies veto power — any single
 * rejection fails the node.
 */
export type PassRule = "all" | "any" | "ratio";

/**
 * Action when a task node resolves no assignee, aligned with backend
 * EmptyAssigneeAction enum
 */
export type EmptyAssigneeAction = "auto_pass" | "transfer_admin" | "transfer_superior" | "transfer_applicant" | "transfer_specified";

/**
 * Principal kinds that need a host-provided picker to resolve concrete ids —
 * users, roles, departments. Single source of truth for the picker registry.
 */
export const PRINCIPAL_KINDS = ["user", "role", "department"] as const;

export type PrincipalKind = typeof PRINCIPAL_KINDS[number];

/**
 * Narrows an arbitrary kind string to a PrincipalKind (one that has a built-in
 * picker slot).
 */
export function isPrincipalKind(kind: string): kind is PrincipalKind {
  return (PRINCIPAL_KINDS as readonly string[]).includes(kind);
}

/**
 * What the designer must collect alongside a kind, aligned with the backend
 * `approval.SelectionMode`. It is the single answer to which input a rule row
 * renders and which companion field validation requires — so a host kind that
 * ships a resolver needs no editor change to be configurable.
 *
 * `none` takes no input at all: the kind resolves entirely from the runtime
 * context (the applicant, their department), which is the shape of `self`,
 * `superior`, `department_leader`, and of a host kind such as "the applicant's
 * head nurse". `custom` picks ids from a host catalog, through a picker the
 * host registers under the kind's own name.
 */
export type SelectionMode = "none" | "user" | "role" | "department" | "form_field" | "custom";

/**
 * One assignee / cc / initiator kind the running application accepts, as
 * served by `approval/flow.list_kind_options`. The vocabularies are open
 * registries on the backend, so the deployable kinds are exactly the ones it
 * reports — never a union declared here.
 */
export interface KindDescriptor<K extends string = string> {
  kind: K;
  label: string;
  selection: SelectionMode;
}

/**
 * Assignee kind. Open by design: the backend accepts every kind with a
 * registered `approval.AssigneeResolver`, so this is the identifier's type,
 * not an enumeration of the values.
 */
export type AssigneeKind = string;

/**
 * The framework's own assignee kinds, used when the host wires no descriptor
 * list (see `EditorPlugins.assigneeKinds`). Labels mirror the backend's
 * `approval_assignee_kind_*` messages; a host that serves the real catalog
 * gets the application's kinds and the configured language instead.
 */
export const BUILTIN_ASSIGNEE_KINDS: ReadonlyArray<KindDescriptor<AssigneeKind>> = [
  {
    kind: "user",
    label: "指定用户",
    selection: "user"
  },
  {
    kind: "role",
    label: "指定角色",
    selection: "role"
  },
  {
    kind: "department",
    label: "指定部门",
    selection: "department"
  },
  {
    kind: "self",
    label: "发起人本人",
    selection: "none"
  },
  {
    kind: "superior",
    label: "直属上级",
    selection: "none"
  },
  {
    kind: "department_leader",
    label: "部门负责人",
    selection: "none"
  },
  {
    kind: "form_field",
    label: "表单字段",
    selection: "form_field"
  }
];

/**
 * Rollback type aligned with backend RollbackType enum
 */
export type RollbackType = "none" | "previous" | "start" | "any" | "specified";

/**
 * Execution type for a task node: manual waits for assignees, auto_pass
 * passes the node immediately on entry, auto_reject rejects the whole
 * instance on entry.
 */
export type ExecutionType = "manual" | "auto_pass" | "auto_reject";

/**
 * Action for the applicant's own seat when they appear among a node's
 * resolved assignees, aligned with backend SameApplicantAction enum. Applied
 * per seat: `auto_pass` clears only the applicant's task (sole assignee passes
 * the whole node), `exclude` recuses them so the remaining approvers decide,
 * `transfer_superior` replaces only their seat.
 */
export type SameApplicantAction = "auto_pass" | "self_approve" | "transfer_superior" | "exclude";

/**
 * Strategy for handling form data during rollback
 */
export type RollbackDataStrategy = "clear" | "keep";

/**
 * Action when the same approver appears in consecutive approval nodes, aligned
 * with backend ConsecutiveApproverAction enum
 */
export type ConsecutiveApproverAction = "none" | "auto_pass";

/**
 * Action to take when a task times out
 */
export type TimeoutAction = "none" | "auto_pass" | "auto_reject" | "notify" | "transfer_admin";

/**
 * Type of dynamic assignee addition
 */
export type AddAssigneeType = "before" | "after" | "parallel";

/**
 * CC recipient kind. Open for the same reason as {@link AssigneeKind}: the
 * deployable kinds are those with a registered `approval.CCResolver`.
 */
export type CcKind = string;

/**
 * The framework's own CC kinds, used when the host wires no descriptor list.
 */
export const BUILTIN_CC_KINDS: ReadonlyArray<KindDescriptor<CcKind>> = [
  {
    kind: "user",
    label: "指定用户",
    selection: "user"
  },
  {
    kind: "role",
    label: "指定角色",
    selection: "role"
  },
  {
    kind: "department",
    label: "指定部门",
    selection: "department"
  },
  {
    kind: "form_field",
    label: "表单字段",
    selection: "form_field"
  }
];

/**
 * CC timing for when notifications are sent
 */
export type CcTiming = "always" | "on_approve" | "on_reject";

/**
 * CC recipient definition
 */
export interface CcDefinition {
  kind: CcKind;
  ids?: string[];
  formField?: string;
  timing?: CcTiming;
}

/**
 * Field permission for approval/handle nodes
 */
export type FieldPermission = "visible" | "editable" | "hidden" | "required";

/**
 * Field permission for CC nodes (read-only context). Intentionally a subset of
 * FieldPermission — a CC node only observes the form, so editable/required are
 * not offered.
 */
export type CcFieldPermission = "visible" | "hidden";

/**
 * Condition definition. `operator` draws from {@link CONDITION_OPERATORS} —
 * the closed set the backend's `approval.ConditionOperator` mirrors; the
 * empty string is the editor's "not yet chosen" draft state and never
 * survives validation.
 */
export interface ConditionDefinition {
  kind: ConditionKind;
  subject: string;
  /**
   * Aggregate over a detail-table subject: `subject` names the table field,
   * `column` the numeric column to fold (sum / avg; count folds rows and
   * leaves it unset). Absent for scalar conditions.
   */
  aggregate?: AggregateKind;
  column?: string;
  operator: ConditionOperator | "";
  value: unknown;
  expression: string;
}

/**
 * Field kind for form field metadata
 */
export type FieldKind = "input" | "textarea" | "select" | "number" | "date" | "upload" | "table";

/**
 * Option for select-type form fields
 */
export interface FieldOptionDefinition {
  label: string;
  value: unknown;
}

/**
 * Form field metadata for condition editor
 */
export interface FormFieldDefinition {
  key: string;
  kind: FieldKind;
  label: string;
  options?: FieldOptionDefinition[];
  /**
   * Row shape of a detail-table field (kind === "table"): the condition
   * editor folds one of these columns through an aggregate. Single-level —
   * columns never nest another table.
   */
  columns?: FormFieldDefinition[];
  /**
   * `true` when the field's visibility can be toggled off by form linkage —
   * its own hide-capable linkage, a hidden default, or a hide-capable ancestor
   * container. The field-permission table warns when a node grants `required`
   * on such a field: the backend's `required` check is linkage-blind and would
   * reject the approve forever while the field is hidden. Populated by
   * `@vef-framework-react/approval-form-bridge`'s `projectFormSchema`; absent
   * when the inventory came from elsewhere.
   */
  hasConditionalVisibility?: boolean;
}

/**
 * Condition group: conditions within are evaluated with AND logic
 */
export interface ConditionGroup {
  conditions: ConditionDefinition[];
}

/**
 * Condition branch definition
 */
export interface ConditionBranchDefinition {
  id: string;
  label: string;
  conditionGroups?: ConditionGroup[];
  isDefault?: boolean;
  priority: number;
}

/**
 * Assignee definition
 */
export interface AssigneeDefinition {
  kind: AssigneeKind;
  ids?: string[];
  formField?: string;
  sortOrder: number;
}

/**
 * Common node data fields. `name` matches the backend BaseNodeData json tag
 * (the node's display name).
 */
export interface BaseNodeData extends Record<string, unknown> {
  name?: string;
  description?: string;
}

/**
 * Start node data
 */
export interface StartNodeData extends BaseNodeData {
  // Start nodes have minimal config
}

/**
 * End node data
 */
export interface EndNodeData extends BaseNodeData {
  // End nodes have minimal config
}

/**
 * Fields shared by approval and handle nodes — mirrors backend TaskNodeData.
 */
export interface TaskNodeData extends BaseNodeData {
  assignees?: AssigneeDefinition[];
  executionType?: ExecutionType;
  emptyAssigneeAction?: EmptyAssigneeAction;
  fallbackUserIds?: string[];
  adminUserIds?: string[];
  isTransferAllowed?: boolean;
  isOpinionRequired?: boolean;
  timeoutHours?: number;
  timeoutAction?: TimeoutAction;
  timeoutNotifyBeforeHours?: number;
  urgeCooldownMinutes?: number;
  ccs?: CcDefinition[];
  fieldPermissions?: Record<string, FieldPermission>;
}

/**
 * Approval node data — mirrors backend ApprovalNodeData (TaskNodeData plus the
 * approval-specific fields).
 */
export interface ApprovalNodeData extends TaskNodeData {
  approvalMethod?: ApprovalMethod;
  passRule?: PassRule;
  passRatio?: number;
  sameApplicantAction?: SameApplicantAction;
  consecutiveApproverAction?: ConsecutiveApproverAction;
  rollbackType?: RollbackType;
  rollbackDataStrategy?: RollbackDataStrategy;
  rollbackTargetKeys?: string[];
  isRollbackAllowed?: boolean;
  isAddAssigneeAllowed?: boolean;
  addAssigneeTypes?: AddAssigneeType[];
  isRemoveAssigneeAllowed?: boolean;
  isManualCcAllowed?: boolean;
}

/**
 * Handle node data — mirrors backend HandleNodeData (TaskNodeData only; no
 * approval-specific fields). approvalMethod / passRule default to
 * sequential / any on the backend.
 */
export type HandleNodeData = TaskNodeData;

/**
 * Condition node data
 */
export interface ConditionNodeData extends BaseNodeData {
  branches?: ConditionBranchDefinition[];
}

/**
 * CC node data
 */
export interface CcNodeData extends BaseNodeData {
  ccs?: CcDefinition[];
  isReadConfirmRequired?: boolean;
  fieldPermissions?: Record<string, CcFieldPermission>;
}

/**
 * Typed xyflow node per kind — enables type-safe NodeProps<T> without assertions
 */
export type StartNode = Node<StartNodeData, "start">;
export type EndNode = Node<EndNodeData, "end">;
export type ApprovalNode = Node<ApprovalNodeData, "approval">;
export type HandleNode = Node<HandleNodeData, "handle">;
export type ConditionNode = Node<ConditionNodeData, "condition">;
export type CcNode = Node<CcNodeData, "cc">;

/**
 * Union of all typed nodes
 */
export type FlowNode = StartNode | EndNode | ApprovalNode | HandleNode | ConditionNode | CcNode;

/**
 * Union of all node data types
 */
export type NodeData = FlowNode["data"];

/**
 * Typed xyflow edge
 */
export type FlowEdge = Edge;

/**
 * Mapping from NodeKind to its corresponding data type
 */
export interface NodeDataMap {
  start: StartNodeData;
  end: EndNodeData;
  approval: ApprovalNodeData;
  handle: HandleNodeData;
  condition: ConditionNodeData;
  cc: CcNodeData;
}

/**
 * Backend-compatible node definition — discriminated union keyed on `kind`
 * (the backend NodeDefinition tag). Inside the editor the live node uses
 * React Flow's `type`; the serializer maps `type` ↔ `kind`.
 */
export type NodeDefinition = {
  [K in NodeKind]: {
    id: string;
    kind: K;
    position: XYPosition;
    data?: NodeDataMap[K];
  };
}[NodeKind];

/**
 * Backend-compatible flow definition (for serialization)
 */
export interface FlowDefinition {
  nodes: NodeDefinition[];
  edges: EdgeDefinition[];
}

/**
 * Backend-compatible edge definition
 */
export interface EdgeDefinition {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  data?: Record<string, unknown>;
}
