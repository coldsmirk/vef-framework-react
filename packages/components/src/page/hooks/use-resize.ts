import type { MouseEvent as ReactMouseEvent } from "react";

import { useCallback, useState } from "react";

export interface UseResizeOptions {
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  /**
   * true for left panel (drag right to increase), false for right panel (drag left to increase)
   */
  isLeftPanel?: boolean;
}

function clamp(value: number, min?: number, max?: number): number {
  if (min !== undefined && value < min) {
    return min;
  }

  if (max !== undefined && value > max) {
    return max;
  }

  return value;
}

export function useResize(options: UseResizeOptions) {
  const {
    defaultWidth,
    minWidth,
    maxWidth,
    isLeftPanel = true
  } = options;
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((event: ReactMouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      // Left panel: drag right increases width; Right panel: drag left increases width
      const newWidth = isLeftPanel ? startWidth + delta : startWidth - delta;
      setWidth(clamp(newWidth, minWidth, maxWidth));
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [width, minWidth, maxWidth, isLeftPanel]);

  return {
    width,
    isDragging,
    handleMouseDown
  };
}
