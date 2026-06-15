import type { Block } from "../../types";

import { CollisionPriority } from "@vef-framework-react/core";

import { dropZoneId } from "../dnd";
import { inlineSlots, stackGapDescriptor } from "./drop-zones";

function block(id: string): Block {
  return {
    id,
    type: "textfield",
    key: id,
    label: id
  };
}

describe("inlineSlots", () => {
  it("yields exactly N+1 beside zones for N slots", () => {
    const slots = inlineSlots([block("a"), block("b"), block("c")]);
    const total = slots.reduce((sum, slot) => sum + slot.beside.length, 0);

    expect(total).toBe(4);
  });

  it("gives every slot a leading before zone and only the last slot a trailing after zone", () => {
    const slots = inlineSlots([block("a"), block("b"), block("c")]);

    expect(slots.map(slot => slot.beside.map(zone => zone.data))).toEqual([
      [
        {
          zone: "beside",
          anchorId: "a",
          side: "before"
        }
      ],
      [
        {
          zone: "beside",
          anchorId: "b",
          side: "before"
        }
      ],
      [
        {
          zone: "beside",
          anchorId: "c",
          side: "before"
        },
        {
          zone: "beside",
          anchorId: "c",
          side: "after"
        }
      ]
    ]);
  });

  it("mints each descriptor id from the shared dropZoneId source", () => {
    const zones = inlineSlots([block("a"), block("b")]).flatMap(slot => slot.beside);

    expect(zones.every(zone => zone.id === dropZoneId(zone.data))).toBe(true);
  });

  it("marks beside zones as vertical at Normal priority", () => {
    const zones = inlineSlots([block("a"), block("b")]).flatMap(slot => slot.beside);

    expect(zones.every(zone => zone.orientation === "vertical")).toBe(true);
    expect(zones.every(zone => zone.priority === CollisionPriority.Normal)).toBe(true);
  });

  it("returns no slots for an empty block list", () => {
    expect(inlineSlots([])).toEqual([]);
  });
});

describe("stackGapDescriptor", () => {
  it("describes a horizontal gap at Low priority before the given block", () => {
    const descriptor = stackGapDescriptor("block-1");

    expect(descriptor.orientation).toBe("horizontal");
    expect(descriptor.priority).toBe(CollisionPriority.Low);
    expect(descriptor.data).toEqual({
      zone: "beside",
      anchorId: "block-1",
      side: "before"
    });
  });

  it("mints its id from the shared dropZoneId source", () => {
    const descriptor = stackGapDescriptor("block-1");

    expect(descriptor.id).toBe(dropZoneId(descriptor.data));
  });
});
