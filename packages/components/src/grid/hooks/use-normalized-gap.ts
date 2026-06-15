import type { LiteralUnion } from "@vef-framework-react/shared";

import type { FullSize } from "../../_base";

import { isNumber, isString } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { useThemeTokens } from "../../_base";

export function useNormalizedGap([rowGap, columnGap]: [LiteralUnion<FullSize, number>, LiteralUnion<FullSize, number>]) {
  const tokens = useThemeTokens();

  return useMemo(
    () => [
      normalizeGap(rowGap, tokens),
      normalizeGap(columnGap, tokens)
    ] as const,
    [columnGap, rowGap, tokens]
  );
}

function normalizeGap(gap: LiteralUnion<FullSize, number>, {
  margin,
  marginSM,
  marginXS,
  marginMD,
  marginLG
}: ReturnType<typeof useThemeTokens>) {
  if (isNumber(gap)) {
    return gap;
  }

  if (isString(gap)) {
    switch (gap) {
      case "extra-small": {
        return marginXS;
      }

      case "small": {
        return marginSM;
      }

      case "medium": {
        return margin;
      }

      case "large": {
        return marginMD;
      }

      case "extra-large": {
        return marginLG;
      }
    }
  }

  return 0;
}
