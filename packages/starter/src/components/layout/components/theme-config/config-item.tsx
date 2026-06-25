import type { JSX, PropsWithChildren, ReactNode } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

interface ConfigItemProps extends PropsWithChildren {
  className?: string;
  label: ReactNode;
}

const itemStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  columnGap: globalCssVars.spacingXs
});

export function ConfigItem({
  className,
  label,
  children
}: ConfigItemProps): JSX.Element {
  return (
    <div className={className} css={itemStyle}>
      <span>{label}</span>
      {children}
    </div>
  );
}
