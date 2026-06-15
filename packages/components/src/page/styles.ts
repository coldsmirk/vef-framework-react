import { css } from "@emotion/react";

import { globalCssVars } from "../_base";

export const page = css({
  position: "relative",
  margin: "var(--vef-page-margin, 0px)",
  height: "calc(100% - (var(--vef-page-margin, 0px) * 2))",
  display: "grid",
  gridTemplateColumns: "var(--vef-page-grid-columns, 1fr)",
  gridTemplateRows: "var(--vef-page-grid-rows, 1fr)",
  gridTemplateAreas: "var(--vef-page-grid-areas)",
  gap: "var(--vef-page-grid-gap)",
  contain: "layout style size"
});

export const leftAside = css({
  gridArea: "left",
  height: "100%",
  display: "flex",
  flexDirection: "row"
});

export const rightAside = css({
  gridArea: "right",
  height: "100%",
  display: "flex",
  flexDirection: "row"
});

export const asideContent = css({
  flex: 1,
  minWidth: 0,
  height: "100%"
});

export const resizeHandleGrip = css({
  "--vef-resize-handle-width": "4px",
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: "var(--vef-resize-handle-width)",
  height: globalCssVars.controlHeight,
  borderRadius: "calc(var(--vef-resize-handle-width) / 2)",
  backgroundColor: globalCssVars.colorBorderSecondary,
  cursor: "col-resize",
  zIndex: 2,
  transitionProperty: "background-color, height, box-shadow",
  transitionDuration: globalCssVars.motionDurationMid,
  transitionTimingFunction: globalCssVars.motionEaseInOut,
  boxShadow: `0 1px 2px ${globalCssVars.colorFillSecondary}`,
  "&:hover": {
    backgroundColor: globalCssVars.colorBorder
  },
  "&[data-dragging='true']": {
    backgroundColor: globalCssVars.colorPrimary,
    height: globalCssVars.controlHeightLg,
    boxShadow: `0 2px 4px ${globalCssVars.colorFill}`
  }
});

export const resizeHandleLeft = css({
  right: `calc((${globalCssVars.spacingMd} - var(--vef-resize-handle-width)) / 2)`
});

export const resizeHandleRight = css({
  left: `calc((${globalCssVars.spacingMd} - var(--vef-resize-handle-width)) / 2)`
});

export const main = css({
  gridArea: "main",
  minWidth: 0,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--vef-page-grid-gap)"
});

export const header = css({
  flex: "none"
});

export const headerOutside = css({
  gridArea: "header"
});

export const content = css({
  flex: "auto",
  minHeight: 0
});

export const scrollWrapper = css({
  marginInline: "var(--vef-page-scroll-wrapper-margin)"
});

export const scrollContainer = css({
  marginInline: "var(--vef-page-scroll-container-margin)",
  "& > div": {
    marginBlockStart: "var(--vef-page-scroll-margin)",
    marginBlockEnd: "calc(var(--vef-page-action-bar-height) + var(--vef-page-scroll-margin))"
  }
});

export const footer = css({
  flex: "none"
});

export const footerOutside = css({
  gridArea: "footer"
});

export const actionBar = css({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: "rgba(255, 255, 255, 0.6)",
  backdropFilter: "blur(8px)",
  boxShadow: "rgba(0, 21, 41, 0.08) 0px -1px 2px",
  ".dark &": {
    backgroundColor: "rgba(0, 0, 0, 0.2)"
  }
});
