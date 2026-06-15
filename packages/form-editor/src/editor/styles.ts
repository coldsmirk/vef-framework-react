import type { Transition } from "@vef-framework-react/core";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

/**
 * Shared styles for the editor's side surfaces. Both side panels are docked
 * workbenches: the component palette on the left, the properties panel on the
 * right. They mirror each other (border + shadow face the canvas) and narrow
 * together as the editor root shrinks.
 *
 * Three layouts are supported (see `editor-layout-context.tsx`):
 * - comfortable: palette 296, properties 380
 * - compact: palette 256, properties 360, toolbar folds extras
 * - drawer: the palette collapses to an icon rail and the properties panel
 * floats over the canvas's right edge, so the canvas keeps real width
 * inside narrow hosts (wizard steps, split panes).
 */
export const PALETTE_DOCK_WIDTH = 296;
export const PALETTE_DOCK_WIDTH_COMPACT = 256;
export const PALETTE_DOCK_WIDTH_DRAWER = 56;

export const PROPERTIES_PANEL_WIDTH = 380;
export const PROPERTIES_PANEL_WIDTH_COMPACT = 360;
export const PROPERTIES_PANEL_WIDTH_DRAWER = 320;

export const paletteDockCss = css({
  position: "relative",
  width: PALETTE_DOCK_WIDTH,
  minHeight: 0,
  height: "100%",
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  background: globalCssVars.colorBgContainer,
  // A single hairline seam against the canvas — no directional drop-shadow.
  // The canvas sheet's own elevation is the only one in the workspace, so the
  // document stays the focal plane (and the seam is theme-correct in dark mode).
  borderRight: `1px solid ${globalCssVars.colorBorderSecondary}`,
  overflow: "hidden",
  transition: `width ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`,

  "&[hidden]": {
    display: "none"
  },

  "&[data-layout='compact']": {
    width: PALETTE_DOCK_WIDTH_COMPACT
  },

  "&[data-layout='drawer']": {
    width: PALETTE_DOCK_WIDTH_DRAWER
  }
});

/**
 * Docked properties workbench on the right edge of the workspace — the mirror
 * of {@link paletteDockCss}. It is a permanent column (not a floating overlay):
 * always present in edit mode, showing the selected control's properties or an
 * empty hint when nothing is selected.
 */
export const propertiesDockCss = css({
  position: "relative",
  width: PROPERTIES_PANEL_WIDTH,
  minHeight: 0,
  height: "100%",
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  flexShrink: 0,
  background: globalCssVars.colorBgContainer,
  borderLeft: `1px solid ${globalCssVars.colorBorderSecondary}`,
  overflow: "hidden",
  transition: `width ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`,

  "&[hidden]": {
    display: "none"
  },

  "&[data-layout='compact']": {
    width: PROPERTIES_PANEL_WIDTH_COMPACT
  },

  // Narrow hosts: the panel floats over the canvas's right edge instead of
  // squeezing it. The shell renders it only while something is selected, so
  // the canvas keeps the full width the rest of the time.
  "&[data-layout='drawer']": {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: PROPERTIES_PANEL_WIDTH_DRAWER,
    maxWidth: "90%",
    boxShadow: globalCssVars.shadowLg
  }
});

export const panelHeaderCss = css({
  display: "flex",
  alignItems: "center",
  gap: globalCssVars.spacingSm,
  padding: `${globalCssVars.spacingMd} ${globalCssVars.spacingLg}`,
  borderBottom: `1px solid ${globalCssVars.colorBorderSecondary}`,
  flexShrink: 0
});

export const panelHeaderTitleCss = css({
  flex: 1,
  display: "flex",
  alignItems: "center",
  gap: globalCssVars.spacingSm,
  minWidth: 0,
  fontSize: globalCssVars.fontSizeLg,
  fontWeight: globalCssVars.fontWeightStrong,
  color: globalCssVars.colorText
});

export const panelBodyCss = css({
  flex: 1,
  minHeight: 0
});

/**
 * Shared easing for the editor's panel / drawer motion (the bottom form-config
 * drawer slides in with it).
 */
export const panelTransition: Transition = {
  duration: 0.28,
  ease: [0.4, 0, 0.2, 1]
};
