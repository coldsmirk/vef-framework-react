import type { DragEndEvent } from "@dnd-kit/react";

import { Sortable } from "@dnd-kit/dom/sortable";

import { moveSortableItem } from "./move-sortable-item";

interface Drag {
  id: string;
  from: number;
  to: number;
  canceled?: boolean;
}

/**
 * The end of a drag that was released off every row.
 */
function endOf({
  canceled = false,
  from,
  id,
  to
}: Drag): DragEndEvent {
  const sortable = new Sortable({ id, index: from }, undefined);

  sortable.index = to;

  return {
    canceled,
    operation: {
      canceled,
      source: sortable.draggable,
      target: null
    }
  } as unknown as DragEndEvent;
}

describe("moveSortableItem", () => {
  it("moves an id to where its row was shown", () => {
    expect(moveSortableItem(["a", "b", "c"], endOf({
      id: "a",
      from: 0,
      to: 2
    }))).toEqual(["b", "c", "a"]);
  });

  it("moves a record found by its id", () => {
    const [a, b, c] = [{ id: "a" }, { id: "b" }, { id: "c" }];

    expect(moveSortableItem([a, b, c], endOf({
      id: "c",
      from: 2,
      to: 0
    }))).toEqual([c, a, b]);
  });

  it("finds the item by its id where the list has moved on since the drag began", () => {
    expect(moveSortableItem(["x", "a", "b"], endOf({
      id: "a",
      from: 0,
      to: 2
    }))).toEqual(["x", "b", "a"]);
  });

  describe("when the order did not change", () => {
    it("returns the same list for a row left in its place", () => {
      const items = ["a", "b"];

      expect(moveSortableItem(items, endOf({
        id: "a",
        from: 0,
        to: 0
      }))).toBe(items);
    });

    it("returns the same list for a canceled drag", () => {
      const items = ["a", "b"];

      expect(moveSortableItem(items, endOf({
        id: "a",
        from: 0,
        to: 1,
        canceled: true
      }))).toBe(items);
    });

    it("returns the same list for a row it does not hold", () => {
      const items = ["a", "b"];

      expect(moveSortableItem(items, endOf({
        id: "z",
        from: 0,
        to: 1
      }))).toBe(items);
    });
  });
});
