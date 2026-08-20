import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

export const page = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "100vh",
  padding: 24,
  backgroundColor: globalCssVars.colorBgLayout
});

export const panel = css({
  width: "100%",
  maxWidth: 420
});
