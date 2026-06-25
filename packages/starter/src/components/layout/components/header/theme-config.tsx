import type { JSX } from "react";

import { IconButton } from "@vef-framework-react/components";
import { SwatchBookIcon } from "lucide-react";

import { useThemeStore } from "../../../../stores";

interface ThemeConfigProps {
  className?: string;
}

function handleClick(): void {
  useThemeStore.setState(state => {
    state.isThemeConfigVisible = true;
  });
}

export function ThemeConfig({ className }: ThemeConfigProps): JSX.Element {
  return (
    <IconButton
      className={className}
      icon={<SwatchBookIcon />}
      size="large"
      tip="主题配置"
      onClick={handleClick}
    />
  );
}
