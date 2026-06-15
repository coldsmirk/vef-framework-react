import type { MenuItem, MenuItemType, SubMenuType } from "@vef-framework-react/components";

import type { UserMenu } from "../../../types";

import { useCallback, useMemo } from "react";

import { useRouteFullPath } from "../../../hooks";
import { useAppStore } from "../../../stores";
import { useMenuNavigate } from "./use-menu-navigate";

/**
 * Flatten a top-level menu entry into a leaf item so the mixed-layout header
 * renders first-level entries without their dropdown children.
 */
function toTopLevelItem(item: Readonly<MenuItem>): MenuItem {
  const {
    key,
    label,
    icon
  } = item as MenuItemType | SubMenuType;

  return {
    type: "item",
    key,
    label,
    icon
  };
}

/**
 * Find the first navigable leaf within a menu subtree, skipping hidden `view`
 * entries. Returns the menu itself when it is already a leaf.
 */
function findFirstLeafMenu(menu: UserMenu): UserMenu | undefined {
  if (menu.type !== "directory") {
    return menu;
  }

  for (const child of menu.children ?? []) {
    if (child.type === "view") {
      continue;
    }

    const leaf = findFirstLeafMenu(child);

    if (leaf) {
      return leaf;
    }
  }

  return undefined;
}

export interface UseMixedMenuResult {
  /**
   * First-level menu entries, flattened for the top header.
   */
  topLevelItems: MenuItem[];
  /**
   * Path of the first-level section the current route belongs to.
   */
  activeSectionKey?: string;
  /**
   * Children of the active section, rendered in the sidebar.
   */
  sectionItems?: MenuItem[];
  /**
   * Whether the active section has a sidebar to show.
   */
  hasSectionMenu: boolean;
  /**
   * Navigate into a top-level section's first reachable leaf.
   */
  selectTopSection: (key: string) => void;
}

/**
 * Derive the data the mixed menu layout needs from the current route: the
 * flattened first-level items for the header, the active first-level section,
 * and that section's children for the sidebar.
 *
 * @returns The derived mixed-menu data
 */
export function useMixedMenu(): UseMixedMenuResult {
  const fullPath = useRouteFullPath();
  const navigate = useMenuNavigate();
  const menuItems = useAppStore(state => state.menuItems);
  const menuPathMap = useAppStore(state => state.menuPathMap);
  const userMenuMap = useAppStore(state => state.userMenuMap);

  const activeSectionKey = menuPathMap?.get(fullPath)?.[0];

  const topLevelItems = useMemo(
    () => (menuItems ?? []).map(item => toTopLevelItem(item)),
    [menuItems]
  );

  const sectionItems = useMemo(() => {
    if (!activeSectionKey) {
      return;
    }

    const section = menuItems?.find(item => item?.key === activeSectionKey);

    if (!section || !("children" in section)) {
      return;
    }

    return section.children as MenuItem[] | undefined;
  }, [menuItems, activeSectionKey]);

  const hasSectionMenu = !!sectionItems?.length;

  const selectTopSection = useCallback((key: string) => {
    const section = userMenuMap?.get(key);

    if (!section) {
      return;
    }

    navigate(findFirstLeafMenu(section) ?? section);
  }, [navigate, userMenuMap]);

  return {
    topLevelItems,
    activeSectionKey,
    sectionItems,
    hasSectionMenu,
    selectTopSection
  };
}
