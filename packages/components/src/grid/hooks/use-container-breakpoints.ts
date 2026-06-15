import type { Breakpoint } from "../../_base";

import { useMemo } from "react";

export function useContainerBreakpoints(baseWidth: number) {
  return useMemo(
    () => {
      const breakpoints: Record<Breakpoint, number> = {
        xxs: baseWidth,
        xs: baseWidth * 2,
        sm: baseWidth * 3,
        md: baseWidth * 4,
        lg: baseWidth * 5,
        xl: baseWidth * 6,
        xxl: baseWidth * 7
      };

      return breakpoints;
    },
    [baseWidth]
  );
}
