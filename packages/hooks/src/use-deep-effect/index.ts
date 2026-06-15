import type { DependencyList, EffectCallback } from "react";

import { useEffect } from "react";

import { useDeepCompare } from "../use-deep-compare";

/**
 * Runs an effect with deep comparison of dependencies.
 * Unlike `useEffect`, this performs deep equality checks on dependency values,
 * preventing unnecessary effect execution when objects/arrays have the same content.
 *
 * @param effect - The effect callback to execute.
 * @param dependencies - The dependency array to deeply compare for changes.
 */
export function useDeepEffect(effect: EffectCallback, dependencies?: DependencyList): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  useEffect(effect, useDeepCompare(dependencies));
}
