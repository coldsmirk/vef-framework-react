import type { DataOptionWithPinyin } from "@vef-framework-react/core";
import type { UseDataOptionsQueryOptions } from "@vef-framework-react/hooks";
import type { Key } from "@vef-framework-react/shared";

import type { TreeSelectProps } from "..";
import type { GetProp } from "../../_base";

import { useDataOptionsQuery } from "@vef-framework-react/hooks";
import { isString } from "@vef-framework-react/shared";
import { useEffect, useEffectEvent, useMemo } from "react";

import { Loader } from "../../loader";

export type UseDataOptionsTreeSelectOptions<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = never
> = UseDataOptionsQueryOptions<TQueryFnData, TData, TParams> & {
  /**
   * Whether the tree select is filterable
   *
   * @default false
   */
  filterable?: boolean;
  /**
   * Callback function invoked after data is fetched
   */
  onFetch?: (data: TData[]) => void;
};

const fieldNames: GetProp<TreeSelectProps, "fieldNames"> = {
  label: "label",
  value: "value",
  children: "children"
};

/**
 * The height of the tree select dropdown list.
 */
const listHeight = 280;
/**
 * The loading placeholder of the tree select.
 */
const loadingPlaceholder = (
  <div css={{ height: listHeight / 2 }}>
    <Loader />
  </div>
);

export function useDataOptionsTreeSelect<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = never
>({
  filterable = false,
  onFetch,
  ...queryOptions
}: UseDataOptionsTreeSelectOptions<TQueryFnData, TData, TParams>) {
  const {
    options,
    isFetching,
    promise
  } = useDataOptionsQuery({
    ...queryOptions,
    withPinyin: true
  });

  const treeSelectProps = useMemo<TreeSelectProps<Key, DataOptionWithPinyin<TData>>>(() => {
    return {
      treeData: options,
      loading: isFetching,
      fieldNames,
      maxTagCount: "responsive",
      listHeight,
      notFoundContent: isFetching ? loadingPlaceholder : undefined,
      filterTreeNode: filterable && filterTreeNode,
      treeNodeFilterProp: "labelPinyinInitials",
      treeNodeLabelProp: "label",
      showSearch: filterable,
      treeLine: {
        showLeafIcon: false
      }
    };
  }, [isFetching, options, filterable]);

  const onFetchFn = useEffectEvent((data: TData[]) => {
    onFetch?.(data);
  });

  useEffect(() => {
    promise.then(onFetchFn);
  }, [promise]);

  return treeSelectProps;
}

function filterTreeNode(input: string, node: Parameters<Exclude<GetProp<TreeSelectProps, "filterTreeNode">, boolean>>[1]) {
  const label = Reflect.get(node, "label");
  const labelPinyin = Reflect.get(node, "labelPinyin");
  const labelPinyinInitials = Reflect.get(node, "labelPinyinInitials");
  const description = Reflect.get(node, "description");
  const descriptionPinyin = Reflect.get(node, "descriptionPinyin");
  const descriptionPinyinInitials = Reflect.get(node, "descriptionPinyinInitials");

  return (isString(label) && label.includes(input))
    || (isString(labelPinyin) && labelPinyin.includes(input))
    || (isString(labelPinyinInitials) && labelPinyinInitials.includes(input))
    || (isString(description) && description.includes(input))
    || (isString(descriptionPinyin) && descriptionPinyin.includes(input))
    || (isString(descriptionPinyinInitials) && descriptionPinyinInitials.includes(input));
}
