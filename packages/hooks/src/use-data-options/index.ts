import type { DataOption, DataOptionWithPinyin, UseQueryOptions, UseQueryResult } from "@vef-framework-react/core";
import type { EmptyObject, Except, Key, MaybeUndefined, Simplify } from "@vef-framework-react/shared";

import { useQuery } from "@vef-framework-react/core";
import { get, isEmpty, isFunction, isNullish, withPinyin as withPinyinInternal } from "@vef-framework-react/shared";
import { useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

/**
 * Field extractor - can be a string path (e.g., "user.name") or a function
 */
export type FieldExtractor<TData, TValue>
  = | string
    | ((item: TData) => TValue);

/**
 * Base field mapping options
 */
export interface DataOptionsFieldMapping<TData = unknown> {
  /**
   * Field mapping for label
   *
   * @default "label"
   */
  labelKey?: FieldExtractor<TData, string>;
  /**
   * Field mapping for value
   *
   * @default "value"
   */
  valueKey?: FieldExtractor<TData, Key>;
  /**
   * Field mapping for disabled
   *
   * @default "disabled"
   */
  disabledKey?: FieldExtractor<TData, MaybeUndefined<boolean>>;
  /**
   * Field mapping for description
   *
   * @default "description"
   */
  descriptionKey?: FieldExtractor<TData, MaybeUndefined<string>>;
  /**
   * Field mapping for children
   *
   * @default "children"
   */
  childrenKey?: FieldExtractor<TData, MaybeUndefined<TData[]>>;
}

/**
 * Options for useDataOptionsQuery
 */
export type UseDataOptionsQueryOptions<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = never
> = DataOptionsFieldMapping<TData> & {
  /**
   * Options for fetching data using regular query
   */
  queryOptions: UseQueryOptions<TQueryFnData[], TData[], TParams>;
};

/**
 * Return type for useDataOptionsQuery hook
 */
export type UseDataOptionsQueryResult<TData, TOption> = Simplify<
  Omit<UseQueryResult<TData[]>, "data"> & {
    options: TOption[];
  }
>;

// ============================================================================
// Utilities
// ============================================================================

/**
 * Extract field value from an object using a string path or function
 */
function extractField<TData, TValue>(
  item: TData,
  extractor: FieldExtractor<TData, TValue> | undefined,
  defaultKey: string
): TValue {
  if (!extractor) {
    return (item as Record<typeof defaultKey, TValue>)[defaultKey]!;
  }

  if (isFunction(extractor)) {
    return extractor(item);
  }

  return get<TValue>(item, extractor);
}

/**
 * Transform a single data item to DataOption
 */
function transformDataItem<TData = EmptyObject>(
  item: TData,
  options: Except<UseDataOptionsQueryOptions<unknown, TData>, "queryOptions">,
  withPinyin: false
): DataOption<TData>;

function transformDataItem<TData = EmptyObject>(
  item: TData,
  options: Except<UseDataOptionsQueryOptions<unknown, TData>, "queryOptions">,
  withPinyin: true
): DataOptionWithPinyin<TData>;

function transformDataItem<TData = EmptyObject>(
  item: TData,
  options: Except<UseDataOptionsQueryOptions<unknown, TData>, "queryOptions">,
  withPinyin: boolean
): DataOption<TData> | DataOptionWithPinyin<TData> {
  const {
    labelKey,
    valueKey,
    disabledKey,
    descriptionKey,
    childrenKey
  } = options;

  // Extract base fields
  const label = extractField(item, labelKey, "label");
  const value = extractField(item, valueKey, "value");
  const disabled = extractField(item, disabledKey, "disabled");
  const description = extractField(item, descriptionKey, "description");
  const children = extractField(item, childrenKey, "children");

  // Build base option
  const option: DataOption<TData> = {
    ...item,
    label,
    value,
    ...!isNullish(disabled) && { disabled },
    ...!isNullish(description) && { description }
  };

  const optionWithPinyin = withPinyin
    ? withPinyinInternal(
        option,
        "label",
        "description"
      )
    : option;

  // Recursively transform children
  if (Array.isArray(children) && children.length > 0) {
    optionWithPinyin.children = children.map(child => transformDataItem(child, options, withPinyin as false & true));
  }

  return optionWithPinyin;
}

/**
 * Transform data array to DataOption array
 */
function transformData<TData>(
  data: TData[] | undefined,
  options: Except<UseDataOptionsQueryOptions<unknown, TData>, "queryOptions">,
  withPinyin: false
): Array<DataOption<TData>>;

function transformData<TData>(
  data: TData[] | undefined,
  options: Except<UseDataOptionsQueryOptions<unknown, TData>, "queryOptions">,
  withPinyin: true
): Array<DataOptionWithPinyin<TData>>;

function transformData<TData>(
  data: TData[] | undefined,
  options: Except<UseDataOptionsQueryOptions<unknown, TData>, "queryOptions">,
  withPinyin: boolean
): Array<DataOption<TData>> | Array<DataOptionWithPinyin<TData>> {
  if (!data || isEmpty(data)) {
    return [];
  }

  return data.map(item => transformDataItem(item, options, withPinyin as false & true));
}

// ============================================================================
// Hook
// ============================================================================

export function useDataOptionsQuery<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = never
>(config: UseDataOptionsQueryOptions<TQueryFnData, TData, TParams>): UseDataOptionsQueryResult<TData, DataOption<TData>>;

export function useDataOptionsQuery<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = never
>(options: UseDataOptionsQueryOptions<TQueryFnData, TData, TParams> & {
  /**
   * Whether to add pinyin fields for label and description
   *
   * @default false
   */
  withPinyin: boolean;
}): UseDataOptionsQueryResult<TData, DataOptionWithPinyin<TData>>;

/**
 * Hook to fetch and transform data into normalized options with optional pinyin support.
 */
export function useDataOptionsQuery<
  TQueryFnData = unknown,
  TData = TQueryFnData,
  TParams = never
>(
  {
    queryOptions,
    labelKey,
    valueKey,
    disabledKey,
    descriptionKey,
    childrenKey,
    withPinyin = false
  }: UseDataOptionsQueryOptions<TQueryFnData, TData, TParams> & {
    /**
     * Whether to add pinyin fields for label and description
     *
     * @default false
     */
    withPinyin?: boolean;
  }
): UseDataOptionsQueryResult<TData, DataOption<TData> | DataOptionWithPinyin<TData>> {
  const { data, ...result } = useQuery(queryOptions);

  // Transform data - memoize to prevent unnecessary recalculations
  const fieldMappingOptions = useMemo(
    () => {
      return {
        labelKey,
        valueKey,
        disabledKey,
        descriptionKey,
        childrenKey
      };
    },
    [labelKey, valueKey, disabledKey, descriptionKey, childrenKey]
  );

  const options = useMemo(
    () => transformData(data, fieldMappingOptions, withPinyin as false & true),
    [data, fieldMappingOptions, withPinyin]
  );

  return { options, ...result };
}
