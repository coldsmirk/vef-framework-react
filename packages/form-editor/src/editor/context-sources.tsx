import type { ReactNode } from "react";

import type { LinkageContextSource } from "../types";

import { createContext, use, useRef } from "react";

const EMPTY_SOURCES: LinkageContextSource[] = [];

const ContextSourcesContext = createContext<LinkageContextSource[]>(EMPTY_SOURCES);
ContextSourcesContext.displayName = "ContextSourcesContext";

/**
 * Publishes the host's declared global-context sources (see
 * {@link LinkageContextSource}) to the visual condition builder, which offers
 * them as leaf-condition sources beside the form's own fields. Deliberately a
 * dedicated context rather than a slot on the preview runtime: this is
 * design-time metadata for the pick list, not a runtime capability —
 * evaluation reads the live `evaluationContext` regardless of what is
 * declared here.
 */
export function ContextSourcesProvider({
  children,
  sources
}: {
  children: ReactNode;
  sources: LinkageContextSource[] | undefined;
}): ReactNode {
  // Content-stable identity so a host passing an inline array literal does
  // not re-render every rule card per keystroke (same reconciliation pattern
  // as useStableOptions; the render-phase ref write is idempotent).
  const ref = useRef<LinkageContextSource[]>(EMPTY_SOURCES);
  const next = sources ?? EMPTY_SOURCES;

  if (ref.current !== next) {
    const sameContent = ref.current.length === next.length
      && next.every((source, index) => {
        const previous = ref.current[index];

        return previous !== undefined && previous.key === source.key && previous.label === source.label;
      });

    if (!sameContent) {
      ref.current = next;
    }
  }

  return <ContextSourcesContext value={ref.current}>{children}</ContextSourcesContext>;
}

/**
 * The host-declared global-context sources, empty when none were provided.
 */
export function useContextSources(): LinkageContextSource[] {
  return use(ContextSourcesContext);
}
