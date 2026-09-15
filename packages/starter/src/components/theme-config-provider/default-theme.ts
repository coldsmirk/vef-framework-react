import type { ColorScheme, ThemeColors } from "../../stores";

import { useShallow } from "@vef-framework-react/core";
import { createContext, use, useMemo } from "react";

import { useThemeStore } from "../../stores";

/**
 * The theme an application starts from. Whatever the user picks in the theme
 * panel takes precedence, and only those picks are persisted.
 */
export interface DefaultTheme {
  colorScheme?: ColorScheme;
  colors?: Partial<ThemeColors>;
}

interface ResolvedDefaultTheme {
  colorScheme: ColorScheme;
  colors: ThemeColors;
}

const FRAMEWORK_DEFAULT_THEME: ResolvedDefaultTheme = {
  colorScheme: "system",
  colors: {
    primary: "#155dfc",
    success: "#00c951",
    info: "#00a6f4",
    warning: "#ff6900",
    error: "#fb2c36"
  }
};

export function resolveDefaultTheme({ colorScheme, colors }: DefaultTheme = {}): ResolvedDefaultTheme {
  return {
    colorScheme: colorScheme ?? FRAMEWORK_DEFAULT_THEME.colorScheme,
    colors: {
      ...FRAMEWORK_DEFAULT_THEME.colors,
      ...colors
    }
  };
}

const DefaultThemeContext = createContext<ResolvedDefaultTheme>(FRAMEWORK_DEFAULT_THEME);
DefaultThemeContext.displayName = "DefaultThemeContext";

export const DefaultThemeProvider = DefaultThemeContext.Provider;

/**
 * The color scheme in effect: the user's pick, otherwise the application default.
 */
export function useEffectiveColorScheme(): ColorScheme {
  const { colorScheme } = use(DefaultThemeContext);
  const pickedColorScheme = useThemeStore(state => state.colorScheme);

  return pickedColorScheme ?? colorScheme;
}

/**
 * The semantic colors in effect: the user's picks over the application defaults.
 */
export function useEffectiveThemeColors(): ThemeColors {
  const { colors } = use(DefaultThemeContext);
  const pickedColors = useThemeStore(useShallow(state => state.colors));

  return useMemo(() => {
    return {
      ...colors,
      ...pickedColors
    };
  }, [colors, pickedColors]);
}
