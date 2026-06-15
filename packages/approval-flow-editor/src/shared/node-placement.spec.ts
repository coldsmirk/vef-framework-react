import type { FlowNode } from "../types";

import { describe, expect, it } from "vitest";

import { findFreePosition } from "./node-placement";

function nodeAt(id: string, x: number, y: number): FlowNode {
  return {
    id,
    type: "approval",
    position: { x, y },
    data: {}
  } as FlowNode;
}

describe("findFreePosition", () => {
  it("returns the preferred position when nothing occupies it", () => {
    expect(findFreePosition({ x: 100, y: 50 }, [])).toEqual({ x: 100, y: 50 });
  });

  it("cascades past an occupied spot", () => {
    const nodes = [nodeAt("n1", 100, 50)];
    const position = findFreePosition({ x: 100, y: 50 }, nodes);

    expect(position).toEqual({ x: 132, y: 82 });
  });

  it("keeps cascading while consecutive steps are occupied", () => {
    const nodes = [nodeAt("n1", 100, 50), nodeAt("n2", 132, 82)];
    const position = findFreePosition({ x: 100, y: 50 }, nodes);

    expect(position).toEqual({ x: 164, y: 114 });
  });

  it("only treats near-coincident positions as occupied", () => {
    // 24px away on one axis is the tolerance boundary — already free.
    const nodes = [nodeAt("n1", 124, 50)];

    expect(findFreePosition({ x: 100, y: 50 }, nodes)).toEqual({ x: 100, y: 50 });
  });

  it("does not mutate the preferred position argument", () => {
    const preferred = { x: 100, y: 50 };
    findFreePosition(preferred, [nodeAt("n1", 100, 50)]);

    expect(preferred).toEqual({ x: 100, y: 50 });
  });
});
