import { isNumber } from "@vef-framework-react/shared";
import { useEffect, useMemo, useState } from "react";

export type BreakpointValue = number | string;
export type Breakpoints<T extends string = string> = Record<T, BreakpointValue>;

/**
 * Result returned by useBreakpoints hook
 */
export interface UseBreakpointsResult<T extends string = string> {
  /**
   * The name of the current active breakpoint (largest matching)
   */
  current?: T;
  /**
   * The numeric value of the current breakpoint
   */
  value?: BreakpointValue;
  /**
   * Array of all matching breakpoint names
   */
  matches: T[];
}

/**
 * Options for useBreakpoints hook
 */
export interface UseBreakpointsOptions<T extends string = string> {
  /**
   * Initial breakpoint name for SSR (server-side rendering)
   * If not provided, will default to null during SSR
   */
  initialBreakpoint?: T;
  /**
   * Get initial value in effect instead of on mount
   * This helps avoid hydration mismatches in SSR
   *
   * @default false
   */
  getInitialValueInEffect?: boolean;
}

/**
 * Convert breakpoint config to media query
 */
function createMediaQuery(value: BreakpointValue): string {
  return `(min-width: ${isNumber(value) ? `${value}px` : value})`;
}

/**
 * Tracks active responsive breakpoints based on window width using media queries.
 * Returns the current breakpoint and all matching breakpoints.
 *
 * @param breakpoints - Breakpoint configuration object mapping names to min-width values.
 * @param options - Hook options for SSR and hydration handling.
 * @returns Current breakpoint information including name, value, and all matches.
 * @remarks
 * Uses `min-width` media queries, so include a breakpoint starting from 0 to cover all viewport sizes.
 * @example
 * ```tsx
 * const breakpoints = { xs: 0, sm: 640, md: 768, lg: 1024, xl: 1280 };
 * const { current, matches } = useBreakpoints(breakpoints);
 *
 * // current: 'md' (largest matching breakpoint)
 * // matches: ['xs', 'sm', 'md'] (all matching breakpoints)
 * ```
 */
export function useBreakpoints<T extends string>(
  breakpoints: Breakpoints<T>,
  options: UseBreakpointsOptions<T> = {}
): UseBreakpointsResult<T> {
  const { initialBreakpoint, getInitialValueInEffect = false } = options;

  const sortedBreakpoints = useMemo(
    () => Object.entries<BreakpointValue>(breakpoints)
      .map(([name, value]) => {
        return {
          name: name as T,
          value,
          query: createMediaQuery(value),
          order: isNumber(value) ? value : Number.parseInt(value as string)
        };
      })
      .toSorted((a, b) => a.order - b.order),
    [breakpoints]
  );

  const [state, setState] = useState<UseBreakpointsResult<T>>(() => {
    if (globalThis.window === undefined || getInitialValueInEffect) {
      const initialEntry = sortedBreakpoints.find(bp => bp.name === initialBreakpoint);
      return {
        current: initialBreakpoint,
        value: initialEntry?.value,
        matches: initialBreakpoint ? [initialBreakpoint] : []
      };
    }

    const matchingBreakpoints = sortedBreakpoints.filter(bp => matchMedia(bp.query).matches);
    const currentBreakpoint = matchingBreakpoints.at(-1);

    return {
      current: currentBreakpoint?.name,
      value: currentBreakpoint?.value,
      matches: matchingBreakpoints.map(bp => bp.name)
    };
  });

  useEffect(() => {
    const mediaQueryLists = sortedBreakpoints.map(bp => {
      return {
        name: bp.name,
        value: bp.value,
        mql: matchMedia(bp.query)
      };
    });

    function updateBreakpoint(): void {
      const matchingBreakpoints = mediaQueryLists.filter(item => item.mql.matches);
      const currentBreakpoint = matchingBreakpoints.at(-1);

      setState({
        current: currentBreakpoint?.name,
        value: currentBreakpoint?.value,
        matches: matchingBreakpoints.map(mbp => mbp.name)
      });
    }

    if (getInitialValueInEffect) {
      updateBreakpoint();
    }

    for (const item of mediaQueryLists) {
      item.mql.addEventListener("change", updateBreakpoint);
    }

    return () => {
      for (const item of mediaQueryLists) {
        item.mql.removeEventListener("change", updateBreakpoint);
      }
    };
  }, [getInitialValueInEffect, sortedBreakpoints]);

  return state;
}
