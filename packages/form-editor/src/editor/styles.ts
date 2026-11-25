import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

/**
 * Shared styles for the editor's side surfaces. Both side panels are docked
 * workbenches: the tabbed sidebar on the left (`组件` / `大纲` / `数据`), the
 * tabbed properties panel on the right (`控件` / `表单`). They mirror each
 * other (a hairline seam facing the canvas) and adapt together as the editor
 * root shrinks.
 *
 * Two layouts are supported (see `editor-layout-context.tsx`):
 * - docked: sidebar 296 across all three tabs (`组件` / `大纲` / `数据`, since
 * data sources and variables edit in modals rather than inline cards so the
 * canvas never jumps when switching tabs), properties 400
 * - drawer: the sidebar collapses to a 64px icon rail (with `大纲` / `数据`
 * opening as a 296px left-edge overlay beside it) and the properties panel
 * floats over the canvas's right edge (360px), so the canvas keeps real width
 * inside narrow hosts (wizard steps, split panes).
 */
export const SIDEBAR_DOCK_WIDTH = 296;
export const SIDEBAR_RAIL_WIDTH = 64;

export const PROPERTIES_PANEL_WIDTH = 400;
// The property editors are laid out for the docked 400px column; an overlay
// much narrower squeezes their paired controls (a condition's source and
// operator, a request's resource / action / version) into clipped inputs.
export const PROPERTIES_PANEL_WIDTH_DRAWER = 360;

export const sidebarDockCss = css({
  position: "relative",
  width: SIDEBAR_DOCK_WIDTH,
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

  "&[data-layout='drawer']": {
    width: SIDEBAR_RAIL_WIDTH
  }
});

/**
 * Narrow-layout left overlay anchored right beside the 64px rail, carrying the
 * `大纲` or `数据` tab at the uniform dock width over the canvas's left edge
 * without squeezing the canvas.
 */
export const sidebarOverlayCss = css({
  position: "absolute",
  top: 0,
  left: SIDEBAR_RAIL_WIDTH,
  bottom: 0,
  width: SIDEBAR_DOCK_WIDTH,
  maxWidth: `calc(100% - ${SIDEBAR_RAIL_WIDTH}px)`,
  zIndex: 4,
  display: "flex",
  flexDirection: "column",
  background: globalCssVars.colorBgContainer,
  borderRight: `1px solid ${globalCssVars.colorBorderSecondary}`,
  boxShadow: globalCssVars.shadowLg,
  overflow: "hidden"
});

/**
 * Docked properties workbench on the right edge of the workspace — the mirror
 * of {@link sidebarDockCss}. It is a permanent column in docked mode (always
 * present in edit mode, showing either the selected control or form-level
 * settings) and a floating right-edge overlay in narrow hosts.
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

  // Narrow hosts: the panel floats over the canvas's right edge instead of
  // squeezing it, above the left overlay so selecting a node from `大纲`
  // surfaces its properties cleanly.
  "&[data-layout='drawer']": {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    width: PROPERTIES_PANEL_WIDTH_DRAWER,
    maxWidth: "90%",
    boxShadow: globalCssVars.shadowLg
  }
});

/**
 * Narrow-layout handle flush with the workspace's right edge, shown while the
 * right properties overlay is closed so the user can open form-level settings
 * (or re-open a selected node's properties) at any time with nothing selected.
 */
export const propertiesDrawerTriggerCss = css({
  position: "absolute",
  top: 14,
  right: 0,
  zIndex: 3,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 34,
  padding: "0 12px 0 10px",
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  borderRight: "none",
  borderRadius: "8px 0 0 8px",
  background: globalCssVars.colorBgContainer,
  color: globalCssVars.colorTextSecondary,
  fontSize: globalCssVars.fontSizeSm,
  fontWeight: 500,
  boxShadow: globalCssVars.shadowSm,
  cursor: "pointer",
  transition: `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}, color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,

  "& > svg": {
    width: 15,
    height: 15
  },

  "&:hover": {
    background: globalCssVars.colorFillTertiary,
    color: globalCssVars.colorText
  },

  "&:focus-visible": {
    outline: `2px solid ${globalCssVars.colorPrimaryBorder}`,
    outlineOffset: -2
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
