import type { Breakpoint } from "../../_base";
import type { ResponsiveValue } from "../props";

import { isPlainObject } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { breakpoints } from "../../_base";

export function useResponsiveValue<T>(
  value: ResponsiveValue<T>,
  breakpoint: Breakpoint
) {
  const resolvedValue = useMemo(
    () => getResponsiveValue(value, breakpoint),
    [value, breakpoint]
  );

  return resolvedValue;
}

export function getResponsiveValue<T>(value: ResponsiveValue<T>, breakpoint: Breakpoint) {
  if (isPlainObject(value)) {
    const resolvedValue = value[breakpoint];

    if (resolvedValue) {
      return resolvedValue;
    }

    const breakpointArr = Object.keys(breakpoints);
    let breakpointIndex = breakpointArr.indexOf(breakpoint);

    while (breakpointIndex--) {
      const fallbackValue = value[breakpointArr[breakpointIndex] as Breakpoint];

      if (fallbackValue) {
        return fallbackValue;
      }
    }

    return;
  }

  return value;
}
