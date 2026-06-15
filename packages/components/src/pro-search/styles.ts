import { css } from "@emotion/react";

import { breakpoints, globalCssVars } from "../_base";

export const content = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: globalCssVars.spacingMd,
  [`@media (max-width: ${breakpoints.sm})`]: {
    flexDirection: "column",
    alignItems: "flex-start"
  }
});

export const contentLeft = css({
  flex: "none",
  display: "flex",
  alignItems: "center",
  gap: globalCssVars.spacingSm,
  flexWrap: "wrap"
});

export const contentRight = css({
  flex: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: globalCssVars.spacingSm,
  flexWrap: "wrap",
  "&& :where(.vef-input)": {
    width: "200px"
  },
  "&& :where(.vef-select)": {
    width: "200px"
  },
  "&& :where(.vef-tree-select)": {
    width: "200px"
  },
  "&& :where(.vef-picker.vef-picker-range)": {
    width: "360px"
  }
});

export const advancedSearchToggler = css({
  "&.vef-btn": {
    "--vef-button-icon-gap": "2px",
    "--vef-button-padding-inline": 0
  }
});

export const advancedSearch = css({
  paddingBlockStart: globalCssVars.spacingMd
});
