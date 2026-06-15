import { useEffect } from "react";

import { useThemeStore } from "../../stores";

export function useColorModeEffect(): void {
  const isGrayscaleMode = useThemeStore(state => state.isGrayscaleMode);
  const isColorBlindMode = useThemeStore(state => state.isColorBlindMode);

  useEffect(() => {
    const { classList } = document.documentElement;
    classList.toggle("color-blind-mode", isColorBlindMode);
  }, [isColorBlindMode]);

  useEffect(() => {
    const { classList } = document.documentElement;
    classList.toggle("grayscale-mode", isGrayscaleMode);
  }, [isGrayscaleMode]);
}
