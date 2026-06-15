import type { PropsWithChildren } from "react";

import { ConfigProvider } from "@vef-framework-react/components";

import { useColorModeEffect } from "./use-color-mode-effect";
import { useThemeConfig } from "./use-theme-config";

export function ThemeConfigProvider({ children }: PropsWithChildren): React.JSX.Element {
  const theme = useThemeConfig();
  useColorModeEffect();

  return (
    <ConfigProvider theme={theme}>
      {children}
    </ConfigProvider>
  );
}
