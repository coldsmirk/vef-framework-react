import type { DragEndEvent } from "@vef-framework-react/core";

import type { DropTarget } from "../store/form-store";

import { KeyboardSensor, PointerActivationConstraints, PointerSensor } from "@vef-framework-react/core";

import { assertNever } from "../engine/assert-never";
import { useFieldRegistry } from "../store/engine-provider";
import { useFormEditorStoreApi } from "../store/form-store";

/**
 * Shared drag-and-drop contract for the editor canvas, built on dnd-kit v0.4.
 *
 * A drag originates from either a palette item (creates a new field) or an
 * existing canvas block (moves it). It lands on one of three drop-zone kinds.
 * Both ends attach typed `data`; the drag-end handler reads them and dispatches
 * the matching store action.
 */

/**
 * The editor's pointer sensor. Requires a small deliberate gesture before a
 * drag starts: mouse / pen must move 5px, touch must press-and-hold 250ms (so
 * a swipe scrolls the canvas instead of dragging). This overrides dnd-kit's
 * default, which lets a drag begin immediately when the pointer is already on
 * a drag handle — without it a mere click on a canvas grip would twitch into a
 * drag. Only the activation constraint is replaced; the default handle /
 * interactive-element gating is preserved. Module-scoped so the descriptor
 * keeps a stable identity across renders.
 */
export const editorPointerSensor = PointerSensor.configure({
  activationConstraints: (event: PointerEvent) => event.pointerType === "touch"
    ? [new PointerActivationConstraints.Delay({ value: 250, tolerance: 5 })]
    : [new PointerActivationConstraints.Distance({ value: 5 })]
});

/**
 * Sensors for the editor's `DragDropProvider`: the gated pointer sensor plus
 * keyboard dragging (pick a canvas block up with Enter on its grip, move it
 * with the arrow keys). Palette items override this per-source with
 * {@link palettePointerSensors} — on a palette card, Enter/Space mean
 * "append", not "pick up".
 */
export const editorSensors = [editorPointerSensor, KeyboardSensor];

/**
 * Per-source sensor list for palette items: pointer only. dnd-kit's
 * KeyboardSensor activates on Enter/Space and swallows the event
 * (`stopImmediatePropagation`), which would make it impossible for the
 * palette card's documented keyboard affordance — Enter/Space appends the
 * field — to ever fire. Canvas blocks keep the full {@link editorSensors},
 * so keyboard-driven moving stays available where it is meaningful.
 */
export const palettePointerSensors = [editorPointerSensor];

/**
 * Data attached to a draggable.
 */
export type EditorDragData
  = | { kind: "palette"; type: string }
    | { kind: "block"; nodeId: string };

/**
 * Data attached to a drop zone.
 *
 * - `beside` — insert immediately `before`/`after` the block `anchorId`, sharing
 * its parent list (a sibling in the document stack, or a cell/slot in a grid /
 * flex).
 * - `container` — append into a container's body (a tab selected by `tabIndex`).
 * - `root` — append at the end of the root document.
 */
export type DropZoneData
  = | { zone: "beside"; anchorId: string; side: "before" | "after" }
    | { zone: "container"; containerId: string; tabIndex?: number }
    | { zone: "root" };

export const FIELD_DRAG_TYPE = "vef-field";

/**
 * Stable droppable id for a drop zone. The canvas (which registers the zones)
 * and the per-field beside-strips both derive their ids here, so the two ends
 * can never drift to mismatched id formats.
 */
export function dropZoneId(data: DropZoneData): string {
  switch (data.zone) {
    case "beside": {
      return `beside-${data.anchorId}-${data.side}`;
    }

    case "container": {
      return `container-${data.containerId}-${data.tabIndex ?? 0}`;
    }

    case "root": {
      return "root-tail";
    }
  }
}

/**
 * Stable id for a body-level fallback droppable. Each `CanvasBody` registers one
 * covering its whole region at the lowest collision priority, so a drop that
 * misses every precise zone still lands (appending to that body) instead of
 * being silently discarded. Derived from {@link dropZoneId} so it can never
 * collide with a precise zone's id.
 */
export function fallbackDropZoneId(data: DropZoneData): string {
  return `fallback-${dropZoneId(data)}`;
}

function toDropTarget(data: DropZoneData): DropTarget {
  switch (data.zone) {
    case "beside": {
      return {
        kind: "beside",
        anchorId: data.anchorId,
        side: data.side
      };
    }

    case "container": {
      return {
        kind: "container",
        containerId: data.containerId,
        tabIndex: data.tabIndex
      };
    }

    case "root": {
      return { kind: "append" };
    }

    default: {
      return assertNever(data);
    }
  }
}

function isDropZoneData(value: unknown): value is DropZoneData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as {
    zone?: unknown;
    anchorId?: unknown;
    side?: unknown;
    containerId?: unknown;
  };

  switch (data.zone) {
    case "beside": {
      return typeof data.anchorId === "string" && (data.side === "before" || data.side === "after");
    }

    case "container": {
      return typeof data.containerId === "string";
    }

    case "root": {
      return true;
    }

    default: {
      return false;
    }
  }
}

function isEditorDragData(value: unknown): value is EditorDragData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const data = value as { kind?: unknown; type?: unknown; nodeId?: unknown };

  if (data.kind === "palette") {
    return typeof data.type === "string";
  }

  if (data.kind === "block") {
    return typeof data.nodeId === "string";
  }

  return false;
}

/**
 * Build the `onDragEnd` handler for the editor's `DragDropProvider`. Reads the
 * source (palette type or moved node) and the drop zone, then inserts or moves.
 */
export function useEditorDragEnd(): (event: DragEndEvent) => void {
  const storeApi = useFormEditorStoreApi();
  const registry = useFieldRegistry();

  return (event: DragEndEvent) => {
    const { source, target } = event.operation;

    if (event.canceled || !source || !target) {
      return;
    }

    const dragData = source.data;
    const zoneData = target.data;

    if (!isEditorDragData(dragData) || !isDropZoneData(zoneData)) {
      return;
    }

    const dropTarget = toDropTarget(zoneData);

    if (dragData.kind === "palette") {
      const definition = registry.get(dragData.type);

      if (definition) {
        storeApi.getState().insertField({ definition, target: dropTarget });
      }

      return;
    }

    storeApi.getState().moveNode({ nodeId: dragData.nodeId, target: dropTarget });
  };
}
