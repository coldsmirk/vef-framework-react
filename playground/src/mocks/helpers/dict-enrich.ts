import { DICTIONARY_ITEMS } from "../modules/sys-dictionary";

function labelFor(dictKey: string, value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const items = DICTIONARY_ITEMS[dictKey];

  if (!items) {
    return null;
  }

  // Loose equality (stringified) so number columns can still match string
  // dictionary values (e.g. district.level=1 vs item.value="1").
  const needle = String(value);
  const match = items.find(item => String(item.value) === needle);
  return match?.label ?? null;
}

/**
 * Returns a `decorate` function that attaches `<field>Name` properties to a
 * row by resolving the raw value against the named dictionary.
 *
 * Example:
 * ```ts
 * decorate: enrichWithDictNames({ gender: "md.staff.gender" })
 * ```
 * adds `genderName: "男"` when `gender === "M"`.
 */
export function enrichWithDictNames<T>(
  mapping: Record<string, string>
): (row: T) => T {
  return (row: T) => {
    const source = row as Record<string, unknown>;
    const extras: Record<string, unknown> = {};

    for (const [field, dictKey] of Object.entries(mapping)) {
      extras[`${field}Name`] = labelFor(dictKey, source[field]);
    }

    return { ...source, ...extras } as T;
  };
}
