import type { RunStatus } from "../../types";

import { Tag } from "@vef-framework-react/components";

import { RUN_STATUS_COLORS } from "./colors";
import { RUN_STATUS_LABELS } from "./labels";

/**
 * A run's lifecycle status as a colored tag.
 */
export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <Tag color={RUN_STATUS_COLORS[status]}>{RUN_STATUS_LABELS[status]}</Tag>;
}

/**
 * A schedule's enabled/disabled state as a success/neutral tag.
 */
export function EnabledTag({ enabled }: { enabled: boolean }) {
  return <Tag color={enabled ? "success" : "default"}>{enabled ? "启用" : "停用"}</Tag>;
}
