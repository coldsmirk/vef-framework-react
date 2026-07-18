import type { ReactNode } from "react";

import { FlexCard, Menu } from "@vef-framework-react/components";
import { useShallow } from "@vef-framework-react/core";
import { useCodeSetQuery } from "@vef-framework-react/hooks";
import { Loader } from "lucide-react";
import { useEffect, useMemo } from "react";

import { useConfigPageStore } from "../store";
import classes from "../styles/index.module.scss";

export function Aside(): ReactNode {
  const { selectedCategory, setSelectedCategory } = useConfigPageStore(
    useShallow(state => {
      return {
        selectedCategory: state.selectedCategory,
        setSelectedCategory: state.setSelectedCategory
      };
    })
  );

  const { data, isFetching } = useCodeSetQuery({
    category: "sys.config_definition.category"
  } as const);

  const menuItems = useMemo(
    () => data?.category.map(item => { return { key: item.value, label: item.label }; }) ?? [],
    [data]
  );

  useEffect(() => {
    if (menuItems.length > 0) {
      setSelectedCategory(menuItems[0]!.key);
    }
  }, [menuItems, setSelectedCategory]);

  const selectedKeys = selectedCategory ? [selectedCategory] : [];

  return (
    <FlexCard className={classes.asideCard} title="配置分类">
      {isFetching
        ? <Loader />
        : (
            <Menu
              className={classes.menu}
              items={menuItems}
              mode="inline"
              multiple={false}
              selectedKeys={selectedKeys}
              onSelect={({ key }) => setSelectedCategory(key)}
            />
          )}
    </FlexCard>
  );
}
