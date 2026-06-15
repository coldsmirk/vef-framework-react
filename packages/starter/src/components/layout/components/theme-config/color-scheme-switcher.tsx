import type { Position, SegmentedOption } from "@vef-framework-react/components";

import type { ColorScheme } from "../../../../stores";

import { css } from "@emotion/react";
import { Center, globalCssVars, Icon, Segmented } from "@vef-framework-react/components";
import { MoonIcon, SunIcon, SunMoon } from "lucide-react";
import { useRef } from "react";

import { useThemeStore } from "../../../../stores";
import { useColorSchemeUpdater } from "../../hooks";

const itemStyle = css({
  height: `calc(${globalCssVars.controlHeight} - var(--vef-segmented-track-padding) * 2)`,
  width: "64px"
});

const options: SegmentedOption[] = [
  {
    label: (
      <Center css={itemStyle}>
        <Icon component={SunIcon} />
      </Center>
    ),
    value: "light"
  },
  {
    label: (
      <Center css={itemStyle}>
        <Icon component={MoonIcon} />
      </Center>
    ),
    value: "dark"
  },
  {
    label: (
      <Center css={itemStyle}>
        <Icon component={SunMoon} />
      </Center>
    ),
    value: "system"
  }
];

export function ColorSchemeSwitcher(): React.JSX.Element {
  const colorScheme = useThemeStore(state => state.colorScheme);
  const { updateColorScheme } = useColorSchemeUpdater();
  const positionRef = useRef<Position>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2
  });

  function handleChange(value: string | number): void {
    updateColorScheme(value as ColorScheme, positionRef.current);
  }

  function handleClick(event: React.MouseEvent): void {
    positionRef.current = {
      x: event.clientX,
      y: event.clientY
    };
  }

  return (
    <Segmented
      options={options}
      value={colorScheme}
      onChange={handleChange}
      onClick={handleClick}
    />
  );
}
