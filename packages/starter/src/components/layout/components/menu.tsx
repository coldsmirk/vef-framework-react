import type { GetProp, MenuItem, MenuProps as MenuPropsInternal, Orientation } from "@vef-framework-react/components";

import { css } from "@emotion/react";
import { Menu as MenuInternal } from "@vef-framework-react/components";
import { useDidUpdate } from "@vef-framework-react/hooks";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouteFullPath } from "../../../hooks";
import { useAppStore, useThemeStore } from "../../../stores";
import { useMenuNavigate } from "../hooks";

interface MenuProps {
  layout: Orientation;
  isSidebarCollapsed?: boolean;
  /**
   * Menu items to render. Defaults to the full tree from the app store.
   */
  items?: readonly MenuItem[];
  /**
   * Selected keys override. Defaults to the current route's full path.
   */
  selectedKeys?: string[];
  /**
   * Select handler override. Defaults to navigating to the picked menu.
   */
  onSelectMenu?: (key: string) => void;
}

// Only styles shared by BOTH the top (horizontal) and side (inline) menus live here. Mode-specific
// styling belongs to the owning component: top menu → Header, side menu → Sidebar — so neither
// pollutes the other.
const menuStyle = css({
  backgroundColor: "transparent",
  borderInlineEnd: "none",
  borderBlockEnd: "none",

  "&.vef-menu-root": {
    "--vef-font-size": "calc(var(--vef-font-size) + 1px))",

    "& .vef-menu-title-content": {
      userSelect: "none",
      fontWeight: 500
    }
  }
});

export function Menu({
  layout,
  isSidebarCollapsed = false,
  items,
  selectedKeys,
  onSelectMenu
}: MenuProps) {
  const navigate = useMenuNavigate();
  const fullPath = useRouteFullPath();
  const userMenuMap = useAppStore(state => state.userMenuMap);
  const menuPathMap = useAppStore(state => state.menuPathMap);
  const storeMenuItems = useAppStore(state => state.menuItems);
  const isMenuAccordionMode = useThemeStore(state => state.isMenuAccordionMode);
  const menuItems = items ?? storeMenuItems;
  const menuProps = useMemo(() => {
    if (layout === "vertical") {
      return {
        inlineCollapsed: isSidebarCollapsed,
        inlineIndent: 18,
        mode: "inline" as const
      };
    }

    return {
      mode: "horizontal" as const
    };
  }, [layout, isSidebarCollapsed]);

  const handleSelect = useCallback<GetProp<MenuPropsInternal, "onSelect">>(
    ({ key }) => {
      if (onSelectMenu) {
        onSelectMenu(key);
        return;
      }

      const menu = userMenuMap?.get(key);

      if (menu) {
        navigate(menu);
      }
    },
    [navigate, onSelectMenu, userMenuMap]
  );

  const menuLevelMap = useMemo(
    () => new Map<string, number>(
      menuPathMap
        ?.entries()
        ?.map(
          ([key, path]) => [key, path.length]
        )
    ),
    [menuPathMap]
  );
  const [openedKeys, setOpenedKeys] = useState<string[]>([]);

  useEffect(() => {
    if (isSidebarCollapsed || layout === "horizontal") {
      return;
    }

    setOpenedKeys([...menuPathMap?.get(fullPath) ?? []]);
  }, [fullPath, isSidebarCollapsed, layout, menuPathMap]);
  useDidUpdate(() => {
    if (isSidebarCollapsed || layout === "horizontal") {
      return;
    }

    setOpenedKeys([...menuPathMap?.get(fullPath) ?? []]);
  }, [fullPath, isSidebarCollapsed, layout, menuPathMap]);

  const handleOpenedKeysChange = useCallback<GetProp<MenuPropsInternal, "onOpenChange">>(
    keys => {
      const newOpenedKey = keys.find(key => !openedKeys.includes(key));

      if (!isMenuAccordionMode || !newOpenedKey) {
        setOpenedKeys(keys);
        return;
      }

      const newKeys: string[] = [];
      const newKeyLevel = menuLevelMap.get(newOpenedKey)!;

      for (const key of keys) {
        const keyLevel = menuLevelMap.get(key)!;

        if (keyLevel < newKeyLevel) {
          newKeys.push(key);
        } else if (keyLevel === newKeyLevel && key === newOpenedKey) {
          newKeys.push(key);
        }
      }

      setOpenedKeys(newKeys);
    },
    [isMenuAccordionMode, menuLevelMap, openedKeys]
  );

  return (
    <MenuInternal
      {...menuProps}
      css={menuStyle}
      items={menuItems as never}
      openKeys={openedKeys}
      selectedKeys={selectedKeys ?? (fullPath ? [fullPath] : [])}
      onOpenChange={handleOpenedKeysChange}
      onSelect={handleSelect}
    />
  );
}
