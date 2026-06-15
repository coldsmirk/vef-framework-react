import type { RuntimeFormValues } from "./types";

/**
 * Resolve the value object at a name prefix (e.g. `"lines[0]."`) within the
 * full form values, so a subform field evaluates against its row record. The
 * root scope (prefix `""`) returns the whole values object; a path that does
 * not resolve to an object returns `{}`.
 */
export function resolveScopeValues(values: RuntimeFormValues, namePrefix: string): RuntimeFormValues {
  if (namePrefix === "") {
    return values;
  }

  const tokens = namePrefix.match(/[^.[\]]+/g) ?? [];
  let current: unknown = values;

  for (const token of tokens) {
    if (current === null || typeof current !== "object") {
      return {};
    }

    const key = /^\d+$/.test(token) ? Number(token) : token;
    current = (current as Record<string | number, unknown>)[key];
  }

  return current !== null && typeof current === "object" ? current as RuntimeFormValues : {};
}
