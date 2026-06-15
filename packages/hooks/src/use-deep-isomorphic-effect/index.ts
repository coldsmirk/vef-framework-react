import type { DependencyList, EffectCallback } from "react";

import { useIsomorphicEffect } from "../lib";
import { useDeepCompare } from "../use-deep-compare";

/**
 * Runs an isomorphic effect with deep comparison of dependencies.
 * Uses `useLayoutEffect` on the client and `useEffect` on the server.
 * Unlike `useIsomorphicEffect`, this performs deep equality checks on dependency values,
 * preventing unnecessary effect execution when objects/arrays have the same content.
 *
 * @param effect - The effect callback to execute.
 * @param dependencies - The dependency array to deeply compare for changes.
 */
export function useDeepIsomorphicEffect(effect: EffectCallback, dependencies?: DependencyList): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useIsomorphicEffect(effect, useDeepCompare(dependencies));
}
