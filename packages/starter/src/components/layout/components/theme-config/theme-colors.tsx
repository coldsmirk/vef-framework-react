import type { SemanticColor } from "@vef-framework-react/components";
import type { JSX } from "react";

import { css } from "@emotion/react";
import { globalCssVars, semanticColors } from "@vef-framework-react/components";

import { ConfigItem } from "./config-item";
import { ThemeColorPicker } from "./theme-color-picker";

const wrapperStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingSm
});

const semanticColorLabels: Record<SemanticColor, string> = {
  primary: "主色",
  info: "信息色",
  success: "成功色",
  warning: "警告色",
  error: "错误色"
};

export function ThemeColors(): JSX.Element {
  return (
    <div css={wrapperStyle}>
      {semanticColors.map(color => (
        <ConfigItem key={color} label={semanticColorLabels[color]}>
          <ThemeColorPicker color={color} />
        </ConfigItem>
      ))}
    </div>
  );
}
