import type { ThemeConfig } from "@vef-framework-react/components";

import { useShallow } from "@vef-framework-react/core";
import { useEffect, useMemo, useState } from "react";

import { useThemeStore } from "../../stores";
import { globalStyle } from "./global-style";

const prefersDarkModeQuery = "(prefers-color-scheme: dark)";

function getSystemDarkMode(): boolean {
  if (globalThis.window === undefined) {
    return false;
  }

  return globalThis.matchMedia(prefersDarkModeQuery).matches;
}

export function useThemeConfig(): ThemeConfig {
  const colors = useThemeStore(useShallow(state => state.colors));
  const colorScheme = useThemeStore(state => state.colorScheme);

  // Initialize with safe default, will be corrected in useEffect
  const [isDark, setIsDark] = useState(() => {
    switch (colorScheme) {
      case "dark": {
        return true;
      }

      case "light": {
        return false;
      }

      default: {
        return getSystemDarkMode();
      }
    }
  });

  const isDarkMode = colorScheme === "dark" || (colorScheme === "system" && isDark);

  const theme = useMemo<ThemeConfig>(() => {
    return {
      isDarkMode,
      colors,
      globalStyle
    };
  }, [isDarkMode, colors]);

  // Handle DOM class updates
  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const { classList } = document.documentElement;
    classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  // Handle system theme changes and colorScheme updates
  useEffect(() => {
    if (globalThis.window === undefined) {
      return;
    }

    if (colorScheme !== "system") {
      // When not in system mode, update isDark based on explicit colorScheme
      setIsDark(colorScheme === "dark");
      return;
    }

    const query = globalThis.matchMedia(prefersDarkModeQuery);

    // Always sync with system preference when switching to system mode
    // or on first render
    setIsDark(query.matches);

    function handleChange(event: MediaQueryListEvent): void {
      setIsDark(event.matches);
    }

    query.addEventListener("change", handleChange);

    return () => {
      query.removeEventListener("change", handleChange);
    };
  }, [colorScheme]);

  return theme;
}
