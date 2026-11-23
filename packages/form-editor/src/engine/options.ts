import type { Block, FieldOptionSource } from "../types";

import { isFixedSubform } from "./schema/subform";

/**
 * Return the stringified option values that appear more than once in `options`.
 * Shared by schema validation, approval projection, and `OptionListEditor`.
 */
export function findDuplicateOptionValues(options: ReadonlyArray<{ value: unknown }>): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  for (const option of options) {
    const value = String(option.value);

    if (seen.has(value)) {
      duplicated.add(value);
    }

    seen.add(value);
  }

  return [...duplicated];
}

/**
 * Read the option source bound to a block, if any: a fixed-row subform exposes
 * `rows.source`, while a selection leaf exposes `dataSource`.
 */
export function getNodeOptionSource(node: Block): FieldOptionSource | undefined {
  if (node.type === "subform") {
    return isFixedSubform(node) ? node.rows.source : undefined;
  }

  return "dataSource" in node ? node.dataSource : undefined;
}
