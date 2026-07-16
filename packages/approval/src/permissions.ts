/**
 * Permission codes for the approval engine management API, mirroring the
 * backend `RequiredPermission` strings verbatim. These are the lockstep
 * anchors between the Go resources and the React pages: every management page
 * defaults its permission gates to the matching entry here, and a business
 * system overrides them through the page's `permissions` prop.
 *
 * The self-service `approval/my` resource carries no permission codes — its
 * operations are scoped to the current user server-side, so the user-facing
 * pages render without permission gates.
 */
export const APPROVAL_PERMISSIONS = {
  category: {
    query: "approval.category.query",
    create: "approval.category.create",
    update: "approval.category.update",
    delete: "approval.category.delete"
  },
  flow: {
    query: "approval.flow.query",
    create: "approval.flow.create",
    update: "approval.flow.update",
    deploy: "approval.flow.deploy",
    publish: "approval.flow.publish"
  },
  instance: {
    query: "approval.instance.query",
    detail: "approval.instance.detail",
    start: "approval.instance.start",
    withdraw: "approval.instance.withdraw",
    resubmit: "approval.instance.resubmit",
    cc: "approval.instance.cc",
    terminate: "approval.instance.terminate"
  },
  task: {
    query: "approval.task.query",
    process: "approval.task.process",
    addAssignee: "approval.task.add_assignee",
    removeAssignee: "approval.task.remove_assignee",
    urge: "approval.task.urge",
    reassign: "approval.task.reassign"
  },
  actionLog: {
    query: "approval.action_log.query"
  },
  metrics: {
    query: "approval.metrics.query"
  },
  binding: {
    query: "approval.binding.query",
    retry: "approval.binding.retry"
  },
  delegation: {
    query: "approval.delegation.query",
    create: "approval.delegation.create",
    update: "approval.delegation.update",
    delete: "approval.delegation.delete"
  }
} as const;

export type ApprovalPermissions = typeof APPROVAL_PERMISSIONS;
export type CategoryPermissionCodes = ApprovalPermissions["category"];
export type FlowPermissionCodes = ApprovalPermissions["flow"];
export type InstancePermissionCodes = ApprovalPermissions["instance"];
export type TaskPermissionCodes = ApprovalPermissions["task"];
export type ActionLogPermissionCodes = ApprovalPermissions["actionLog"];
export type MetricsPermissionCodes = ApprovalPermissions["metrics"];
export type BindingPermissionCodes = ApprovalPermissions["binding"];
export type DelegationPermissionCodes = ApprovalPermissions["delegation"];
