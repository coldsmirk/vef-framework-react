import type { GridNode } from "../types";

import { GRID_DEFAULT_COLUMNS, gridCellStyle, gridColumnCount, gridContainerStyle } from "./grid-style";

function grid(props: Partial<GridNode> = {}): GridNode {
  return {
    id: "Grid_1",
    type: "grid",
    children: [],
    ...props
  };
}

describe("gridColumnCount", () => {
  it("defaults to GRID_DEFAULT_COLUMNS when columns is unset", () => {
    expect(gridColumnCount(grid())).toBe(GRID_DEFAULT_COLUMNS);
  });

  it("returns the configured column count", () => {
    expect(gridColumnCount(grid({ columns: 4 }))).toBe(4);
  });

  it("clamps a column count below 1 up to 1", () => {
    expect(gridColumnCount(grid({ columns: 0 }))).toBe(1);
  });

  it("clamps a column count above the 24-column basis down to 24", () => {
    expect(gridColumnCount(grid({ columns: 99 }))).toBe(24);
  });
});

describe("gridContainerStyle", () => {
  it("builds a repeat() track template for the column count", () => {
    expect(gridContainerStyle(grid({ columns: 3 }), 16).gridTemplateColumns).toBe("repeat(3, minmax(0, 1fr))");
  });

  it("falls back to the gutter for both gaps when none are set", () => {
    const style = gridContainerStyle(grid(), 20);

    expect(style.columnGap).toBe(20);
    expect(style.rowGap).toBe(20);
  });

  it("prefers gap over the gutter and rowGap over gap", () => {
    const style = gridContainerStyle(grid({ gap: 8, rowGap: 4 }), 20);

    expect(style.columnGap).toBe(8);
    expect(style.rowGap).toBe(4);
  });
});

describe("gridCellStyle", () => {
  it("omits gridColumn for a single-column cell", () => {
    expect(gridCellStyle(undefined, 3).gridColumn).toBeUndefined();
    expect(gridCellStyle(1, 3).gridColumn).toBeUndefined();
  });

  it("spans several columns when the span exceeds one", () => {
    expect(gridCellStyle(2, 3).gridColumn).toBe("span 2");
  });

  it("clamps a span above the column count", () => {
    expect(gridCellStyle(5, 3).gridColumn).toBe("span 3");
  });
});
