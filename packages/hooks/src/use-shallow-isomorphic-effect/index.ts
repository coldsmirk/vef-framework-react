import type { DependencyList, EffectCallback } from "react";

import { useIsomorphicEffect } from "../lib";
import { useShallowCompare } from "../use-shallow-compare";

/**
 * Runs an isomorphic effect with shallow comparison of dependencies.
 *
 * Similar to useIsomorphicEffect (useLayoutEffect on client, useEffect on server),
 * but uses shallow equality comparison for the dependency array instead of reference
 * equality. This is useful when your dependencies are objects or arrays that may
 * have the same content but different references.
 *
 * @param effect - The effect function to run.
 * @param dependencies - Dependency array to compare shallowly.
 */
export function useShallowIsomorphicEffect(effect: EffectCallback, dependencies?: DependencyList): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useIsomorphicEffect(effect, useShallowCompare(dependencies));
}
