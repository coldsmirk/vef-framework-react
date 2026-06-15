import { pick } from "@vef-framework-react/shared";
import { theme as themeInternal } from "antd";

import { presetColors } from "../_base";

const { defaultConfig } = themeInternal;
const defaultPresetColors = pick(defaultConfig.token, presetColors);

export const mergedPresetColors = {
  ...defaultPresetColors,
  red: "#fb2c36",
  orange: "#ff6900",
  yellow: "#f0b100",
  lime: "#7ccf00",
  green: "#00c950",
  cyan: "#00b8db",
  blue: "#2f54eb",
  purple: "#ad46ff",
  pink: "#f6339a",
  geekblue: "#615fff"
};

export const defaultColors = {
  primary: "blue",
  success: "green",
  info: "blue",
  warning: "orange",
  error: "red"
} as const;
