import type { PresentationLayer } from "../types";

import { walkFields } from "./schema/walk";

/**
 * The code set keys a presentation's selection fields read, subform templates
 * included, de-duplicated and sorted: the one batched dictionary load a form
 * issues. Sorted, they are also the query key `useCodeSetQuery` builds for the
 * same dictionaries, so the two share one cache entry.
 */
export function collectCodeSets(layer: PresentationLayer): string[] {
  const codeSets = new Set<string>();

  walkFields(layer, field => {
    const source = "dataSource" in field ? field.dataSource : undefined;

    if (source?.kind === "codeSet" && source.codeSet.length > 0) {
      codeSets.add(source.codeSet);
    }
  });

  return [...codeSets].toSorted();
}
