import type { MaybeUndefined } from "@vef-framework-react/shared";

import type { Breakpoint, Length } from "../types";

import { isUndefined } from "@vef-framework-react/shared";

import { breakpoints } from "../constants";

const breakpointOrder = Object.keys(breakpoints) as Breakpoint[];

/**
 * Resolves a breakpoint value from a partial breakpoints config.
 * Falls back to the nearest defined breakpoint value (smaller first, then larger).
 */
export function resolveBreakpointValue(
  breakpointValues: Partial<Record<Breakpoint, Length>>,
  breakpoint: Breakpoint
): MaybeUndefined<Length> {
  const value = breakpointValues[breakpoint];

  if (!isUndefined(value)) {
    return value;
  }

  const currentIndex = breakpointOrder.indexOf(breakpoint);

  for (let i = currentIndex - 1; i >= 0; i--) {
    const bp = breakpointOrder[i]!;
    const bpValue = breakpointValues[bp];

    if (!isUndefined(bpValue)) {
      return bpValue;
    }
  }

  for (let i = currentIndex + 1; i < breakpointOrder.length; i++) {
    const bp = breakpointOrder[i]!;
    const bpValue = breakpointValues[bp];

    if (!isUndefined(bpValue)) {
      return bpValue;
    }
  }
}
