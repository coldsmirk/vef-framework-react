import { css } from "@emotion/react";

export const root = css({
  "--vef-scrollbar-size-default": "10px",
  "--vef-scrollbar-padding-default": "2px",
  minHeight: 0,
  minWidth: 0
});

export const viewport = css({
  height: "100%",
  borderRadius: "inherit",
  overscrollBehavior: "var(--vef-overscroll-behavior, none)"
});

export const scrollbar = css({
  display: "flex",
  userSelect: "none",
  touchAction: "none",
  boxSizing: "border-box",
  backgroundColor: "transparent",

  "&[data-orientation='vertical']": {
    width: "var(--vef-scrollbar-size, var(--vef-scrollbar-size-default))",
    paddingBlock: "1px",
    paddingInline: "var(--vef-scrollbar-padding, var(--vef-scrollbar-padding-default))"
  },
  "&[data-orientation='horizontal']": {
    height: "var(--vef-scrollbar-size, var(--vef-scrollbar-size-default))",
    flexDirection: "column",
    paddingBlock: "var(--vef-scrollbar-padding, var(--vef-scrollbar-padding-default))",
    paddingInline: "1px"
  }
});

export const thumb = css({
  flex: "auto",
  borderRadius: "var(--vef-scrollbar-size, var(--vef-scrollbar-size-default))",
  position: "relative",
  backgroundColor: "rgba(0, 0, 0, 0.25)",
  transition: "background-color 0.2s ease",

  "&::before": {
    content: "''",
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "100%",
    height: "100%",
    minHeight: "16px",
    minWidth: "16px"
  },
  "&:hover": {
    backgroundColor: "rgba(0, 0, 0, 0.4)"
  },
  ".dark &": {
    backgroundColor: "rgba(255, 255, 255, 0.25)"
  },
  ".dark &:hover": {
    backgroundColor: "rgba(255, 255, 255, 0.4)"
  }
});
