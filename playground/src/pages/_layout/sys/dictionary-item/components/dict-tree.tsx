import type { ReactNode } from "react";

import { SearchOutlined } from "@ant-design/icons";
import { FlexCard, Input, Loader, Stack, Tree, useDataOptionsTree } from "@vef-framework-react/components";
import { useElementSize } from "@vef-framework-react/hooks";
import { memo } from "react";
import { findDictionaryTreeOptions } from "~apis";

import classes from "../styles/index.module.scss";

export interface SelectedDict {
  id: string;
  name: string;
}

interface DictTreeProps {
  value?: SelectedDict;
  onChange?: (value: SelectedDict) => void;
}

function DictTreeComponent({ value, onChange }: DictTreeProps): ReactNode {
  const {
    treeProps,
    isFetching,
    searchValue,
    setSearchValue
  } = useDataOptionsTree({
    queryOptions: {
      queryKey: [findDictionaryTreeOptions.key],
      queryFn: findDictionaryTreeOptions
    }
  });
  const { ref, height } = useElementSize();

  const title = `当前字典：${value?.name ?? "无"}`;

  function handleSearchChange(event: React.ChangeEvent<HTMLInputElement>): void {
    setSearchValue(event.currentTarget.value);
  }

  function handleTreeSelect(_: unknown, { selected, node }: { selected: boolean; node: { meta?: { type?: string }; value: string; label: string } }): void {
    if (selected && node.meta?.type === "T") {
      onChange?.({ id: node.value, name: node.label });
    }
  }

  return (
    <FlexCard
      className={classes.cardContainer}
      title={<span className={classes.cardTitle}>{title}</span>}
    >
      <Stack className={classes.cardBody} gap="medium">
        <Input
          placeholder="关键词"
          suffix={<SearchOutlined className="input-suffix-icon" />}
          value={searchValue}
          onChange={handleSearchChange}
        />

        <div ref={ref} className={classes.treeWrapper}>
          {isFetching
            ? <Loader size="large" />
            : (
                <Tree
                  {...treeProps}
                  height={height || innerHeight}
                  selectedKeys={value ? [value.id] : undefined}
                  onSelect={handleTreeSelect}
                />
              )}
        </div>
      </Stack>
    </FlexCard>
  );
}

export const DictTree = memo(DictTreeComponent);
