import type { PresentationLayer } from "../types";

import { getNodeOptionSource } from "./options";
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
    const source = getNodeOptionSource(node);

    if (source?.kind === "codeSet" && source.codeSet.length > 0) {
      codeSets.add(source.codeSet);
    }
  });

  return [...codeSets].toSorted();
}
