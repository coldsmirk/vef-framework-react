import type { DataOption, UseQueryResult } from "@vef-framework-react/core";

import { skipQueryToken, useAppContext, useQuery } from "@vef-framework-react/core";
import { isFunction, isString } from "@vef-framework-react/shared";
import { useCallback, useMemo } from "react";

/**
 * Extension registry for hooks package types.
 *
 * Augment via `declare module "@vef-framework-react/hooks"` to constrain
 * dictionary keys to a known union; future hook-level extensions should be
 * added as members of this registry.
 *
 * @example
 * declare module "@vef-framework-react/hooks" {
 *   interface Register {
 *     dictionaryKeys: "sys.menu.type" | "sys.user.gender";
 *   }
 * }
 */
export interface Register {}

/**
 * Valid dictionary keys for this project. Resolves to the `dictionaryKeys`
 * member augmented onto `Register`, or `string` when not augmented.
 */
export type DictionaryKey = Register extends { dictionaryKeys: infer K extends string }
  ? K
  : string;

/**
 * Per-key configuration with dict key and optional overrides.
 */
export interface DictionaryKeyConfig {
  key: DictionaryKey;
  filterable?: boolean;
}

/**
 * Value can be a plain dict key string or a config object.
 */
export type DictionaryKeyValue = DictionaryKey | DictionaryKeyConfig;

/**
 * Alias map that rejects array inputs.
 */
export interface DictionaryAliasMap {
  readonly [alias: string]: DictionaryKeyValue;
  readonly [index: number]: never;
}

/**
 * Extract the actual dict key from a string or config value.
 */
export function resolveDictKey(value: DictionaryKeyValue): string {
  return isString(value) ? value : value.key;
}

export type DictionaryQueryData<T extends DictionaryAliasMap> = Record<Extract<keyof T, string>, DataOption[]>;

/**
 * Options for `useDictionaryQuery`.
 */
export interface UseDictionaryQueryOptions<T extends DictionaryAliasMap, TData = DictionaryQueryData<T>> {
  /**
   * Whether the query is enabled. Pass `false` to defer fetching, e.g.,
   * while upstream parameters are not yet ready.
   *
   * @default true
   */
  enabled?: boolean;
  /**
   * Transform the resolved dictionary map into a custom shape.
   * Runs after alias resolution; its return value becomes `data`.
   *
   * The function is passed through to React Query's `select`, so its identity
   * affects memoization: stabilize it with `useCallback` in the caller when
   * the enclosing component re-renders frequently.
   */
  select?: (data: DictionaryQueryData<T>) => TData;
}

/**
 * Query data dictionaries and map them back to alias keys.
 * Uses the `dictionaryQueryFn` from app context.
 *
 * `data` follows React Query's native semantics: it is `undefined` until the
 * query resolves successfully, so callers must guard against `undefined`.
 *
 * Callers own the reference stability of `keys` and `options.select`: hold
 * them in module scope, `as const`, `useMemo`, or `useCallback` as needed to
 * avoid invalidating React Query's `select` memoization on every render.
 */
export function useDictionaryQuery<
  const T extends DictionaryAliasMap,
  TData = DictionaryQueryData<T>
>(
  keys: T,
  options?: UseDictionaryQueryOptions<NoInfer<T>, TData>
): UseQueryResult<TData> {
  const { dictionaryQueryFn } = useAppContext();

  if (!isFunction(dictionaryQueryFn)) {
    throw new Error("Dictionary query function is not provided in the app context.");
  }

  const { enabled, select: userSelect } = options ?? {};

  const sortedKeys = useMemo(
    () => [...new Set(Object.values(keys).map(value => resolveDictKey(value)))].toSorted(),
    [keys]
  );

  const select = useCallback(
    (rawData: Record<string, DataOption[]>): TData => {
      const mapped = Object.fromEntries(
        Object.entries(keys).map(([aliasKey, value]) => [aliasKey, rawData[resolveDictKey(value)] ?? []])
      ) as DictionaryQueryData<T>;

      return (userSelect ? userSelect(mapped) : mapped) as TData;
    },
    [keys, userSelect]
  );

  return useQuery({
    queryFn: sortedKeys.length === 0 ? skipQueryToken : dictionaryQueryFn,
    queryKey: [dictionaryQueryFn.key, sortedKeys],
    enabled,
    select,
    staleTime: Infinity
  });
}
