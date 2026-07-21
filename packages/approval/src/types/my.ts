import type { FormSchema } from "@vef-framework-react/form-editor";

import type { FormData, UserInfo } from "./base";
import type { InstanceFlowGraph, TimelineEntry } from "./detail";
import type { AddAssigneeType, FieldPermission, InstanceAction, InstanceStatus } from "./enums";

/**
 * A flow the current user is allowed to initiate, mirroring
 * `my.AvailableFlow`.
 */
export interface AvailableFlow {
  flowId: string;
  flowCode: string;
  flowName: string;
  flowIcon?: string;
  description?: string;
  labels?: Record<string, string>;
  categoryId: string;
  categoryName: string;
}

/**
 * The pre-submission view of a flow for an applicant, mirroring
 * `my.StartForm`: identity fields plus the published version's host
 * form-designer document, returned verbatim. Loading it is gated exactly
 * like starting the instance.
 */
export interface StartForm {
  flowId: string;
  flowCode: string;
  flowName: string;
  flowIcon?: string;
  description?: string;
  versionId: string;
  version: number;
  formSchema?: FormSchema;
}

/**
 * An approval instance submitted by the current user, mirroring
 * `my.InitiatedInstance`.
 */
export interface InitiatedInstance {
  instanceId: string;
  instanceNo: string;
  title: string;
  flowName: string;
  flowIcon?: string;
  status: InstanceStatus;
  currentNodeName?: string;
  createdAt: string;
  finishedAt?: string;
}

/**
 * A task awaiting the current user's action, mirroring `my.PendingTask`.
 */
export interface PendingTask {
  taskId: string;
  instanceId: string;
  instanceTitle: string;
  instanceNo: string;
  flowName: string;
  flowIcon?: string;
  applicant: UserInfo;
  nodeName: string;
  createdAt: string;
  deadline?: string;
  isTimeout: boolean;
}

/**
 * A task the current user has already processed, mirroring
 * `my.CompletedTask`.
 */
export interface CompletedTask {
  taskId: string;
  instanceId: string;
  instanceTitle: string;
  instanceNo: string;
  flowName: string;
  flowIcon?: string;
  applicant: UserInfo;
  nodeName: string;
  status: string;
  finishedAt?: string;
}

/**
 * A CC notification addressed to the current user, mirroring `my.CCRecord`.
 */
export interface MyCCRecord {
  ccRecordId: string;
  instanceId: string;
  instanceTitle: string;
  instanceNo: string;
  flowName: string;
  flowIcon?: string;
  applicant: UserInfo;
  nodeName?: string;
  isRead: boolean;
  createdAt: string;
}

/**
 * Counts of pending actions for the current user, mirroring
 * `my.PendingCounts`.
 */
export interface PendingCounts {
  pendingTaskCount: number;
  unreadCcCount: number;
}

/**
 * The instance's runtime state within a self-service detail view, mirroring
 * `my.InstanceInfo`. `formData` is already stripped of the fields this
 * viewer may not see. `labels` are the flow's host-owned selection metadata,
 * read from the mutable flow at query time (display identity, not a
 * version-pinned snapshot).
 */
export interface MyInstanceInfo {
  instanceId: string;
  instanceNo: string;
  title: string;
  flowId: string;
  flowCode: string;
  flowName: string;
  flowIcon?: string;
  labels?: Record<string, string>;
  applicant: UserInfo;
  status: InstanceStatus;
  currentNodeId?: string;
  currentNodeName?: string;
  businessRef?: string;
  formData?: FormData;
  createdAt: string;
  finishedAt?: string;
}

/**
 * One valid rollback destination, resolved server-side from the node's
 * rollback config and the instance's visit trail.
 */
export interface RollbackTarget {
  nodeId: string;
  name: string;
}

/**
 * One peer task eligible for removal, mirroring `my.RemovableAssignee`.
 * `status` is the peer task's status verbatim (`pending` / `waiting`).
 */
export interface RemovableAssignee {
  taskId: string;
  assignee: UserInfo;
  status: string;
}

/**
 * The viewer's pending task within a detail view, mirroring `my.ViewerTask`:
 * what `process_task` should target plus the node-level action configuration
 * — the client never re-derives engine semantics.
 */
export interface ViewerTask {
  taskId: string;
  nodeId: string;
  isOpinionRequired: boolean;
  addAssigneeTypes?: AddAssigneeType[];
  rollbackTargets?: RollbackTarget[];
  removableAssignees?: RemovableAssignee[];
}

/**
 * The self-service detail view of an approval instance, mirroring
 * `my.InstanceDetail`: runtime state, the version-pinned form document, the
 * node-by-node timeline, the progress-annotated flow graph, and the
 * viewer-specific action set. `fieldPermissions` is materialized for every
 * top-level form field — apply it verbatim, no default resolution.
 */
export interface MyInstanceDetail {
  instance: MyInstanceInfo;
  formSchema?: FormSchema;
  timeline: TimelineEntry[];
  flowGraph: InstanceFlowGraph;
  availableActions: InstanceAction[];
  fieldPermissions?: Record<string, FieldPermission>;
  myTask?: ViewerTask;
}

/**
 * Search parameters for `approval/my.find_available_flows`.
 */
export interface AvailableFlowSearch {
  tenantId?: string;
  keyword?: string;
  labels?: Record<string, string>;
}

/**
 * Search parameters for `approval/my.find_initiated`.
 */
export interface InitiatedInstanceSearch {
  tenantId?: string;
  status?: InstanceStatus;
  keyword?: string;
}

/**
 * Search parameters for `approval/my.find_pending_tasks` and
 * `approval/my.find_completed_tasks`.
 */
export interface MyTaskSearch {
  tenantId?: string;
}

/**
 * Search parameters for `approval/my.find_cc_records`.
 */
export interface MyCCRecordSearch {
  tenantId?: string;
  isRead?: boolean;
}
