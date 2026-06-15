import type { ReactElement } from "react";

import type { ZoneOrientation } from "./drop-zones";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

const indicatorCss = css({
  position: "absolute",
  borderRadius: 2,
  background: "transparent",
  pointerEvents: "none",
  transition: [
    `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `box-shadow ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", ")
});

// A horizontal rule (row gap): a 2px hairline spanning the zone, centred vertically.
const horizontalCss = css({
  left: 2,
  right: 2,
  top: "50%",
  height: 2,
  transform: "translateY(-50%)"
});

// A vertical rule (beside slot): a 2px hairline spanning the zone, centred horizontally.
const verticalCss = css({
  top: 2,
  bottom: 2,
  left: "50%",
  width: 2,
  transform: "translateX(-50%)"
});

const activeCss = css({
  background: globalCssVars.colorPrimary,
  boxShadow: `0 0 6px color-mix(in srgb, ${globalCssVars.colorPrimary} 45%, transparent)`
});

export interface DropIndicatorProps {
  orientation: ZoneOrientation;
  isActive: boolean;
}

/**
 * The single insertion mark for every canvas drop zone — a hairline rule centred
 * in its hit area, invisible until the zone is the active drop target, when it
 * lights up to the accent with a soft halo. A horizontal (row gap) and a vertical
 * (beside slot) mark are the same primitive parameterised by axis, so the
 * indicator can never drift in weight or colour from one zone kind to another.
 */
export function DropIndicator({ isActive, orientation }: DropIndicatorProps): ReactElement {
  return (
    <div css={[indicatorCss, orientation === "horizontal" ? horizontalCss : verticalCss, isActive && activeCss]} />
  );
}
