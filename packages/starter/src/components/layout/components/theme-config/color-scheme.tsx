import { css } from "@emotion/react";
import { Center, globalCssVars, Switch } from "@vef-framework-react/components";
import { useShallow } from "@vef-framework-react/core";

import { useThemeStore } from "../../../../stores";
import { ColorSchemeSwitcher } from "./color-scheme-switcher";
import { ConfigItem } from "./config-item";

const wrapperStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingMd
});

export function ColorScheme(): React.JSX.Element {
  const {
    isGrayscaleMode,
    isColorBlindMode,
    isMenuAccordionMode
  } = useThemeStore(
    useShallow(
      state => {
        return {
          isGrayscaleMode: state.isGrayscaleMode,
          isColorBlindMode: state.isColorBlindMode,
          isMenuAccordionMode: state.isMenuAccordionMode
        };
      }
    )
  );

  function handleGrayscaleModeChange(value: boolean): void {
    useThemeStore.setState(state => {
      state.isGrayscaleMode = value;
    });
  }

  function handleColorBlindModeChange(value: boolean): void {
    useThemeStore.setState(state => {
      state.isColorBlindMode = value;
    });
  }

  function handleMenuAccordionModeChange(value: boolean): void {
    useThemeStore.setState(state => {
      state.isMenuAccordionMode = value;
    });
  }

  return (
    <div css={wrapperStyle}>
      <Center>
        <ColorSchemeSwitcher />
      </Center>

      <ConfigItem label="灰度模式">
        <Switch
          checked={isGrayscaleMode}
          onChange={handleGrayscaleModeChange}
        />
      </ConfigItem>

      <ConfigItem label="色弱模式">
        <Switch
          checked={isColorBlindMode}
          onChange={handleColorBlindModeChange}
        />
      </ConfigItem>

      <ConfigItem label="菜单手风琴模式">
        <Switch
          checked={isMenuAccordionMode}
          onChange={handleMenuAccordionModeChange}
        />
      </ConfigItem>
    </div>
  );
}
