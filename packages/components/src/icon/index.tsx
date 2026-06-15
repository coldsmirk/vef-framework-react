import type { IconProps } from "./props";

import { css } from "@emotion/react";
import { Icon as LucideIcon } from "lucide-react";

const iconStyle = css({
  display: "inline-flex",
  justifyContent: "center",
  alignItems: "center",
  color: "inherit",
  fontStyle: "normal",
  lineHeight: 0,
  textTransform: "none",
  textRendering: "optimizeLegibility",
  WebkitFontSmoothing: "antialiased",
  MozOsxFontSmoothing: "grayscale",
  verticalAlign: "-0.25em"
});

export function Icon({
  component: Component,
  iconNode,
  className,
  style,
  ...props
}: IconProps) {
  return (
    <span
      className={className}
      css={iconStyle}
      style={style}
    >
      {
        iconNode
          ? <LucideIcon iconNode={iconNode} size="1.2em" {...props} />
          : <Component size="1.2em" {...props} />
      }
    </span>
  );
}

export { type IconProps } from "./props";
