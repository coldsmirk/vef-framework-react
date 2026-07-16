import type { BindingProjectionStatus, InstanceStatus, NodeProgressStatus, TaskStatus, VersionStatus } from "../../types";

import { Tag } from "@vef-framework-react/components";

import {
  BINDING_PROJECTION_STATUS_COLORS,
  INSTANCE_STATUS_COLORS,
  NODE_PROGRESS_COLORS,
  TASK_STATUS_COLORS,
  VERSION_STATUS_COLORS
} from "./colors";
import {
  BINDING_PROJECTION_STATUS_LABELS,
  INSTANCE_STATUS_LABELS,
  NODE_PROGRESS_LABELS,
  TASK_STATUS_LABELS,
  VERSION_STATUS_LABELS
} from "./labels";

/**
 * An instance lifecycle status as a colored tag.
 */
export function InstanceStatusTag({ status }: { status: InstanceStatus }) {
  return <Tag color={INSTANCE_STATUS_COLORS[status]}>{INSTANCE_STATUS_LABELS[status]}</Tag>;
}

function isTaskStatus(value: string): value is TaskStatus {
  return Object.hasOwn(TASK_STATUS_LABELS, value);
}

/**
 * A task lifecycle status as a colored tag. Unrecognized values (participant
 * statuses arrive as plain strings) render as a neutral tag.
 */
export function TaskStatusTag({ status }: { status: TaskStatus | string }) {
  if (!isTaskStatus(status)) {
    return <Tag>{status}</Tag>;
  }

  return <Tag color={TASK_STATUS_COLORS[status]}>{TASK_STATUS_LABELS[status]}</Tag>;
}

/**
 * A node's runtime progress as a colored tag.
 */
export function NodeProgressTag({ status }: { status: NodeProgressStatus }) {
  return <Tag color={NODE_PROGRESS_COLORS[status]}>{NODE_PROGRESS_LABELS[status]}</Tag>;
}

/**
 * A flow version status as a colored tag.
 */
export function VersionStatusTag({ status }: { status: VersionStatus }) {
  return <Tag color={VERSION_STATUS_COLORS[status]}>{VERSION_STATUS_LABELS[status]}</Tag>;
}

/**
 * A business-projection convergence status as a colored tag.
 */
export function ProjectionStatusTag({ status }: { status: BindingProjectionStatus }) {
  return <Tag color={BINDING_PROJECTION_STATUS_COLORS[status]}>{BINDING_PROJECTION_STATUS_LABELS[status]}</Tag>;
}
