import type { RemoteOptionMapping } from "../types";

const MAPPING_KEYS = ["labelKey", "valueKey", "disabledKey", "descriptionKey"] as const;

/**
 * A remote option mapping with its blank entries dropped, or `undefined` when
 * nothing is left. A blank key means "use the default", but a consumer reading
 * `mapping.labelKey ?? "label"` would take `""` literally and read every
 * option's label off a nonexistent property — so a mapping is normalized
 * before it is stored, resolved, or projected.
 */
export function normalizeOptionMapping(mapping: RemoteOptionMapping | undefined): RemoteOptionMapping | undefined {
  if (mapping === undefined) {
    return undefined;
  }

  const entries = MAPPING_KEYS.flatMap(key => {
    const value = mapping[key];

    return typeof value === "string" && value.trim().length > 0 ? [[key, value.trim()] as const] : [];
  });

  return entries.length === 0 ? undefined : Object.fromEntries(entries);
}
