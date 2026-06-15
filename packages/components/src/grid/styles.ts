import { css } from "@emotion/react";

export const gridColumns = 24;

export const grid = css({
  display: "grid",
  width: "100%",
  gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`,
  columnGap: "var(--vef-grid-column-gap, 0)",
  rowGap: "var(--vef-grid-row-gap, 0)"
});

export const gridItem = css({
  gridColumn: "var(--vef-grid-item-column, span 1)",
  marginLeft: "var(--vef-grid-item-margin-left, 0)",
  "&.hidden": {
    display: "none"
  }
});
