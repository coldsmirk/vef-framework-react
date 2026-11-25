import type { RefObject } from "react";

import { useEffect, useRef, useState } from "react";

const HIGHLIGHT_MS = 1800;

export interface Attention {
  ref: RefObject<HTMLDivElement | null>;
  highlighted: boolean;
}

/**
 * Draws the eye to an element a diagnostic jumped to: each new `request` (by
 * identity) scrolls it into view and highlights it for a moment.
 */
export function useAttention(request: object | null): Attention {
  const ref = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState(false);

  useEffect(() => {
    if (request === null) {
      return;
    }

    ref.current?.scrollIntoView({ block: "nearest" });
    setHighlighted(true);

    const timer = setTimeout(() => setHighlighted(false), HIGHLIGHT_MS);

    return () => {
      clearTimeout(timer);
      setHighlighted(false);
    };
  }, [request]);

  return { ref, highlighted };
}
