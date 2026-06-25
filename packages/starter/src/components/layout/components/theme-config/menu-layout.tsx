import type { JSX } from "react";

import { css } from "@emotion/react";
import { Center, globalCssVars, Switch, Tooltip } from "@vef-framework-react/components";
import { clsx } from "@vef-framework-react/core";

import { useThemeStore } from "../../../../stores";
import { ConfigItem } from "./config-item";
import { MenuLayoutCard } from "./menu-layout-card";

const wrapperStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: globalCssVars.spacingMd
});

export function MenuLayout(): JSX.Element {
  const menuLayout = useThemeStore(state => state.menuLayout);
  const isTabsVisible = useThemeStore(state => state.isTabsVisible);
  const isDarkSidebar = useThemeStore(state => state.isDarkSidebar);

  function handleVerticalClick(): void {
    useThemeStore.setState(state => {
      state.menuLayout = "vertical";
    });
  }

  function handleHorizontalClick(): void {
    useThemeStore.setState(state => {
      state.menuLayout = "horizontal";
    });
  }

  function handleMixedClick(): void {
    useThemeStore.setState(state => {
      state.menuLayout = "mixed";
    });
  }

  function handleTabsVisibleChange(value: boolean): void {
    useThemeStore.setState(state => {
      state.isTabsVisible = value;
    });
  }

  function handleDarkSidebarChange(value: boolean): void {
    useThemeStore.setState(state => {
      state.isDarkSidebar = value;
    });
  }

  return (
    <div css={wrapperStyle}>
      <Center gap="medium">
        <Tooltip placement="bottom" title="垂直菜单模式">
          <MenuLayoutCard
            className={clsx({ selected: menuLayout === "vertical" })}
            mode="vertical"
            onClick={handleVerticalClick}
          />
        </Tooltip>

        <Tooltip placement="bottom" title="水平菜单模式">
          <MenuLayoutCard
            className={clsx({ selected: menuLayout === "horizontal" })}
            mode="horizontal"
            onClick={handleHorizontalClick}
          />
        </Tooltip>

        <Tooltip placement="bottom" title="混合菜单模式">
          <MenuLayoutCard
            className={clsx({ selected: menuLayout === "mixed" })}
            mode="mixed"
            onClick={handleMixedClick}
          />
        </Tooltip>
      </Center>

      <ConfigItem label="显示标签页">
        <Switch
          checked={isTabsVisible}
          onChange={handleTabsVisibleChange}
        />
      </ConfigItem>

      <ConfigItem label="深色侧边栏">
        <Tooltip title={menuLayout === "vertical" ? undefined : "仅在垂直菜单模式下生效"}>
          <Switch
            checked={isDarkSidebar}
            disabled={menuLayout !== "vertical"}
            onChange={handleDarkSidebarChange}
          />
        </Tooltip>
      </ConfigItem>
    </div>
  );
}
