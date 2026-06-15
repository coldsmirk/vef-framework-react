import type { DependencyList } from "react";

import { isDeepEqual } from "@vef-framework-react/shared";
import { useRef } from "react";

/**
 * Performs deep comparison of dependency arrays to detect changes.
 * Unlike React's default shallow comparison, this compares nested objects and arrays by value.
 *
 * @param dependencies - The dependency array to track for deep changes.
 * @returns A memoized array containing a signal value that changes only when dependencies are deeply different.
 */
export function useDeepCompare(dependencies?: DependencyList): readonly [number] {
  const previousRef = useRef<DependencyList>(undefined);
  const signalRef = useRef<number>(0);

  if (!areDependenciesEqual(previousRef.current, dependencies)) {
    previousRef.current = dependencies;
    signalRef.current += 1;
  }

  return [signalRef.current];
}

/**
 * Compares two dependency arrays for deep equality.
 *
 * @param previous - The previous dependency array.
 * @param current - The current dependency array.
 * @returns `true` if dependencies are deeply equal, `false` otherwise.
 */
function areDependenciesEqual(previous: DependencyList | undefined, current: DependencyList | undefined): boolean {
  // When dependencies are undefined, always return false to trigger effect on every render
  // This matches React's behavior where useEffect(() => {}) runs on every render
  if (previous === undefined || current === undefined) {
    return false;
  }

  // Same reference
  if (Object.is(previous, current)) {
    return true;
  }

  // Different lengths
  if (previous.length !== current.length) {
    return false;
  }

  // Deep compare each element
  for (const [index, element] of previous.entries()) {
    if (!isDeepEqual(element, current[index])) {
      return false;
    }
  }

  return true;
}
