import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

const paddingMotion = css({
  transition: `padding ${globalCssVars.motionDurationSlow} cubic-bezier(0.2, 0, 0, 1)`
});

export const layout = css({
  position: "relative",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  contain: "strict",
  backgroundColor: "var(--vef-color-bg-layout)"
});

export const header = css({
  flex: "none",
  height: "var(--vef-layout-header-height)",
  backgroundColor: "var(--vef-color-bg-container)",
  contain: "style size"
}, paddingMotion);

export const tabs = css({
  flex: "none",
  height: "var(--vef-layout-tabs-height)",
  contain: "style size"
}, paddingMotion);

export const sidebar = css({
  zIndex: 2,
  position: "absolute",
  top: 0,
  left: 0,
  height: "100%",
  width: "var(--vef-layout-sidebar-width)",
  transition: `width ${globalCssVars.motionDurationSlow} cubic-bezier(0.2, 0, 0, 1)`,
  contain: "layout style size"
});

export const sidebarBelowHeader = css({
  top: "var(--vef-layout-header-height)",
  height: "calc(100% - var(--vef-layout-header-height))"
});

export const sidebarGap = css({
  paddingInlineStart: "var(--vef-layout-sidebar-width)"
});

export const main = css({
  flex: "auto",
  minHeight: 0,
  backgroundColor: "var(--vef-color-bg-layout)",
  contain: "layout style size"
}, paddingMotion);

export const footer = css({
  flex: "none",
  height: "var(--vef-layout-footer-height)",
  contain: "style size"
}, paddingMotion);
