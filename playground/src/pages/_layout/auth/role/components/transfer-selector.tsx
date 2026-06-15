import type { GetProp, TreeProps } from "@vef-framework-react/components";
import type { DataOption, DataOptionWithPinyin, QueryFunction } from "@vef-framework-react/core";
import type { CSSProperties, Key } from "react";
import type { DataScopeTarget } from "~apis";

import { SearchOutlined } from "@ant-design/icons";
import { Input, Loader, Stack, Transfer, Tree, TreeSelect, useDataOptionsTree, useDataOptionsTreeSelect, useThemeTokens } from "@vef-framework-react/components";
import { flattenTree, mapTree } from "@vef-framework-react/shared";
import { memo, useCallback, useMemo, useState } from "react";
import { findOrganizationTreeOptions } from "~apis";

import classes from "../styles/index.module.scss";

interface TreePanelProps {
  treeProps: ReturnType<typeof useDataOptionsTree>["treeProps"];
  treeDataWithDisabled: DataOptionWithPinyin[];
  checkedKeys: Key[];
  treeHeight: number;
  onItemSelect: (key: Key, checked: boolean) => void;
}

const TreePanel = memo(({
  treeProps,
  treeDataWithDisabled,
  checkedKeys,
  treeHeight,
  onItemSelect
}: TreePanelProps) => {
  const handleCheck = useCallback<GetProp<TreeProps<DataOptionWithPinyin>, "onCheck">>((_, { node: { value } }) => {
    onItemSelect(value, !checkedKeys.includes(value));
  }, [onItemSelect, checkedKeys]);

  const handleSelect = useCallback<GetProp<TreeProps<DataOptionWithPinyin>, "onSelect">>((_, { node: { value } }) => {
    onItemSelect(value, !checkedKeys.includes(value));
  }, [onItemSelect, checkedKeys]);

  return (
    <Tree
      {...treeProps}
      blockNode
      checkable
      checkStrictly
      defaultExpandAll
      checkedKeys={checkedKeys}
      height={treeHeight}
      treeData={treeDataWithDisabled}
      onCheck={handleCheck}
      onSelect={handleSelect}
    />
  );
});
TreePanel.displayName = "TreePanel";

export interface TransferSelectorProps {
  type: "O" | "D";
  value: DataScopeTarget[];
  onChange: (value: DataScopeTarget[]) => void;
  queryFn: QueryFunction<DataOption[], never>;
  title: [string, string];
  placeholder?: string;
  showOrgSelect?: boolean;
}

function renderItem(option: DataOption) {
  return option.label;
}

function getRowKey(option: DataOption) {
  return option.value;
}

export const TransferSelector = memo(({
  type,
  value,
  onChange,
  queryFn,
  title,
  placeholder = "关键词",
  showOrgSelect = false
}: TransferSelectorProps) => {
  const [orgId, setOrgId] = useState<string>();
  const { sizeSM, controlHeight } = useThemeTokens();

  const orgTreeSelectProps = useDataOptionsTreeSelect({
    filterable: true,
    queryOptions: {
      queryKey: [findOrganizationTreeOptions.key],
      queryFn: findOrganizationTreeOptions,
      enabled: showOrgSelect
    }
  });

  const {
    treeProps,
    isFetching,
    searchValue,
    setSearchValue
  } = useDataOptionsTree({
    queryOptions: {
      queryKey: [queryFn.key, { orgId }],
      queryFn: queryFn as never,
      enabled: showOrgSelect ? Boolean(orgId) : true
    }
  });

  const transferData = useMemo(() => flattenTree(treeProps.treeData ?? []), [treeProps.treeData]);
  const targetKeys = useMemo(() => value.map(target => target.id), [value]);

  const treeDataWithDisabled = useMemo(() => mapTree(
    treeProps.treeData ?? [],
    node => { return { ...node, disabled: targetKeys.includes(node.value) }; }
  ), [treeProps.treeData, targetKeys]);

  const handleTransferChange = useCallback((keys: Key[]) => {
    onChange(
      keys
        .filter((key): key is string => typeof key === "string")
        .map(key => { return { type, id: key }; })
    );
  }, [onChange, type]);

  const handleOrgChange = useCallback((value: string) => {
    setOrgId(value);
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.currentTarget.value);
  }, [setSearchValue]);

  const treeHeight = showOrgSelect ? (280 - sizeSM - controlHeight) : 280;

  const treeWrapperStyle = useMemo<CSSProperties>(() => {
    return {
      height: treeHeight
    };
  }, [treeHeight]);

  return (
    <div className={classes.transferWrapper}>
      <Transfer
        dataSource={transferData}
        render={renderItem}
        rowKey={getRowKey}
        showSelectAll={false}
        targetKeys={targetKeys}
        titles={title}
        onChange={handleTransferChange}
      >
        {({
          direction,
          onItemSelect,
          selectedKeys
        }) => {
          if (direction !== "left") {
            return null;
          }

          const checkedKeys = [...selectedKeys, ...targetKeys];

          return (
            <Stack className={classes.treeWrapper} gap="var(--vef-spacing-sm)">
              {showOrgSelect && (
                <TreeSelect
                  {...orgTreeSelectProps}
                  placeholder="请选择机构"
                  value={orgId}
                  onChange={handleOrgChange}
                />
              )}

              <Input
                key="source"
                placeholder={placeholder}
                suffix={<SearchOutlined className="input-suffix-icon" />}
                value={searchValue}
                onChange={handleSearchChange}
              />

              <div style={treeWrapperStyle}>
                {isFetching
                  ? <Loader />
                  : (
                      <TreePanel
                        checkedKeys={checkedKeys}
                        treeDataWithDisabled={treeDataWithDisabled}
                        treeHeight={treeHeight}
                        treeProps={treeProps}
                        onItemSelect={onItemSelect}
                      />
                    )}
              </div>
            </Stack>
          );
        }}
      </Transfer>
    </div>
  );
});
TransferSelector.displayName = "TransferSelector";
