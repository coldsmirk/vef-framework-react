import type { SourceFieldOption } from "./options";

import { useRef } from "react";

/**
 * Keep an option list's identity stable while its content is unchanged.
 *
 * The candidate walks rebuild the array on every store edit (the layer
 * reference moves per keystroke), but the candidate SET only changes when a
 * field is added / removed / re-keyed / re-labeled. Downstream the array
 * identity feeds the expression editors' `assistExtensions` memo — a fresh
 * reference per keystroke would rebuild the CodeMirror completion / lint
 * extensions and reconfigure the editor mid-typing (closing an open
 * completion popup).
 *
 * The ref write happens during render but is idempotent for a given content,
 * so StrictMode double-renders and discarded concurrent renders stay
 * consistent — the same argument as the renderer's `prevRef` reconciliation.
 */
export function useStableOptions<T extends SourceFieldOption>(options: T[]): T[] {
  const ref = useRef(options);

  if (ref.current !== options) {
    const sameContent = ref.current.length === options.length
      && options.every((option, index) => {
        const previous = ref.current[index];

        return previous !== undefined && previous.value === option.value && previous.label === option.label;
      });

    if (!sameContent) {
      ref.current = options;
    }
  }

  return ref.current;
}
