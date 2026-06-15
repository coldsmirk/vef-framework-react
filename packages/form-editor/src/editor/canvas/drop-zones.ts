import type { Block } from "../../types";
import type { DropZoneData } from "../dnd";

import { CollisionPriority } from "@vef-framework-react/core";

import { dropZoneId } from "../dnd";

/**
 * Drop-zone geometry — the single axis along which a container body varies. A
 * `"horizontal"` zone is a stack gap (a hairline rule between stacked blocks); a
 * `"vertical"` zone is a beside slot (a hairline rule between inline slots).
 */
export type ZoneOrientation = "horizontal" | "vertical";

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

function besideDescriptor(anchorId: string, side: "before" | "after"): DropZoneDescriptor {
  const data: DropZoneData = {
    zone: "beside",
    anchorId,
    side
  };

  return {
    id: dropZoneId(data),
    data,
    priority: CollisionPriority.Normal,
    orientation: "vertical"
  };
}

/**
 * Describe an inline body (flex / grid) as a list of slots with their beside
 * zones. The N+1 dedup that every inline container would otherwise re-implement
 * is done once here, so a new inline container inherits it by passing its blocks.
 */
export function inlineSlots(blocks: Block[]): InlineSlot[] {
  const lastIndex = blocks.length - 1;

  return blocks.map((block, index) => {
    const beside = [besideDescriptor(block.id, "before")];

    if (index === lastIndex) {
      beside.push(besideDescriptor(block.id, "after"));
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
    orientation: "horizontal"
  };
}
