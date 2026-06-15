import { css } from "@emotion/react";

import { globalCssVars } from "../_base";

export const container = css({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  "&.vef-card": {
    "--vef-card-header-padding": globalCssVars.spacingMd,
    "--vef-card-body-padding": globalCssVars.spacingMd,
    "& > .vef-card-head": {
      flex: "none"
    },
    "& > .vef-card-body": {
      flex: "auto",
      minHeight: 0
    }
  }
});
