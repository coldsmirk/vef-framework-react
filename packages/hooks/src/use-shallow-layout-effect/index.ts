import type { DependencyList, EffectCallback } from "react";

import { useLayoutEffect } from "react";

import { useShallowCompare } from "../use-shallow-compare";

/**
 * Runs a layout effect with shallow comparison of dependencies.
 *
 * Similar to React's useLayoutEffect, but uses shallow equality comparison for the
 * dependency array instead of reference equality. This is useful when your
 * dependencies are objects or arrays that may have the same content but
 * different references.
 *
 * @param effect - The effect function to run synchronously after DOM mutations.
 * @param dependencies - Dependency array to compare shallowly.
 */
export function useShallowLayoutEffect(effect: EffectCallback, dependencies?: DependencyList): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps, @eslint-react/exhaustive-deps
  useLayoutEffect(effect, useShallowCompare(dependencies));
}
