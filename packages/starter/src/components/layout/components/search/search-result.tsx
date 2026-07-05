import type { WithPinyin } from "@vef-framework-react/shared";

import type { UserMenu } from "../../../../types";

import { css } from "@emotion/react";
import { Empty, globalCssVars } from "@vef-framework-react/components";
import { AnimatePresence, motion } from "@vef-framework-react/core";
import { useHotkeys } from "@vef-framework-react/hooks";
import { getPinyin, getPinyinInitials } from "@vef-framework-react/shared";
import { useEffect, useMemo, useState } from "react";

import { menuKeyOf } from "../../../../helpers/menu-key";
import { useAppStore } from "../../../../stores";
import { useMenuNavigate } from "../../hooks";
import { useLayoutStore } from "../../store";
import { SearchResultItem } from "./search-result-item";

interface SearchResultProps {
  keyword: string;
}

type MenuItem = WithPinyin<UserMenu, "name">;

const resultStyle = css({
  display: "flex",
  flexDirection: "column",
  rowGap: globalCssVars.spacingSm
});

export function SearchResult({ keyword }: SearchResultProps) {
  const setIsSearchVisible = useLayoutStore(state => state.setIsSearchVisible);
  const userMenuMap = useAppStore(state => state.userMenuMap);
  const menuItems = useMemo(
    () => buildMenuItems(userMenuMap ? userMenuMap.values().toArray() : []),
    [userMenuMap]
  );
  const matchedMenuItems = useMemo(
    () => menuItems.filter(item => match(item, keyword)),
    [menuItems, keyword]
  );
  const [activeMenuKey, setActiveMenuKey] = useState<string>();

  function handleMenuSelect(offset: 1 | -1): void {
    const { length } = matchedMenuItems;

    if (length === 0) {
      return;
    }

    const index = matchedMenuItems.findIndex(item => menuKeyOf(item.path, item.meta) === activeMenuKey);

    if (index === -1) {
      return;
    }

    const next = matchedMenuItems[(index + offset + length) % length]!;
    setActiveMenuKey(menuKeyOf(next.path, next.meta));
  }

  const navigate = useMenuNavigate();
  useHotkeys("esc", () => setIsSearchVisible(false), { enableOnFormTags: true });
  useHotkeys("enter", () => {
    if (!activeMenuKey) {
      return;
    }

    const menu = matchedMenuItems.find(item => menuKeyOf(item.path, item.meta) === activeMenuKey);

    if (menu) {
      setIsSearchVisible(false);
      navigate(menu);
    }
  }, { enableOnFormTags: true });
  useHotkeys("up", () => handleMenuSelect(-1), { enableOnFormTags: true });
  useHotkeys("down", () => handleMenuSelect(1), { enableOnFormTags: true });

  useEffect(() => {
    if (matchedMenuItems.length === 0) {
      return;
    }

    const first = matchedMenuItems[0]!;

    setActiveMenuKey(menuKeyOf(first.path, first.meta));
  }, [matchedMenuItems]);

  return (
    <div css={resultStyle}>
      <AnimatePresence>
        {matchedMenuItems.map((item, index) => {
          const itemKey = menuKeyOf(item.path, item.meta);

          return (
            <motion.div
              key={itemKey}
              layout
              animate={{ opacity: 1, y: 0 }}
              initial={{ opacity: 0, y: 20 }}
              transition={{
                duration: 0.3,
                delay: index * 0.05,
                ease: "easeOut"
              }}
            >
              <SearchResultItem
                active={activeMenuKey === itemKey}
                icon={item.icon === null ? undefined : item.icon}
                label={item.name}
                onClick={() => {
                  if (activeMenuKey !== itemKey) {
                    setActiveMenuKey(itemKey);
                    return;
                  }

                  setIsSearchVisible(false);
                  navigate(item);
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {matchedMenuItems.length === 0 && (
          <motion.div
            key="empty-state"
            animate={{ opacity: 1, scale: 1 }}
            initial={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <Empty
              description={
                keyword
                  ? `没有找到与"${keyword}"相关的菜单`
                  : "请输入关键字搜索"
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function match(menuItem: MenuItem, keyword: string) {
  if (!keyword) {
    return false;
  }

  const {
    name,
    namePinyin,
    namePinyinInitials
  } = menuItem;

  return name.includes(keyword) || namePinyin.includes(keyword) || namePinyinInitials.includes(keyword);
}

function buildMenuItems(menus: readonly UserMenu[]): MenuItem[] {
  return menus.map(menu => {
    const { name } = menu;

    return {
      ...menu,
      namePinyin: getPinyin(name).join(""),
      namePinyinInitials: getPinyinInitials(name).join("")
    };
  });
}
