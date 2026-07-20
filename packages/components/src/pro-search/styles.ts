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
  flex: "1 1 auto",
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: globalCssVars.spacingSm,
  flexWrap: "wrap",
  [`@media (max-width: ${breakpoints.sm})`]: {
    width: "100%",
    justifyContent: "flex-start"
  },
  // antd wraps the raw <input> in an affix wrapper when allowClear / prefix / suffix
  // is set, so size that wrapper (the real control box); the bare .vef-input matches
  // the standalone input otherwise.
  "&& :where(.vef-input, .vef-input-affix-wrapper)": {
    width: "200px"
  },
  // Inside the affix wrapper the inner .vef-input must fill the fixed-width box, not
  // re-apply the 200px above (which would overflow past the clear icon).
  "&& :where(.vef-input-affix-wrapper) :where(.vef-input)": {
    width: "100%"
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
