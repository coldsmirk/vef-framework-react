import type { UniqueIdentifier } from "@dnd-kit/abstract";
import type { DragEndEvent } from "@dnd-kit/react";

import { arrayMove } from "@dnd-kit/helpers";
import { isSortable } from "@dnd-kit/react/sortable";

/**
 * The list in the order a sortable drag left its rows on screen; the same array
 * when the drag was canceled or moved nothing.
 *
 * A sortable drag moves the rows' elements as it goes and puts them back only
 * when it is canceled, so the order to keep is the one shown, wherever the
 * pointer was released. `moveDragItem` keeps the old order when it was released
 * off every row, which leaves the screen out of step with the list.
 */
export function moveSortableItem<T extends UniqueIdentifier | { id: UniqueIdentifier }>(
  items: T[],
  { operation: { canceled, source } }: DragEndEvent
): T[] {
  if (canceled || !isSortable(source)) {
    return items;
  }

  const from = items.findIndex(item => (typeof item === "object" ? item.id : item) === source.id);

  return from === -1 ? items : arrayMove(items, from, source.index);
}
