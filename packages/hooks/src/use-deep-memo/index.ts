import type { DependencyList } from "react";

import { useMemo } from "react";

import { useDeepCompare } from "../use-deep-compare";

/**
 * Memoizes a computed value with deep comparison of dependencies.
 * Unlike `useMemo`, this performs deep equality checks on dependency values,
 * preventing unnecessary recomputation when objects/arrays have the same content.
 *
 * @param factory - The factory function that computes the memoized value.
 * @param dependencies - The dependency array to deeply compare for changes.
 * @returns The memoized value that only recomputes when dependencies are deeply different.
 */
export function useDeepMemo<T>(factory: () => T, dependencies: DependencyList): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  return useMemo(factory, useDeepCompare(dependencies));
}
