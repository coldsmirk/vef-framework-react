import type { DependencyList, EffectCallback } from "react";

import { useLayoutEffect } from "react";

import { useDeepCompare } from "../use-deep-compare";

/**
 * Runs a layout effect with deep comparison of dependencies.
 * Unlike `useLayoutEffect`, this performs deep equality checks on dependency values,
 * preventing unnecessary effect execution when objects/arrays have the same content.
 *
 * @param effect - The effect callback to execute synchronously after DOM mutations.
 * @param dependencies - The dependency array to deeply compare for changes.
 */
export function useDeepLayoutEffect(effect: EffectCallback, dependencies?: DependencyList): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  useLayoutEffect(effect, useDeepCompare(dependencies));
}
