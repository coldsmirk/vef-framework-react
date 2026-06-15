import type { CSSProperties, PropsWithChildren } from "react";

import { css } from "@emotion/react";

interface ContainerProps {
  animationDuration: number;
  isFinished: boolean;
}

const containerStyle = css({
  opacity: "var(--vef-n-progress-opacity)",
  pointerEvents: "none",
  transition: "opacity var(--vef-n-progress-animation-duration) cubic-bezier(0.4, 0, 0.2, 1)"
});

export function Container({
  animationDuration,
  children,
  isFinished
}: PropsWithChildren<ContainerProps>): React.ReactNode {
  const style = {
    "--vef-n-progress-animation-duration": `${animationDuration}ms`,
    "--vef-n-progress-opacity": isFinished ? 0 : 1
  } as CSSProperties;

  return (
    <div css={containerStyle} style={style}>
      {children}
    </div>
  );
}
