import type { DataOptionWithPinyin } from "@vef-framework-react/core";
import type { UseDataOptionsQueryOptions } from "@vef-framework-react/hooks";
import type { Key } from "@vef-framework-react/shared";

import type { SelectProps } from "..";
import type { GetProp } from "../../_base";

import { useDataOptionsQuery } from "@vef-framework-react/hooks";
import { useEffect, useEffectEvent, useMemo } from "react";

import { Loader } from "../../loader";

export type UseDataOptionsSelectOptions<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = unknown
> = UseDataOptionsQueryOptions<TQueryFnData, TData, TParams> & {
  /**
   * Whether the select is filterable
   *
   * @default false
   */
  filterable?: boolean;
  /**
   * Callback function invoked after data is fetched
   */
  onFetch?: (data: TData[]) => void;
};

const fieldNames: GetProp<SelectProps, "fieldNames"> = {
  label: "label",
  value: "value",
  options: "children",
  groupLabel: "label"
};

/**
 * The height of the select options list.
 */
const listHeight = 280;
/**
 * The loading placeholder of the select.
 */
const loadingPlaceholder = (
  <div css={{ height: listHeight / 2 }}>
    <Loader />
  </div>
);

export function useDataOptionsSelect<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = never
>({
  filterable = false,
  onFetch,
  ...queryOptions
}: UseDataOptionsSelectOptions<TQueryFnData, TData, TParams>) {
  const {
    options,
    isFetching,
    promise
  } = useDataOptionsQuery({
    ...queryOptions,
    withPinyin: true
  });

  const selectProps = useMemo<SelectProps<Key, DataOptionWithPinyin<TData>>>(() => {
    return {
      options,
      loading: isFetching,
      fieldNames,
      maxTagCount: "responsive",
      listHeight,
      notFoundContent: isFetching ? loadingPlaceholder : undefined,
      showSearch: filterable,
      filterOption: filterable && filterOption
    };
  }, [isFetching, options, filterable]);

  const onFetchFn = useEffectEvent((data: TData[]) => {
    onFetch?.(data);
  });

  useEffect(() => {
    promise.then(onFetchFn);
  }, [promise]);

  return selectProps;
}

function filterOption<TData>(input: string, option?: DataOptionWithPinyin<TData>) {
  if (!option) {
    return false;
  }

  const {
    label,
    labelPinyin,
    labelPinyinInitials,
    description,
    descriptionPinyin,
    descriptionPinyinInitials
  } = option;
  return (
    label.includes(input)
    || labelPinyin.includes(input)
    || labelPinyinInitials.includes(input)
    || description?.includes(input)
    || descriptionPinyin?.includes(input)
    || descriptionPinyinInitials?.includes(input)
  ) ?? false;
}
