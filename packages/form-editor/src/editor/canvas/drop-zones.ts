import type { Block } from "../../types";
import type { DropZoneData } from "../dnd";

import { CollisionPriority } from "@vef-framework-react/core";

import { dropZoneId, isEditorDragData } from "../dnd";

/**
 * Drop-zone geometry — the single axis along which a container body varies. A
 * `"horizontal"` zone is a stack gap (a hairline rule between stacked blocks); a
 * `"vertical"` zone is a beside slot (a hairline rule between inline slots).
 */
export type ZoneOrientation = "horizontal" | "vertical";

/**
 * Per-source acceptance test for a drop zone. Receives the dragged source (its
 * `data` carries the {@link import("../dnd").EditorDragData}) and decides whether
 * the zone takes it. Used by the `table` subform to accept only column-eligible
 * fields; a descriptor without one accepts any field draggable (the default
 * {@link import("../dnd").FIELD_DRAG_TYPE} type match).
 */
export type DropZoneAccept = (source: { data?: unknown }) => boolean;

/**
 * One precise insertion point the render path turns into a single `useDroppable`
 * plus a single `<DropIndicator>`. `id` and `data` are minted from the same
 * {@link dropZoneId} source the drag-end handler reads, so the rendered droppable
 * and its resolved {@link import("../dnd").DropTarget} can never drift. `priority`
 * is a {@link CollisionPriority} tier (beside outranks gap outranks the body
 * fallback), so nested zones sort by tier first and geometric distance second.
 */
export interface DropZoneDescriptor {
  id: string;
  data: DropZoneData;
  priority: CollisionPriority;
  orientation: ZoneOrientation;
  /**
   * Optional per-source acceptance test. Omitted means "accept any field
   * draggable" — the default type match in {@link import("./canvas").Zone}.
   */
  accept?: DropZoneAccept;
}

/**
 * One inline slot: the block to render plus the beside zones that flank it. The
 * N+1 dedup lives here and only here — every slot owns its `"before"` (insert
 * before) zone, and the last slot additionally owns the trailing `"after"` zone,
 * so a row of N slots yields exactly N+1 beside zones with no interior gap
 * double-covered (the bug the old per-slot `"leading"`/`"both"` arithmetic
 * tried to patch at every call site).
 */
export interface InlineSlot {
  block: Block;
  beside: DropZoneDescriptor[];
}

/**
 * Rejects the drag whose own block IS the zone's anchor: dropping a block
 * beside itself is a structural no-op (`moveBlock` refuses an anchor inside
 * the dragged subtree), so the zone must not light up as a valid target —
 * a highlighted indicator that silently does nothing breaks the "highlight
 * means droppable" contract. Palette drags carry no node id and always pass.
 */
function acceptsOtherBlock(anchorId: string): DropZoneAccept {
  return source => !isEditorDragData(source.data)
    || source.data.kind !== "block"
    || source.data.nodeId !== anchorId;
}

/**
 * AND-compose two acceptance tests, treating an absent one as "accept all".
 * Lets a caller layer its own test (the table's column eligibility) over a
 * descriptor's built-in self-anchor suppression instead of replacing it.
 */
export function composeAccept(a: DropZoneAccept | undefined, b: DropZoneAccept | undefined): DropZoneAccept {
  return source => (a?.(source) ?? true) && (b?.(source) ?? true);
}

function besideDescriptor(anchorId: string, side: "before" | "after", orientation: ZoneOrientation): DropZoneDescriptor {
  const data: DropZoneData = {
    zone: "beside",
    anchorId,
    side
  };

  return {
    id: dropZoneId(data),
    data,
    priority: CollisionPriority.Normal,
    orientation,
    accept: acceptsOtherBlock(anchorId)
  };
}

/**
 * Describe an inline body (flex / grid) as a list of slots with their beside
 * zones. The N+1 dedup that every inline container would otherwise re-implement
 * is done once here, so a new inline container inherits it by passing its blocks.
 *
 * `orientation` is the axis the indicators render on and must match the body's
 * actual layout axis: a row of slots gets `"vertical"` edge bands (the
 * default), a column-direction flex gets `"horizontal"` ones — a left/right
 * hairline on a top-to-bottom stack would point at the wrong insertion axis.
 */
export function inlineSlots(blocks: Block[], orientation: ZoneOrientation = "vertical"): InlineSlot[] {
  const lastIndex = blocks.length - 1;

  return blocks.map((block, index) => {
    const beside = [besideDescriptor(block.id, "before", orientation)];

    if (index === lastIndex) {
      beside.push(besideDescriptor(block.id, "after", orientation));
    }

    return {
      block,
      beside
    };
  });
}

/**
 * Describe the gap zone that precedes a stacked block. A stack body has one such
 * zone per block (insert before that block); appending after the last block is
 * the body-level fallback's job, so there is exactly one zone per boundary with
 * no doubling.
 */
export function stackGapDescriptor(anchorId: string): DropZoneDescriptor {
  const data: DropZoneData = {
    zone: "beside",
    anchorId,
    side: "before"
  };

  return {
    id: dropZoneId(data),
    data,
    priority: CollisionPriority.Low,
    orientation: "horizontal",
    accept: acceptsOtherBlock(anchorId)
  };
}
