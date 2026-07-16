import type { BindingProjectionStatus, InstanceStatus, NodeProgressStatus, TaskStatus, VersionStatus } from "../../types";

/**
 * Status colors, expressed as antd Tag color tokens so they resolve through
 * the framework theme (and flip with the dark algorithm) with no hardcoding.
 * One semantic system across every approval view: blue = in motion, green =
 * positive outcome, red = negative outcome, orange = sent back / needs the
 * applicant, gray = inert.
 */

export const INSTANCE_STATUS_COLORS: Record<InstanceStatus, string> = {
  running: "processing",
  approved: "success",
  rejected: "error",
  withdrawn: "default",
  returned: "warning",
  terminated: "error"
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  waiting: "default",
  pending: "processing",
  approved: "success",
  rejected: "error",
  handled: "success",
  transferred: "blue",
  rolled_back: "warning",
  canceled: "default",
  removed: "default",
  skipped: "default"
};

export const NODE_PROGRESS_COLORS: Record<NodeProgressStatus, string> = {
  pending: "default",
  active: "processing",
  passed: "success",
  rejected: "error",
  returned: "warning",
  canceled: "default"
};

export const VERSION_STATUS_COLORS: Record<VersionStatus, string> = {
  draft: "default",
  published: "success",
  archived: "default"
};

export const BINDING_PROJECTION_STATUS_COLORS: Record<BindingProjectionStatus, string> = {
  pending: "default",
  processing: "processing",
  applied: "success",
  failed: "error"
};
