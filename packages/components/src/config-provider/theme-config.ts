import type { LiteralUnion } from "@vef-framework-react/shared";
import type { ThemeConfig as ThemeConfigInternal } from "antd";
import type { AliasToken } from "antd/es/theme/interface";

import type { PresetColor, SemanticColor } from "../_base";

import { theme as themeInternal } from "antd";

import {
  globalCssVars,
  presetColors
} from "../_base";
import { mergedPresetColors } from "./constants";

const { defaultAlgorithm, darkAlgorithm } = themeInternal;

/**
 * Get color value from preset or custom color
 */
function getColor(color: LiteralUnion<PresetColor, string>) {
  if (Array.prototype.includes.call(presetColors, color)) {
    return mergedPresetColors[color as PresetColor];
  }

  return color;
}

/**
 * Global token configuration
 */
function buildGlobalTokens(
  isDarkMode: boolean,
  colors: Record<SemanticColor, LiteralUnion<PresetColor, string>>,
  isMotionEnabled: boolean
): Partial<AliasToken> {
  return {
    colorPrimary: getColor(colors.primary),
    colorSuccess: getColor(colors.success),
    colorInfo: getColor(colors.info),
    colorWarning: getColor(colors.warning),
    colorError: getColor(colors.error),
    colorBgContainer: isDarkMode ? "#18181b" : "#ffffff",
    colorBgLayout: isDarkMode ? "#09090b" : "#f8fafc",
    colorBgElevated: isDarkMode ? "#1f1f23" : "#ffffff",
    colorBorder: isDarkMode ? "#27272a" : "#e4e4e7",
    colorBorderSecondary: isDarkMode ? "#1f1f23" : "#f4f4f5",
    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusXS: 4,
    borderRadiusLG: 12,
    borderRadiusOuter: 6,
    motion: isMotionEnabled,
    boxShadow: isDarkMode
      ? "0 2px 8px 0 rgba(0, 0, 0, 0.25), 0 1px 3px -1px rgba(0, 0, 0, 0.2), 0 4px 12px 4px rgba(0, 0, 0, 0.1)"
      : "0 2px 8px 0 rgba(0, 0, 0, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.03), 0 4px 12px 4px rgba(0, 0, 0, 0.02)",
    boxShadowSecondary: isDarkMode
      ? "0 0 0 1px rgba(255, 255, 255, 0.08), 0 4px 12px 0 rgba(0, 0, 0, 0.4)"
      : "0 0 0 1px rgba(0, 0, 0, 0.03), 0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.06), 0 9px 28px 8px rgba(0, 0, 0, 0.04)",
    boxShadowTertiary: isDarkMode
      ? "0 0 0 1px rgba(255, 255, 255, 0.06), 0 2px 6px 0 rgba(0, 0, 0, 0.25)"
      : "0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 2px 8px -2px rgba(0, 0, 0, 0.04), 0 4px 12px 0 rgba(0, 0, 0, 0.03)",
    red: "#fb2c36",
    orange: "#ff6900",
    yellow: "#efb100",
    gold: "#fd9a00",
    lime: "#7ccf00",
    green: "#00c951",
    cyan: "#00b8db",
    blue: "#2b7fff",
    purple: "#ad46ff",
    pink: "#f6339a",
    geekblue: "#8e51ff",
    magenta: "#e12afb"
  };
}

/**
 * Component token configurations
 */
function buildComponentTokens(isDarkMode: boolean): NonNullable<ThemeConfigInternal["components"]> {
  return {
    Menu: {
      darkItemBg: "transparent",
      darkSubMenuItemBg: "transparent",
      subMenuItemBg: "transparent",
      itemMarginInline: 6,
      itemMarginBlock: 6,
      activeBarBorderWidth: 3,
      subMenuItemBorderRadius: 8
    },
    Table: {
      headerBg: isDarkMode ? "#1f1f23" : "#f8fafc",
      headerBorderRadius: 0,
      headerSplitColor: isDarkMode ? "#27272a" : "#e2e8f0",
      headerColor: isDarkMode ? globalCssVars.colorText : "#475569",
      headerSortActiveBg: isDarkMode ? "#27272a" : "#f1f5f9",
      headerSortHoverBg: isDarkMode ? "#27272a" : "#f1f5f9",
      headerFilterHoverBg: isDarkMode ? "#27272a" : "#f1f5f9",
      fixedHeaderSortActiveBg: isDarkMode ? "#27272a" : "#f1f5f9",
      rowHoverBg: isDarkMode ? "#1f1f23" : "#f8fafc",
      borderColor: isDarkMode ? "#27272a" : "#f1f5f9",
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
      fontWeightStrong: 500
    },
    Card: {
      headerBg: "transparent"
    },
    Select: {
      optionSelectedColor: globalCssVars.colorPrimary
    },
    Tree: {
      titleHeight: 32,
      indentSize: 16,
      nodeSelectedColor: globalCssVars.colorPrimary
    },
    TreeSelect: {
      titleHeight: 28,
      indentSize: 16,
      nodeSelectedColor: globalCssVars.colorPrimary
    },
    Radio: {
      radioSize: 18
    },
    Tooltip: {
      boxShadowSecondary: isDarkMode
        ? "0 4px 12px 0 rgba(0, 0, 0, 0.4)"
        : "0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.06), 0 9px 28px 8px rgba(0, 0, 0, 0.04)"
    }
  };
}

/**
 * Build complete theme configuration
 */
export function buildThemeConfig(
  isDarkMode: boolean,
  colors: Record<SemanticColor, LiteralUnion<PresetColor, string>>,
  isMotionEnabled: boolean
): ThemeConfigInternal {
  return {
    algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
    cssVar: {
      prefix: "vef"
    },
    hashed: false,
    token: buildGlobalTokens(isDarkMode, colors, isMotionEnabled),
    components: buildComponentTokens(isDarkMode)
  };
}
