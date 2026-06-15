import type { SerializedStyles } from "@emotion/react";
import type { ReactNode } from "react";

import type { AsideWidth, ResizableWidth } from "../props";

import { isPlainObject } from "@vef-framework-react/shared";

import { getSpacingValue } from "../../_base";
import { useResize } from "../hooks";
import * as styles from "../styles";
import { ResizeHandle } from "./resize-handle";

export interface AsidePanelProps {
  children: ReactNode;
  className?: string;
  containerStyle: SerializedStyles;
  position: "left" | "right";
  width?: AsideWidth;
}

const DEFAULT_WIDTH = 280;

function isResizableWidth(width: AsideWidth | undefined): width is ResizableWidth {
  return isPlainObject(width);
}

function getDefaultWidth(width: AsideWidth | undefined): number {
  if (!width) {
    return DEFAULT_WIDTH;
  }

  if (isResizableWidth(width)) {
    const w = width.defaultWidth;

    return typeof w === "number" ? w : DEFAULT_WIDTH;
  }

  return typeof width === "number" ? width : DEFAULT_WIDTH;
}

function getLengthAsNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

export function AsidePanel({
  children,
  className,
  containerStyle,
  position,
  width
}: AsidePanelProps) {
  const isResizable = isResizableWidth(width);
  const defaultWidth = getDefaultWidth(width);

  const minWidth = isResizable ? getLengthAsNumber(width.minWidth) : undefined;
  const maxWidth = isResizable ? getLengthAsNumber(width.maxWidth) : undefined;

  const {
    width: currentWidth,
    isDragging,
    handleMouseDown
  } = useResize({
    defaultWidth,
    minWidth,
    maxWidth,
    isLeftPanel: position === "left"
  });

  const finalWidth = isResizable ? currentWidth : defaultWidth;
  const widthValue = isResizable
    ? `${finalWidth}px`
    : getSpacingValue(width ?? DEFAULT_WIDTH);

  return (
    <div
      className={className}
      css={containerStyle}
      style={{ width: widthValue, position: "relative" }}
    >
      <div css={styles.asideContent}>
        {children}
      </div>

      {isResizable && (
        <ResizeHandle
          isDragging={isDragging}
          position={position}
          onMouseDown={handleMouseDown}
        />
      )}
    </div>
  );
}
