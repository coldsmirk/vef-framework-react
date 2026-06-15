import { IconButton } from "@vef-framework-react/components";
import { MoonIcon, SunIcon, SunMoon } from "lucide-react";

import { useThemeStore } from "../../../../stores";
import { useColorSchemeUpdater } from "../../hooks";

interface ColorSchemeProps {
  className?: string;
}

const colorSchemeIcons = {
  light: <SunIcon />,
  dark: <MoonIcon />,
  system: <SunMoon />
};

const colorSchemeTips = {
  light: "切换深色主题",
  dark: "跟随系统主题",
  system: "切换浅色主题"
};

export function ColorScheme({ className }: ColorSchemeProps): React.JSX.Element {
  const colorScheme = useThemeStore(state => state.colorScheme);
  const { getNextColorScheme, updateColorScheme } = useColorSchemeUpdater();

  function handleClick(event: React.MouseEvent): void {
    updateColorScheme(
      getNextColorScheme(colorScheme),
      { x: event.clientX, y: event.clientY },
      true
    );
  }

  return (
    <IconButton
      className={className}
      icon={colorSchemeIcons[colorScheme]}
      size="large"
      tip={colorSchemeTips[colorScheme]}
      onClick={handleClick}
    />
  );
}
