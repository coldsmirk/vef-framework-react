import type { IconButtonProps } from "./props";

import { css } from "@emotion/react";
import { isNullish } from "@vef-framework-react/shared";
import { cloneElement } from "react";

import { globalCssVars } from "../_base";
import { Button } from "../button";
import { Tooltip } from "../tooltip";

const buttonStyle = css({
  padding: 0,
  width: globalCssVars.controlHeight,
  "&.vef-btn-sm": {
    width: globalCssVars.controlHeightSm
  },
  "&.vef-btn-lg": {
    width: globalCssVars.controlHeightLg
  }
});

export function IconButton({
  icon,
  tip,
  tipDelay,
  placement,
  ...props
}: IconButtonProps) {
  const buttonNode = (
    <Button
      css={buttonStyle}
      type="text"
      {...props}
    >
      {
        cloneElement(icon, {
          size: "1.2em"
        })
      }
    </Button>
  );

  return isNullish(tip)
    ? buttonNode
    : (
        <Tooltip
          mouseEnterDelay={tipDelay}
          placement={placement}
          title={tip}
        >
          {buttonNode}
        </Tooltip>
      );
}

export { type IconButtonProps } from "./props";
