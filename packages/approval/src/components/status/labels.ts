import type {
  ActivityAction,
  BindingProjectionStatus,
  InstanceStatus,
  NodeProgressStatus,
  ProcessTaskAction,
  TaskStatus,
  VersionStatus
} from "../../types";

/**
 * Display labels for the runtime vocabularies, in the framework's default
 * language. Each map is total over its union so a missing entry is a type
 * error when the backend vocabulary grows.
 */

export const INSTANCE_STATUS_LABELS: Record<InstanceStatus, string> = {
  running: "审批中",
  approved: "已通过",
  rejected: "已拒绝",
  withdrawn: "已撤回",
  returned: "已退回",
  terminated: "已终止"
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  waiting: "等待中",
  pending: "待处理",
  approved: "已通过",
  rejected: "已拒绝",
  handled: "已办理",
  transferred: "已转办",
  rolled_back: "已回退",
  canceled: "已取消",
  removed: "已减签",
  skipped: "已跳过"
};

export const NODE_PROGRESS_LABELS: Record<NodeProgressStatus, string> = {
  pending: "未到达",
  active: "进行中",
  passed: "已通过",
  rejected: "已拒绝",
  returned: "已退回",
  canceled: "已取消"
};

export const VERSION_STATUS_LABELS: Record<VersionStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档"
};

export const BINDING_PROJECTION_STATUS_LABELS: Record<BindingProjectionStatus, string> = {
  pending: "待写入",
  processing: "写入中",
  applied: "已写入",
  failed: "写入失败"
};

export const ACTIVITY_ACTION_LABELS: Record<ActivityAction, string> = {
  submit: "提交",
  approve: "通过",
  handle: "办理",
  reject: "拒绝",
  transfer: "转办",
  withdraw: "撤回",
  cancel: "取消",
  rollback: "回退",
  add_assignee: "加签",
  remove_assignee: "减签",
  execute: "系统执行",
  resubmit: "重新提交",
  reassign: "改派",
  terminate: "终止",
  add_cc: "抄送",
  urge: "催办"
};

export const PROCESS_TASK_ACTION_LABELS: Record<ProcessTaskAction, string> = {
  approve: "通过",
  reject: "拒绝",
  handle: "办理",
  transfer: "转办",
  rollback: "回退"
};

const INSTANCE_STATUS_ORDER: readonly InstanceStatus[] = ["running", "approved", "rejected", "returned", "withdrawn", "terminated"];

const TASK_STATUS_ORDER: readonly TaskStatus[] = [
  "pending",
  "waiting",
  "approved",
  "rejected",
  "handled",
  "transferred",
  "rolled_back",
  "canceled",
  "removed",
  "skipped"
];

const BINDING_PROJECTION_STATUS_ORDER: readonly BindingProjectionStatus[] = ["pending", "processing", "applied", "failed"];

/**
 * Options for an instance-status select.
 */
export const INSTANCE_STATUS_OPTIONS = INSTANCE_STATUS_ORDER.map(value => {
  return { label: INSTANCE_STATUS_LABELS[value], value };
});

/**
 * Options for a task-status select.
 */
export const TASK_STATUS_OPTIONS = TASK_STATUS_ORDER.map(value => {
  return { label: TASK_STATUS_LABELS[value], value };
});

/**
 * Options for a binding-projection-status select.
 */
export const BINDING_PROJECTION_STATUS_OPTIONS = BINDING_PROJECTION_STATUS_ORDER.map(value => {
  return { label: BINDING_PROJECTION_STATUS_LABELS[value], value };
});
