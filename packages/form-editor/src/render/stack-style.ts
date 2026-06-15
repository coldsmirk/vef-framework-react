import type { GapScale } from "../types";

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
