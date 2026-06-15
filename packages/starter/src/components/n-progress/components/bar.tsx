import type { CSSProperties } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

interface BarProps {
  progress: number;
}

const barStyle = css({
  background: `linear-gradient(90deg,
    ${globalCssVars.colorPrimary} 0%,
    ${globalCssVars.colorPrimaryHover} 50%,
    ${globalCssVars.colorPrimaryActive} 100%)`,
  borderRadius: "3px",
  boxShadow: `
    0 0 15px ${globalCssVars.colorPrimary},
    0 0 8px ${globalCssVars.colorPrimaryHover},
    0 2px 4px rgba(0, 0, 0, 0.1)
  `,
  height: "3px",
  left: 0,
  marginLeft: "var(--vef-n-progress-bar-margin-left)",
  position: "fixed",
  top: 0,
  transition: "margin-left var(--vef-n-progress-animation-duration) cubic-bezier(0.4, 0, 0.6, 1)",
  width: "100%",
  zIndex: 9999
});

const glowStyle = css({
  background: `linear-gradient(90deg,
    transparent 0%,
    ${globalCssVars.colorPrimary}33 40%,
    ${globalCssVars.colorPrimary} 100%)`,
  boxShadow: `0 0 30px ${globalCssVars.colorPrimary}`,
  filter: "blur(3px)",
  height: "calc(100% + 2px)",
  opacity: 0.9,
  position: "absolute",
  right: 0,
  top: "-1px",
  transform: "skewX(-10deg)",
  width: "150px"
});

export function Bar({ progress }: BarProps): React.ReactNode {
  const style = {
    "--vef-n-progress-bar-margin-left": `${(-1 + progress) * 100}%`
  } as CSSProperties;

  return (
    <div css={barStyle} style={style}>
      <div css={glowStyle} />
    </div>
  );
}
