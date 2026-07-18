import type { DataOption, DataOptionWithPinyin } from "@vef-framework-react/core";
import type { CodeSetAliasMap } from "@vef-framework-react/hooks";
import type { Key } from "@vef-framework-react/shared";

import type { SelectProps } from "..";
import type { GetProp } from "../../_base";

import { useCodeSetQuery } from "@vef-framework-react/hooks";
import { isArray, withPinyin } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { Loader } from "../../loader";

export interface UseCodeSetOptionsSelectOptions {
  /**
   * Whether each select should enable search.
   *
   * @default false
   */
  filterable?: boolean;
}

export type UseCodeSetOptionsSelectResult<T extends CodeSetAliasMap> = Record<Extract<keyof T, string>, SelectProps<Key, DataOptionWithPinyin<DataOption>>>;

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

export function useCodeSetOptionsSelect<const T extends CodeSetAliasMap>(
  keys: T,
  options?: UseCodeSetOptionsSelectOptions
): UseCodeSetOptionsSelectResult<T> {
  const { filterable = false } = options ?? {};

  const {
    data,
    isFetching
  } = useCodeSetQuery(keys);

  return useMemo(
    () => Object.fromEntries(
      Object.entries(keys).map(([aliasKey, value]) => {
        const keyFilterable = typeof value === "string"
          ? filterable
          : value.filterable ?? filterable;

        return [
          aliasKey,
          {
            options: transformOptions(data?.[aliasKey as keyof typeof data] ?? []),
            loading: isFetching,
            fieldNames,
            maxTagCount: "responsive",
            listHeight,
            notFoundContent: isFetching ? loadingPlaceholder : undefined,
            showSearch: keyFilterable,
            filterOption: keyFilterable && filterOption
          }
        ];
      })
    ) as UseCodeSetOptionsSelectResult<T>,
    [data, keys, isFetching, filterable]
  );
}

function transformOptions(options: DataOption[]) {
  return options.map(option => transformOption(option));
}

function transformOption(option: DataOption): DataOptionWithPinyin<DataOption> {
  const { children, ...optionWithoutChildren } = option;
  const transformedChildren = Array.isArray(children) && children.length > 0
    ? children.map(child => transformOption(child))
    : undefined;

  const optionWithChildren: typeof optionWithoutChildren & {
    children?: Array<DataOptionWithPinyin<DataOption>>;
  } = {
    ...optionWithoutChildren,
    ...isArray(transformedChildren) && { children: transformedChildren }
  };

  return withPinyin(
    optionWithChildren,
    "label",
    "description"
  );
}

function filterOption(input: string, option?: DataOptionWithPinyin<DataOption>) {
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
