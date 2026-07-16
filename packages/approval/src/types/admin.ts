import type { FormSchema } from "@vef-framework-react/form-editor";

import type { FormData, UserInfo } from "./base";
import type { InstanceFlowGraph, TimelineEntry } from "./detail";
import type { ActionType, BindingProjectionStatus, InstanceStatus, TaskStatus } from "./enums";

/**
 * An approval instance in the admin view, mirroring `admin.Instance`.
 */
export interface AdminInstance {
  instanceId: string;
  instanceNo: string;
  title: string;
  tenantId: string;
  flowId: string;
  flowName: string;
  applicant: UserInfo;
  status: InstanceStatus;
  currentNodeName?: string;
  createdAt: string;
  finishedAt?: string;
}

/**
 * An approval task in the admin view, mirroring `admin.Task`.
 */
export interface AdminTask {
  taskId: string;
  instanceId: string;
  instanceTitle: string;
  flowName: string;
  nodeName: string;
  assignee: UserInfo;
  status: TaskStatus;
  createdAt: string;
  deadline?: string;
  finishedAt?: string;
}

/**
 * The instance's runtime state within an admin detail view, mirroring
 * `admin.InstanceDetailInfo`. `labels` are the flow's host-owned selection
 * metadata, read from the mutable flow at query time.
 */
export interface AdminInstanceInfo {
  instanceId: string;
  instanceNo: string;
  title: string;
  tenantId: string;
  flowId: string;
  flowName: string;
  flowVersionId: string;
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
 * The full admin detail view of an approval instance, mirroring
 * `admin.InstanceDetail`. The raw audit trail stays available through the
 * paginated action-log query.
 */
export interface AdminInstanceDetail {
  instance: AdminInstanceInfo;
  formSchema?: FormSchema;
  timeline: TimelineEntry[];
  flowGraph: InstanceFlowGraph;
}

/**
 * An action log entry in the admin audit view, mirroring `admin.ActionLog`.
 */
export interface AdminActionLog {
  logId: string;
  action: ActionType;
  nodeId?: string;
  taskId?: string;
  operator: UserInfo;
  transferTo?: UserInfo;
  rollbackToNodeId?: string;
  addedAssignees?: UserInfo[];
  removedAssignees?: UserInfo[];
  ccUsers?: UserInfo[];
  opinion?: string;
  attachments?: string[];
  createdAt: string;
}

/**
 * Aggregated approval engine health and throughput indicators, mirroring
 * `admin.Metrics`. Count maps are keyed by the respective status strings.
 */
export interface ApprovalMetrics {
  tenantId: string;
  capturedAt: string;
  instanceCounts: Partial<Record<InstanceStatus, number>>;
  taskCounts: Partial<Record<TaskStatus, number>>;
  timeoutTaskCount: number;
  /**
   * Average end-to-end duration in seconds over completed instances;
   * `-1` means no completed instances yet.
   */
  avgCompletionSeconds: number;
  pendingBindingFailures: number;
  businessProjectionCounts: Partial<Record<BindingProjectionStatus, number>>;
  pendingBusinessProjections: number;
}

/**
 * The record key of a business projection: configured key columns mapped to
 * the values resolved from the instance's business ref.
 */
export type BusinessRecordKey = Record<string, string | number | boolean | null>;

/**
 * The operator-facing convergence state for one bound business record,
 * mirroring `admin.BusinessProjection`.
 */
export interface AdminBusinessProjection {
  projectionId: string;
  tenantId: string;
  flowId: string;
  flowVersionId: string;
  ownerInstanceId: string;
  appliedOwnerInstanceId?: string;
  businessTable: string;
  recordKey: BusinessRecordKey;
  consistency: "synchronous" | "eventual";
  desiredStatus: InstanceStatus;
  desiredStartedAt: string;
  desiredFinishedAt?: string;
  desiredRevision: number;
  appliedRevision: number;
  status: BindingProjectionStatus;
  attemptCount: number;
  nextAttemptAt?: string;
  leaseUntil?: string;
  lastError?: string;
  appliedAt?: string;
  updatedAt: string;
}

/**
 * Search parameters for `approval/admin.find_instances`.
 */
export interface AdminInstanceSearch {
  tenantId?: string;
  applicantId?: string;
  status?: InstanceStatus;
  flowId?: string;
  keyword?: string;
}

/**
 * Search parameters for `approval/admin.find_tasks`.
 */
export interface AdminTaskSearch {
  tenantId?: string;
  assigneeId?: string;
  instanceId?: string;
  status?: TaskStatus;
}

/**
 * Search parameters for `approval/admin.find_business_projections`.
 */
export interface AdminBusinessProjectionSearch {
  tenantId?: string;
  status?: BindingProjectionStatus;
}

/**
 * Parameters for `approval/admin.terminate_instance`.
 */
export interface TerminateInstanceParams {
  instanceId: string;
  reason?: string;
}

/**
 * Parameters for `approval/admin.reassign_task`.
 */
export interface ReassignTaskParams {
  taskId: string;
  newAssigneeId: string;
  reason?: string;
}

/**
 * Parameters for `approval/admin.retry_business_projection`.
 */
export interface RetryBusinessProjectionParams {
  projectionId: string;
}
