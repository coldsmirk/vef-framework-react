import type { JSX } from "react";

import { IconButton } from "@vef-framework-react/components";

import { useThemeStore } from "../../../../stores";
import { MenuFoldLeftIcon } from "./menu-fold-left-icon";
import { MenuUnfoldLeftIcon } from "./menu-unfold-left-icon";

interface MenuBurgerProps {
  className?: string;
}

export function MenuBurger({ className }: MenuBurgerProps): JSX.Element {
  const isSidebarCollapsed = useThemeStore(state => state.isSidebarCollapsed);
  const icon = isSidebarCollapsed ? <MenuUnfoldLeftIcon /> : <MenuFoldLeftIcon />;
  const tip = isSidebarCollapsed ? "展开菜单" : "收起菜单";

  function handleClick(): void {
    useThemeStore.setState(state => {
      state.isSidebarCollapsed = !state.isSidebarCollapsed;
    });
  }

  return (
    <IconButton
      className={className}
      icon={icon}
      size="large"
      tip={tip}
      onClick={handleClick}
    />
  );
}
