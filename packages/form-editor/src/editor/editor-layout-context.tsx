import type { ReactElement, ReactNode, RefObject } from "react";

import { createContext, use, useEffect, useRef, useState } from "react";

/**
 * Layout mode the editor settles into, driven by the editor root's measured
 * width (not the viewport — the editor can be embedded inside a host shell
 * that already eats horizontal space).
 *
 * - `comfortable`: both panels float side-by-side without competing for room
 * - `compact`: palette narrows, toolbar folds secondary actions into a menu
 * - `drawer`: properties panel detaches to a full-width drawer overlay so
 * the canvas keeps usable width on small screens
 */
export type EditorLayoutMode = "comfortable" | "compact" | "drawer";

const EditorLayoutContext = createContext<EditorLayoutMode>("comfortable");

/**
 * Width thresholds (in CSS pixels of the editor *root*, not the viewport).
 *
 * Picked from the playground audit running inside the starter shell:
 * - 1280 root width is the sweet spot where 296px palette + 380px floating
 * properties + a usable canvas (≥520px) all coexist without crowding
 * - 1100-1280 still fits both panels but with cramped buttons, so the
 * toolbar collapses secondary actions into a "更多" menu and the toggle
 * pills drop their labels
 * - below 1100 the canvas would lose too much width to a floating
 * properties panel; we detach properties into a drawer overlay so the
 * canvas keeps the full stage width while editing layout
 */
const COMFORTABLE_MIN = 1280;
const COMPACT_MIN = 1100;

export function resolveEditorLayoutMode(width: number): EditorLayoutMode {
  if (width === 0 || width >= COMFORTABLE_MIN) {
    return "comfortable";
  }

  if (width >= COMPACT_MIN) {
    return "compact";
  }

  return "drawer";
}

export interface EditorLayoutProviderProps {
  children: ReactNode;
  /**
   * The resolved layout mode to broadcast (from {@link useEditorLayoutMeasure}).
   */
  value: EditorLayoutMode;
}

/**
 * Wrap the editor shell in a ResizeObserver-driven layout mode broadcaster.
 * Consumers call `useEditorLayout()` to react to mode changes; the provider
 * itself does not render any DOM, so callers control the measured element
 * by attaching `ref` to whatever container they want observed.
 *
 * Usage:
 * ```tsx
 * const { ref, mode } = useEditorLayoutMeasure();
 * return (
 * <EditorLayoutProvider value={mode}>
 * <div ref={ref}>…</div>
 * </EditorLayoutProvider>
 * );
 * ```
 */
export function EditorLayoutProvider({
  children,
  value
}: EditorLayoutProviderProps): ReactElement {
  return (
    <EditorLayoutContext value={value}>
      {children}
    </EditorLayoutContext>
  );
}

export function useEditorLayout(): EditorLayoutMode {
  return use(EditorLayoutContext);
}

export interface EditorLayoutMeasure {
  ref: RefObject<HTMLDivElement | null>;
  mode: EditorLayoutMode;
}

/**
 * Helper hook for the editor shell: returns a ref to attach to the outermost
 * element and the derived layout mode.
 *
 * The ResizeObserver callback resolves the mode itself and commits state only
 * when the mode **crosses a threshold** (compared against a ref). Tracking the
 * raw width in state instead would re-render the whole editor shell once per
 * pixel during a host splitter drag; the mode changes at exactly two widths,
 * so this observes every resize but renders at most on a band change.
 */
export function useEditorLayoutMeasure(): EditorLayoutMeasure {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<EditorLayoutMode>("comfortable");
  const modeRef = useRef<EditorLayoutMode>(mode);

  useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const observer = new ResizeObserver(entries => {
      const width = entries.at(-1)?.contentRect.width ?? node.getBoundingClientRect().width;
      const next = resolveEditorLayoutMode(width);

      if (next !== modeRef.current) {
        modeRef.current = next;
        setMode(next);
      }
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, mode };
}
