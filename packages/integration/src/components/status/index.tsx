import type { Direction, FailureKind, RouteFindingKind } from "../../types";

import { Tag } from "@vef-framework-react/components";

import { DIRECTION_COLORS, FAILURE_KIND_COLORS, ROUTE_FINDING_SEVERITY } from "./colors";
import { DIRECTION_LABELS, FAILURE_KIND_LABELS, ROUTE_FINDING_KIND_LABELS } from "./labels";

/**
 * The flow direction as a colored tag — outbound and inbound get distinct hues.
 */
export function DirectionTag({ direction }: { direction: Direction }) {
  return <Tag color={DIRECTION_COLORS[direction]}>{DIRECTION_LABELS[direction]}</Tag>;
}

/**
 * An enabled/disabled state as a success/neutral tag.
 */
export function EnabledTag({ enabled }: { enabled: boolean }) {
  return <Tag color={enabled ? "success" : "default"}>{enabled ? "启用" : "停用"}</Tag>;
}

/**
 * An invocation outcome: a success tag when there is no failure, else the classified failure.
 */
export function FailureKindTag({ failureKind }: { failureKind?: FailureKind | "" | null }) {
  if (!failureKind) {
    return <Tag color="success">成功</Tag>;
  }

  return <Tag color={FAILURE_KIND_COLORS[failureKind]}>{FAILURE_KIND_LABELS[failureKind]}</Tag>;
}

/**
 * A routing-diagnosis finding kind, colored by severity.
 */
export function FindingKindTag({ kind }: { kind: RouteFindingKind }) {
  return <Tag color={ROUTE_FINDING_SEVERITY[kind]}>{ROUTE_FINDING_KIND_LABELS[kind]}</Tag>;
}
