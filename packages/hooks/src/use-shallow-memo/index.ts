import type { DependencyList } from "react";

import { useMemo } from "react";

import { useShallowCompare } from "../use-shallow-compare";

/**
 * Memoizes a value with shallow comparison of dependencies.
 *
 * Similar to React's useMemo, but uses shallow equality comparison for the
 * dependency array instead of reference equality. This is useful when your
 * dependencies are objects or arrays that may have the same content but
 * different references.
 *
 * @param factory - Function that returns the value to memoize.
 * @param dependencies - Dependency array to compare shallowly.
 * @returns The memoized value.
 */
export function useShallowMemo<T>(factory: () => T, dependencies: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps -- shallow-equality hook compares dep values, not references
  return useMemo(factory, useShallowCompare(dependencies));
}
