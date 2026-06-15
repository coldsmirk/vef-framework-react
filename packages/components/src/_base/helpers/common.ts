import type { Length } from "../types";

import { isNumber } from "@vef-framework-react/shared";

export function getSpacingValue(value: Length): string {
  return isNumber(value) ? `${value}px` : value;
}
