import { css } from "@emotion/react";

import { globalCssVars } from "../_base";

export const main = css({
  "&.vef-card": {
    "--vef-card-header-padding": 0
  }
});

export const toolbar = css({
  padding: globalCssVars.spacingMd,
  fontWeight: "normal"
});
