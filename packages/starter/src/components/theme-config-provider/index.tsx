import type { ComponentDefaults } from "@vef-framework-react/components";
import type { JSX, PropsWithChildren } from "react";

import type { DefaultTheme } from "./default-theme";

import { Global } from "@emotion/react";
import { ConfigProvider } from "@vef-framework-react/components";
import { useMemo } from "react";

import { DefaultThemeProvider, resolveDefaultTheme } from "./default-theme";
import { globalStyle } from "./global-style";
import { useColorModeEffect } from "./use-color-mode-effect";
import { useThemeConfig } from "./use-theme-config";

export interface ThemeConfigProviderProps extends PropsWithChildren {
  /**
   * The theme the application starts from; the user's own picks in the theme
   * panel take precedence.
   */
  defaultTheme?: DefaultTheme;
  /**
   * Application-wide default props for framework components.
   */
  components?: ComponentDefaults;
}

function ThemedConfigProvider({ components, children }: Omit<ThemeConfigProviderProps, "defaultTheme">): JSX.Element {
  const theme = useThemeConfig();
  useColorModeEffect();

  return (
    <ConfigProvider components={components} theme={theme}>
      <Global styles={globalStyle} />
      {children}
    </ConfigProvider>
  );
}

export function ThemeConfigProvider({
  defaultTheme,
  components,
  children
}: ThemeConfigProviderProps): JSX.Element {
  const resolvedDefaultTheme = useMemo(() => resolveDefaultTheme(defaultTheme), [defaultTheme]);

  return (
    <DefaultThemeProvider value={resolvedDefaultTheme}>
      <ThemedConfigProvider components={components}>
        {children}
      </ThemedConfigProvider>
    </DefaultThemeProvider>
  );
}

export { useEffectiveColorScheme, useEffectiveThemeColors, type DefaultTheme } from "./default-theme";
