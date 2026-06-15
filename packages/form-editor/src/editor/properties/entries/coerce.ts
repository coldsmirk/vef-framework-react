import { isNullish, isString } from "@vef-framework-react/shared";

/**
 * Coerce an opaque property value to a display string: strings pass through,
 * nullish becomes "", everything else is String()-formatted. Shared by the text
 * and select property entries so the coercion cannot drift between them.
 */
export function coerceToString(value: unknown): string {
  if (isString(value)) {
    return value;
  }

  if (isNullish(value)) {
    return "";
  }

  return String(value);
}
