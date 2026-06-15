import type { KeyboardProps } from "./props";

import { css } from "@emotion/react";
import { useMemo } from "react";

import { globalCssVars } from "../_base";

const keyboardStyle = css({
  "--vef-keyboard-size": globalCssVars.fontSize,
  "--vef-keyboard-height": "1.6em",
  fontFamily: globalCssVars.fontFamilyCode,
  fontWeight: "bold",
  fontSize: "var(--vef-keyboard-size)",
  lineHeight: 1,
  color: globalCssVars.colorTextLabel,
  borderRadius: globalCssVars.borderRadiusSm,
  border: `${globalCssVars.lineWidth} ${globalCssVars.lineType}`,
  borderBlockEndWidth: "3px",
  borderColor: globalCssVars.colorBorder,
  backgroundColor: globalCssVars.colorFillQuaternary,
  unicodeBidi: "embed",
  textAlign: "center",
  paddingInline: "0.45em",
  height: "var(--vef-keyboard-height)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center"
});

export function Keyboard({
  size = "medium",
  style,
  ...props
}: KeyboardProps) {
  const mergedStyle = useMemo(() => {
    return {
      ...style,
      "--vef-keyboard-size": size === "small" ? globalCssVars.fontSizeSm : size === "large" ? globalCssVars.fontSizeLg : globalCssVars.fontSize
    };
  }, [size, style]);

  return (
    <kbd
      css={keyboardStyle}
      style={mergedStyle}
      {...props}
    />
  );
}

export { type KeyboardProps } from "./props";
