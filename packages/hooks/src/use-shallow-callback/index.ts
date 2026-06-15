import type { DependencyList } from "react";

import { useCallback } from "react";

import { useShallowCompare } from "../use-shallow-compare";

/**
 * Memoizes a callback function with shallow comparison of dependencies.
 *
 * Similar to React's useCallback, but uses shallow equality comparison for the
 * dependency array instead of reference equality. This is useful when your
 * dependencies are objects or arrays that may have the same content but
 * different references.
 *
 * @param callback - The callback function to memoize.
 * @param dependencies - Dependency array to compare shallowly.
 * @returns The memoized callback function.
 */
export function useShallowCallback<T extends (...args: any[]) => any>(
  callback: T,
  dependencies: DependencyList
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  return useCallback(callback, useShallowCompare(dependencies)) as T;
}
