import type { ReactElement, ReactNode, RefObject } from "react";

import { createContext, use, useEffect, useRef, useState } from "react";

/**
 * Layout mode the editor settles into, driven by the editor root's measured
 * width (not the viewport — the editor can be embedded inside a host shell
 * that already eats horizontal space).
 *
 * - `docked`: both side panels sit beside the canvas at their full width
 * (palette 296, properties 400), the toolbar shows every action
 * - `drawer`: on a narrow host the properties panel detaches into a full-height
 * overlay and the palette collapses to an icon rail, so the canvas keeps its
 * width instead of being squeezed
 */
export type EditorLayoutMode = "docked" | "drawer";

const EditorLayoutContext = createContext<EditorLayoutMode>("docked");
EditorLayoutContext.displayName = "EditorLayoutContext";

/**
 * Width threshold (in CSS pixels of the editor *root*, not the viewport) at or
 * above which the docked layout is used: the 296px palette + 400px properties
 * panel leave a usable (≥520px) canvas, i.e. `296 + 400 + 520 ≈ 1220`. Below it
 * the canvas would lose too much room, so the editor detaches the properties
 * panel into a drawer overlay and rails the palette.
 */
const DRAWER_MIN = 1220;

export function resolveEditorLayoutMode(width: number): EditorLayoutMode {
  // A zero width is the pre-measure state; assume the roomy docked layout until
  // the first ResizeObserver callback corrects it.
  return width === 0 || width >= DRAWER_MIN ? "docked" : "drawer";
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
  const [mode, setMode] = useState<EditorLayoutMode>("docked");
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
