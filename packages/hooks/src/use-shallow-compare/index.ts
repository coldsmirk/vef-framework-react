import type { DependencyList } from "react";

import { isShallowEqual } from "@vef-framework-react/shared";
import { useRef } from "react";

/**
 * Performs shallow comparison of dependency arrays for React hooks.
 * Returns a stable reference that only changes when dependencies are not shallowly equal.
 *
 * This is useful for optimizing hooks like useEffect, useMemo, and useCallback
 * when you want to compare object/array dependencies by their shallow content
 * rather than by reference identity.
 *
 * @param dependencies - The dependency array to compare.
 * @returns A tuple containing a signal number that increments when dependencies change.
 */
export function useShallowCompare(dependencies?: DependencyList): readonly [number] {
  const previousRef = useRef<DependencyList>(undefined);
  const signalRef = useRef(0);

  if (!areShallowEqual(previousRef.current, dependencies)) {
    previousRef.current = dependencies;
    signalRef.current += 1;
  }

  return [signalRef.current];
}

function areShallowEqual(previous?: DependencyList, current?: DependencyList): boolean {
  // When dependencies are undefined, always return false to trigger effect on every render
  // This mimics React's behavior when no dependency array is provided
  if (previous === undefined || current === undefined) {
    return false;
  }

  if (previous === current) {
    return true;
  }

  if (previous.length !== current.length) {
    return false;
  }

  for (const [index, element] of previous.entries()) {
    if (!isShallowEqual(element, current[index])) {
      return false;
    }
  }

  return true;
}
