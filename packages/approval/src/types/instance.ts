import type { AddAssigneeType, ProcessTaskAction } from "./enums";

/**
 * Parameters for `approval/instance.start`. `formData` is the form
 * renderer's submit payload, validated server-side against the version's
 * derived field list.
 */
export interface StartInstanceParams {
  tenantId: string;
  flowCode: string;
  /**
   * Opaque reference to the bound business record; required by convention for
   * business-bound flows unless the host's `BusinessRefProvider` derives one.
   */
  businessRef?: string;
  formData?: Record<string, unknown>;
}

/**
 * Parameters for `approval/instance.process_task` — the per-task decision
 * endpoint bundling approve / reject / transfer / rollback / handle.
 */
export interface ProcessTaskParams {
  taskId: string;
  action: ProcessTaskAction;
  opinion?: string;
  formData?: Record<string, unknown>;
  attachments?: string[];
  /**
   * Required for `transfer`.
   */
  transferToId?: string;
  /**
   * Required for `rollback`: the flow-node id to send the instance back to.
   */
  targetNodeId?: string;
}

/**
 * Parameters for `approval/instance.withdraw`.
 */
export interface WithdrawInstanceParams {
  instanceId: string;
  reason?: string;
}

/**
 * Parameters for `approval/instance.resubmit`.
 */
export interface ResubmitInstanceParams {
  instanceId: string;
  formData?: Record<string, unknown>;
}

/**
 * Parameters for `approval/instance.add_cc`.
 */
export interface AddCCParams {
  instanceId: string;
  ccUserIds: string[];
}

/**
 * Parameters for `approval/instance.mark_cc_read`.
 */
export interface MarkCCReadParams {
  instanceId: string;
}

/**
 * Parameters for `approval/instance.add_assignee`.
 */
export interface AddAssigneeParams {
  taskId: string;
  userIds: string[];
  addType: AddAssigneeType;
}

/**
 * Parameters for `approval/instance.remove_assignee`.
 */
export interface RemoveAssigneeParams {
  taskId: string;
}

/**
 * Parameters for `approval/instance.urge_task`.
 */
export interface UrgeTaskParams {
  taskId: string;
  message?: string;
}
