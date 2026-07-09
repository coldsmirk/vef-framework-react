import type { RefObject } from "react";

import { useEffect } from "react";

import { useFormEditorStore } from "../../store/form-store";

/**
 * Scrolls the selected block into view whenever the selection changes — after a
 * drop (insert / move / duplicate) or a programmatic select (outline click,
 * keyboard shortcut, undo/redo), the block the designer just acted on is
 * brought into the viewport. This pays off most on the 100s-of-fields forms the
 * editor targets, where a drop near the bottom of a tall form would otherwise
 * give no viewport feedback.
 *
 * `block: "nearest"` makes selecting an already-visible block a no-op, so a
 * plain click on the canvas never yanks the viewport — only off-screen
 * selections scroll. The effect fires once per selection change (keyed on
 * `selectedId`), so it adds no per-keystroke or per-frame-drag work.
 *
 * Scoped to `containerRef` so the lookup only sees this editor instance's
 * canvas, and `scrollIntoView` resolves against the nearest scroll ancestor —
 * the desktop canvas scroller or the mobile phone viewport — without branching
 * on device. In preview / JSON mode the store holds no selection to react to,
 * and the kept-alive edit tree is hidden, so nothing scrolls there.
 */
export function useScrollSelectionIntoView(containerRef: RefObject<HTMLElement | null>): void {
  const selectedId = useFormEditorStore(s => s.selectedId);

  useEffect(() => {
    if (selectedId === null) {
      return;
    }

    const node = containerRef.current?.querySelector(`[data-node-id="${CSS.escape(selectedId)}"]`);

    node?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selectedId, containerRef]);
}
