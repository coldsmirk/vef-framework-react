import { isDeepEqual } from "@vef-framework-react/shared";
import { useRef } from "react";

/**
 * Creates a memoized selector that uses deep equality comparison.
 * Returns the previous value if deeply equal to prevent unnecessary re-renders.
 *
 * @param selector - The selector function to memoize
 * @returns A memoized selector function
 */
export function useDeep<TState, TSelected>(selector: (state: TState) => TSelected): (state: TState) => TSelected {
  const prevRef = useRef<TSelected>(null);

  return (state: TState): TSelected => {
    const next = selector(state);

    if (isDeepEqual(prevRef.current, next)) {
      return prevRef.current!;
    }

    prevRef.current = next;
    return next;
  };
}
