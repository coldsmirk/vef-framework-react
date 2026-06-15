import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

/**
 * Shared chrome styling for the subform shell and section collapse, identical
 * across the PC and mobile container chrome sets. Both render the same
 * token-driven row surface (the visual contract is device-independent), so the
 * styles live once here instead of being copied per device module.
 */

export const subformBodyCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 12
});

export const subformRowCss = css({
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: 12,
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`
});

export const subformRowBodyCss = css({
  flex: 1,
  minWidth: 0
});

export const subformRemoveCss = css({
  flexShrink: 0
});

/**
 * The single-item collapse key used by the `collapse` Section variant. Local to
 * each `Section` instance, so a stable literal is enough — `defaultActiveKey`
 * only has to match this item's `key`.
 */
export const SECTION_PANEL_KEY = "panel";
