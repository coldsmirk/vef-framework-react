import type { DataOption, UseQueryResult } from "@vef-framework-react/core";

import { skipQueryToken, useAppContext, useQuery } from "@vef-framework-react/core";
import { isFunction, isString } from "@vef-framework-react/shared";
import { useCallback, useMemo } from "react";

/**
 * Extension registry for hooks package types.
 *
 * Augment via `declare module "@vef-framework-react/hooks"` to constrain
 * code set keys to a known union; future hook-level extensions should be
 * added as members of this registry.
 *
 * @example
 * declare module "@vef-framework-react/hooks" {
 *   interface Register {
 *     codeSetKeys: "sys.menu.type" | "sys.user.gender";
 *   }
 * }
 */
export interface Register {}

/**
 * Valid code set keys for this project. Resolves to the `codeSetKeys`
 * member augmented onto `Register`, or `string` when not augmented.
 */
export type CodeSetKey = Register extends { codeSetKeys: infer K extends string }
  ? K
  : string;

/**
 * Per-key configuration with code set key and optional overrides.
 */
export interface CodeSetKeyConfig {
  key: CodeSetKey;
  filterable?: boolean;
}

/**
 * Value can be a plain code set key string or a config object.
 */
export type CodeSetKeyValue = CodeSetKey | CodeSetKeyConfig;

/**
 * Alias map that rejects array inputs.
 */
export interface CodeSetAliasMap {
  readonly [alias: string]: CodeSetKeyValue;
  readonly [index: number]: never;
}

/**
 * Extract the actual code set key from a string or config value.
 */
export function resolveCodeSetKey(value: CodeSetKeyValue): string {
  return isString(value) ? value : value.key;
}

export type CodeSetQueryData<T extends CodeSetAliasMap> = Record<Extract<keyof T, string>, DataOption[]>;

/**
 * Options for `useCodeSetQuery`.
 */
export interface UseCodeSetQueryOptions<T extends CodeSetAliasMap, TData = CodeSetQueryData<T>> {
  /**
   * Whether the query is enabled. Pass `false` to defer fetching, e.g.,
   * while upstream parameters are not yet ready.
   *
   * @default true
   */
  enabled?: boolean;
  /**
   * Transform the resolved code set map into a custom shape.
   * Runs after alias resolution; its return value becomes `data`.
   *
   * The function is passed through to React Query's `select`, so its identity
   * affects memoization: stabilize it with `useCallback` in the caller when
   * the enclosing component re-renders frequently.
   */
  select?: (data: CodeSetQueryData<T>) => TData;
}

/**
 * Query host code sets and map them back to alias keys.
 * Uses the `codeSetQueryFn` from app context.
 *
 * `data` follows React Query's native semantics: it is `undefined` until the
 * query resolves successfully, so callers must guard against `undefined`.
 *
 * Callers own the reference stability of `keys` and `options.select`: hold
 * them in module scope, `as const`, `useMemo`, or `useCallback` as needed to
 * avoid invalidating React Query's `select` memoization on every render.
 */
export function useCodeSetQuery<
  const T extends CodeSetAliasMap,
  TData = CodeSetQueryData<T>
>(
  keys: T,
  options?: UseCodeSetQueryOptions<NoInfer<T>, TData>
): UseQueryResult<TData> {
  const { codeSetQueryFn } = useAppContext();

  if (!isFunction(codeSetQueryFn)) {
    throw new Error("Code set query function is not provided in the app context.");
  }

  const { enabled, select: userSelect } = options ?? {};

  const sortedKeys = useMemo(
    () => [...new Set(Object.values(keys).map(value => resolveCodeSetKey(value)))].toSorted(),
    [keys]
  );

  const select = useCallback(
    (rawData: Record<string, DataOption[]>): TData => {
      const mapped = Object.fromEntries(
        Object.entries(keys).map(([aliasKey, value]) => [aliasKey, rawData[resolveCodeSetKey(value)] ?? []])
      ) as CodeSetQueryData<T>;

      return (userSelect ? userSelect(mapped) : mapped) as TData;
    },
    [keys, userSelect]
  );

  return useQuery({
    queryFn: sortedKeys.length === 0 ? skipQueryToken : codeSetQueryFn,
    queryKey: [codeSetQueryFn.key, sortedKeys],
    enabled,
    select,
    staleTime: Infinity
  });
}
