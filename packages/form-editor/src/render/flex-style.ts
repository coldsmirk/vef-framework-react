import type { CSSProperties } from "react";

import type { FlexSlot } from "../types";

/**
 * Shared flex-layout mapping for the runtime renderer and the editor canvas, so
 * a {@link import("../types").FlexNode}'s axis options render identically in
 * both. The schema's friendly enums map to the CSS values antd `<Flex>` expects.
 */

export const FLEX_JUSTIFY_MAP = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around"
} as const;

export const FLEX_ALIGN_MAP = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch"
} as const;

/**
 * Resolve a block's per-slot flex sizing to a style. `minWidth: 0` lets an
 * input-bearing slot shrink below its content's intrinsic width (the standard
 * flex-overflow fix) instead of forcing the line to overflow.
 */
export function flexSlotStyle(flex: FlexSlot | undefined): CSSProperties {
  return {
    minWidth: 0,
    flexGrow: flex?.grow,
    flexShrink: flex?.shrink,
    flexBasis: flex?.basis
  };
}
