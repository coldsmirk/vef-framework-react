/**
 * Runtime enums of the approval engine, mirroring `approval/enums.go`
 * verbatim. Designer-side enums (node kinds, pass rules, …) live in
 * `@vef-framework-react/approval-flow-editor`; this file only carries the
 * vocabulary the runtime pages consume.
 */

/**
 * Lifecycle status of an approval instance.
 */
export type InstanceStatus = "running" | "approved" | "rejected" | "withdrawn" | "returned" | "terminated";

/**
 * The instance statuses that are final — no further transition can occur.
 */
export const FINAL_INSTANCE_STATUSES = ["approved", "rejected", "terminated"] as const satisfies readonly InstanceStatus[];

/**
 * Whether an instance status is final, mirroring `InstanceStatus.IsFinal`.
 */
export function isFinalInstanceStatus(status: InstanceStatus): boolean {
  return (FINAL_INSTANCE_STATUSES as readonly InstanceStatus[]).includes(status);
}

/**
 * Lifecycle status of an approval task.
 */
export type TaskStatus
  = | "waiting"
    | "pending"
    | "approved"
    | "rejected"
    | "handled"
    | "transferred"
    | "rolled_back"
    | "canceled"
    | "removed"
    | "skipped";

/**
 * Lifecycle status of one node traversal (visit) by an instance.
 */
export type NodeVisitStatus = "active" | "passed" | "rejected" | "returned" | "canceled";

/**
 * Progress status of a node in the instance flow graph projection.
 */
export type NodeProgressStatus = "pending" | "active" | "passed" | "rejected" | "returned" | "canceled";

/**
 * Action types recorded in the action log, mirroring `approval.ActionType`.
 */
export type ActionType
  = | "submit"
    | "approve"
    | "handle"
    | "reject"
    | "transfer"
    | "withdraw"
    | "cancel"
    | "rollback"
    | "add_assignee"
    | "remove_assignee"
    | "execute"
    | "resubmit"
    | "reassign"
    | "terminate"
    | "add_cc";

/**
 * The activity vocabulary of timeline / flow-graph projections: every
 * `ActionType` plus `urge` (persisted as urge records, not action logs).
 */
export type ActivityAction = ActionType | "urge";

/**
 * The actions `approval/instance.process_task` accepts for a task decision.
 */
export type ProcessTaskAction = "approve" | "reject" | "transfer" | "rollback" | "handle";

/**
 * Position of a dynamically added assignee relative to the anchor task.
 */
export type AddAssigneeType = "before" | "after" | "parallel";

/**
 * Status of a flow version.
 */
export type VersionStatus = "draft" | "published" | "archived";

/**
 * Flow-level binding mode: `standalone` stores form data in the approval
 * tables, `business` write-backs into an existing business table.
 */
export type BindingMode = "standalone" | "business";

/**
 * Version-level physical storage mode of form data.
 */
export type StorageMode = "json" | "table";

/**
 * Kind of a flow initiator rule.
 */
export type InitiatorKind = "user" | "role" | "department";

/**
 * Convergence state of one business-record projection.
 */
export type BindingProjectionStatus = "pending" | "processing" | "applied" | "failed";

/**
 * Viewer-scoped field interactivity, as resolved by the server for
 * `my.get_instance_detail`. Matches the form-editor renderer's
 * `FieldPermission` vocabulary.
 */
export type FieldPermission = "visible" | "editable" | "hidden" | "required";

/**
 * The self-service actions `my.get_instance_detail` may offer the viewer,
 * derived server-side from the instance state machine, the viewer's pending
 * task, and the node's permission toggles (`computeActions` in
 * `get_my_instance_detail.go` is the source of truth).
 */
export type InstanceAction
  = | "approve"
    | "reject"
    | "handle"
    | "transfer"
    | "rollback"
    | "withdraw"
    | "resubmit"
    | "add_assignee"
    | "remove_assignee"
    | "add_cc"
    | "urge";
