import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { useMemo } from "react";

const footerStyle = css({
  height: "100%",
  backgroundColor: globalCssVars.colorBgContainer,
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
});

export function Footer() {
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  return (
    <div css={footerStyle}>
      Copyright ©
      {" "}
      {currentYear}
      {" "}
      VEF Framework. All rights reserved.
    </div>
  );
}
