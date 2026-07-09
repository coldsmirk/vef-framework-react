import type { CSSProperties } from "react";

import type { CssLength, GapScale, StackSlot } from "../types";

import { DEFAULT_GAP_SCALE } from "../types";

/**
 * Pixel realization of each {@link GapScale}, shared by the runtime renderer and
 * the editor canvas so a stack's vertical rhythm reads identically in both. The
 * schema stores only the named scale; this is the one place it becomes pixels,
 * so the rhythm can be re-tuned here without touching any persisted data.
 */
export const GAP_SCALE_PX: Record<GapScale, number> = {
  small: 8,
  medium: 16,
  large: 24
};

/**
 * The pixel gap a stack falls back to when neither the container nor the form
 * pins one — the {@link DEFAULT_GAP_SCALE} in pixels.
 */
export const DEFAULT_STACK_GAP = GAP_SCALE_PX[DEFAULT_GAP_SCALE];

/**
 * Resolve a stack's gap to pixels: the container's own {@link GapScale} when set,
 * otherwise the inherited `fallback` (the form-level gap for a container body, or
 * {@link DEFAULT_STACK_GAP} for the root document).
 */
export function resolveStackGap(scale: GapScale | undefined, fallback: number): number {
  return scale === undefined ? fallback : GAP_SCALE_PX[scale];
}

/**
 * Cross-axis placement of a sized block within its stack, realized as auto
 * margins so it works in both the flex-column stack and any block context: the
 * side opposite the alignment collapses, pushing the block that way.
 */
const STACK_ALIGN_STYLE: Record<NonNullable<StackSlot["align"]>, CSSProperties> = {
  start: { marginInlineEnd: "auto" },
  center: { marginInline: "auto" },
  end: { marginInlineStart: "auto" }
};

function cssLength(length: CssLength | undefined): string | undefined {
  return length === undefined ? undefined : `${length.value}${length.unit}`;
}

/**
 * Resolve a block's {@link StackSlot} to a wrapper style. Shared by the runtime
 * renderer and the editor canvas so a stack-sized block reads identically in
 * both. An omitted width resolves to `100%` rather than `undefined`: the runtime
 * wrapper is a direct flex-column item, where an `auto` cross-axis margin would
 * otherwise cancel the flex stretch and collapse the block to content width —
 * `100%` gives the auto margin real free space to distribute, so it stays a
 * no-op at full width and becomes a cap-and-center once `maxWidth` bites, exactly
 * matching the canvas wrapper's block-flow behaviour. The align margins only bite
 * once a width (or maxWidth) narrows the block below the stack.
 */
export function stackSlotStyle(slot: StackSlot): CSSProperties {
  return {
    width: slot.width === undefined ? "100%" : cssLength(slot.width),
    minWidth: cssLength(slot.minWidth),
    maxWidth: cssLength(slot.maxWidth),
    ...slot.align !== undefined && STACK_ALIGN_STYLE[slot.align]
  };
}
