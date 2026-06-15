import type { SerializedStyles } from "@emotion/react";
import type { ThemeConfig as AntdThemeConfig } from "antd";

import type { ThemeConfig } from "./props";

import { css } from "@emotion/react";
import { useReducedMotion } from "@vef-framework-react/hooks";
import { useMemo } from "react";

import { mergeProps } from "../_base";
import { defaultColors } from "./constants";
import { buildColorCssVars } from "./css-vars";
import { buildThemeConfig } from "./theme-config";

interface ConfigProviderResult {
  themeConfig: AntdThemeConfig;
  globalCssVars: SerializedStyles;
  isDarkMode: boolean;
}

export function useConfigProvider(theme: ThemeConfig = {}): ConfigProviderResult {
  const {
    isDarkMode = false,
    colors = {},
    globalCssVars = {}
  } = theme;

  const mergedColors = useMemo(() => mergeProps(colors, defaultColors), [colors]);
  const isMotionEnabled = !useReducedMotion(false);

  const themeConfig = useMemo(
    () => buildThemeConfig(isDarkMode, mergedColors, isMotionEnabled),
    [isDarkMode, mergedColors, isMotionEnabled]
  );

  const mergedGlobalCssVars = useMemo(() => {
    const cssVars = buildColorCssVars(mergedColors);

    return css({
      ":root": { ...cssVars, ...globalCssVars }
    });
  }, [globalCssVars, mergedColors]);

  return {
    themeConfig,
    globalCssVars: mergedGlobalCssVars,
    isDarkMode
  };
}
