import type { DataOptionWithPinyin } from "@vef-framework-react/core";
import type { UseDataOptionsQueryOptions } from "@vef-framework-react/hooks";

import type { TreeProps } from "..";
import type { GetProp } from "../../_base";

import { useDataOptionsQuery } from "@vef-framework-react/hooks";
import { filterTreeWithAncestors, isString } from "@vef-framework-react/shared";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

export type UseDataOptionsTreeOptions<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = never
> = UseDataOptionsQueryOptions<TQueryFnData, TData, TParams> & {
  /**
   * Callback function invoked after data is fetched successfully
   */
  onFetch?: (data: TData[]) => void;
};

const fieldNames: GetProp<TreeProps, "fieldNames"> = {
  title: "label",
  key: "value",
  children: "children"
};

export function useDataOptionsTree<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = never
>({
  onFetch,
  ...queryOptions
}: UseDataOptionsTreeOptions<TQueryFnData, TData, TParams>) {
  const {
    options,
    isFetching,
    promise
  } = useDataOptionsQuery({
    ...queryOptions,
    withPinyin: true
  });
  const [searchValue, setSearchValue] = useState("");

  const filterTreeNode = useMemo<TreeProps<DataOptionWithPinyin>["filterTreeNode"]>(() => {
    if (!searchValue) {
      return;
    }

    return node => {
      const {
        label,
        labelPinyin,
        labelPinyinInitials,
        description,
        descriptionPinyin,
        descriptionPinyinInitials
      } = node;

      return (isString(label) && label.includes(searchValue))
        || (isString(labelPinyin) && labelPinyin.includes(searchValue))
        || (isString(labelPinyinInitials) && labelPinyinInitials.includes(searchValue))
        || (isString(description) && description.includes(searchValue))
        || (isString(descriptionPinyin) && descriptionPinyin.includes(searchValue))
        || (isString(descriptionPinyinInitials) && descriptionPinyinInitials.includes(searchValue));
    };
  }, [searchValue]);

  const treeData = useMemo(() => {
    if (!filterTreeNode) {
      return options;
    }

    return filterTreeWithAncestors(options, node => filterTreeNode(node as never));
  }, [filterTreeNode, options]);

  const treeProps = useMemo<TreeProps<DataOptionWithPinyin>>(() => {
    return {
      treeData,
      fieldNames,
      showLine: { showLeafIcon: false },
      autoExpandParent: true,
      blockNode: true,
      filterTreeNode
    };
  }, [filterTreeNode, treeData]);

  const onFetchFn = useEffectEvent((data: TData[]) => {
    onFetch?.(data);
  });

  useEffect(() => {
    promise.then(onFetchFn);
  }, [promise]);

  return {
    treeProps,
    isFetching,
    searchValue,
    setSearchValue
  };
}
