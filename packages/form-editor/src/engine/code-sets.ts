import type { PresentationLayer } from "../types";

import { isFixedSubform } from "./schema/subform";
import { walkNodes } from "./schema/walk";

/**
 * The code set keys a presentation's selection fields and fixed-row subforms
 * read, subform templates included, de-duplicated and sorted: the one batched
 * dictionary load a form issues. Sorted, they are also the query key
 * `useCodeSetQuery` builds for the same dictionaries, so the two share one
 * cache entry.
 */
export function collectCodeSets(layer: PresentationLayer): string[] {
  const codeSets = new Set<string>();

  walkNodes(layer, node => {
    const source = node.type === "subform"
      ? isFixedSubform(node) ? node.rows.source : undefined
      : "dataSource" in node ? node.dataSource : undefined;

    if (source?.kind === "codeSet" && source.codeSet.length > 0) {
      codeSets.add(source.codeSet);
    }
  });

  return [...codeSets].toSorted();
}
