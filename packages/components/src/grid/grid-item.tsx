import type { CSSProperties } from "react";

import type { GridItemProps } from "./props";

import { useMemo } from "react";

import { useGridContext } from "./context";
import * as styles from "./styles";

export const defaultSpan = 1;
export const defaultOffset = 0;

export function GridItem({
  span = defaultSpan,
  offset = defaultOffset,
  suffix = false,
  style,
  ...props
}: GridItemProps) {
  const { gridColumns } = useGridContext();

  // Calculate grid item styles
  const itemStyle: CSSProperties = useMemo(() => {
    const childSpan = span as number;
    const childOffset = offset as number;

    const baseStyle = {
      "--vef-grid-item-column": suffix
        ? `${gridColumns + 1 - childSpan} / span ${childSpan}`
        : `span ${childSpan}`,
      ...childOffset > 0 && !suffix
        ? {
            "--vef-grid-item-margin-left": `calc(100% * ${childOffset} / ${childSpan})`
          }
        : {}
    };

    return {
      ...baseStyle,
      ...style
    };
  }, [span, offset, suffix, gridColumns, style]);

  return (
    <div
      {...props}
      css={styles.gridItem}
      style={itemStyle}
    />
  );
}

export { type GridItemProps } from "./props";
