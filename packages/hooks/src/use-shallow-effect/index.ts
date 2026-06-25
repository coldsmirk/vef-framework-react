import type { DependencyList, EffectCallback } from "react";

import { useEffect } from "react";

import { useShallowCompare } from "../use-shallow-compare";

/**
 * Runs an effect with shallow comparison of dependencies.
 *
 * Similar to React's useEffect, but uses shallow equality comparison for the
 * dependency array instead of reference equality. This is useful when your
 * dependencies are objects or arrays that may have the same content but
 * different references.
 *
 * @param effect - The effect function to run.
 * @param dependencies - Dependency array to compare shallowly.
 */
export function useShallowEffect(effect: EffectCallback, dependencies?: DependencyList): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps -- shallow-equality hook compares dep values, not references
  useEffect(effect, useShallowCompare(dependencies));
}
