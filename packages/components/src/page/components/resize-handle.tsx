import type { MouseEvent, ReactElement } from "react";

import * as styles from "../styles";

export interface ResizeHandleProps {
  isDragging: boolean;
  position: "left" | "right";
  onMouseDown: (event: MouseEvent) => void;
}

export function ResizeHandle({
  isDragging,
  position,
  onMouseDown
}: ResizeHandleProps): ReactElement {
  const positionStyle = position === "left"
    ? styles.resizeHandleLeft
    : styles.resizeHandleRight;

  return (
    <div
      css={[styles.resizeHandleGrip, positionStyle]}
      data-dragging={isDragging}
      onMouseDown={onMouseDown}
    />
  );
}
