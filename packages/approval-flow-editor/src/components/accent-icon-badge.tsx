import type { ReactNode } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

const accentIconBadgeStyle = css({
  width: 24,
  height: 24,
  borderRadius: 6,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
});

interface AccentIconBadgeProps {
  /**
   * Accent color. May be a CSS variable reference (e.g. the approval node's
   * `var(--vef-color-primary)`), so the translucent background is derived with
   * `color-mix` — a hex-alpha suffix like `${color}1a` is invalid on a `var()`
   * and silently drops the background.
   */
  color: string;
  /**
   * `soft` (default) tints the background at 10%; `solid` fills it with the
   * accent and inverts the glyph. Start/end use solid so the flow's anchors
   * stand out from the task nodes at a glance.
   */
  variant?: "soft" | "solid";
  children: ReactNode;
}

/**
 * Square icon badge tinted with a node's accent color. Shared by the canvas node
 * header and the floating config-panel header so the two cannot diverge (the
 * panel previously hand-rolled this and regressed the tint for token colors).
 */
export function AccentIconBadge({
  color,
  variant = "soft",
  children
}: AccentIconBadgeProps) {
  const style = variant === "solid"
    ? { background: color, color: globalCssVars.colorWhite }
    : { background: `color-mix(in srgb, ${color} 10%, transparent)`, color };

  return (
    <span css={accentIconBadgeStyle} style={style}>
      {children}
    </span>
  );
}
