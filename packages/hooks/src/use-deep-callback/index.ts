import type { DependencyList } from "react";

import { useCallback } from "react";

import { useDeepCompare } from "../use-deep-compare";

/**
 * Memoizes a callback function with deep comparison of dependencies.
 * Unlike `useCallback`, this performs deep equality checks on dependency values,
 * preventing unnecessary callback recreation when objects/arrays have the same content.
 *
 * @param callback - The callback function to memoize.
 * @param dependencies - The dependency array to deeply compare for changes.
 * @returns The memoized callback that only changes when dependencies are deeply different.
 */
export function useDeepCallback<T extends (...args: any[]) => any>(
  callback: T,
  dependencies: DependencyList
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  return useCallback(callback, useDeepCompare(dependencies)) as T;
}
