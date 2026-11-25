import type { DragEndEvent } from "@vef-framework-react/core";
import type { ReactElement } from "react";

import { css } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";
import { moveDragItem } from "@vef-framework-react/core";
import { useRef } from "react";

import { EditorIcon } from "../../icons";

// The grip that reorders a row. Quiet by default, brightening on hover/focus;
// focusable so dnd-kit's KeyboardSensor can pick the row up with Enter and move
// it with the arrow keys.
const handleCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 22,
  height: 22,
  flexShrink: 0,
  borderRadius: globalCssVars.borderRadiusSm,
  color: globalCssVars.colorTextTertiary,
  cursor: "grab",
  transition: [
    `color ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`,
    `background ${globalCssVars.motionDurationFast} ${globalCssVars.motionEaseOut}`
  ].join(", "),

  "&:hover": {
    color: globalCssVars.colorText,
    background: globalCssVars.colorFillTertiary
  },

  "&:focus-visible": {
    outline: "none",
    color: globalCssVars.colorText,
    background: globalCssVars.colorFillTertiary,
    boxShadow: `0 0 0 2px ${globalCssVars.colorPrimaryBorder}`
  },

  "&:active": {
    cursor: "grabbing"
  },

  "& > svg": {
    width: 14,
    height: 14
  }
});

/**
 * A dragged row lifts to a solid, shadowed surface so it reads as picked up
 * above its neighbours.
 */
export const draggingRowCss = css({
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgElevated,
  boxShadow: globalCssVars.shadowLg
});

export interface DragHandleProps {
  handleRef: (element: Element | null) => void;
  label?: string;
}

export function DragHandle({ handleRef, label = "拖动排序" }: DragHandleProps): ReactElement {
  return (
    <span
      ref={handleRef}
      aria-label={label}
      css={handleCss}
      role="button"
      tabIndex={0}
      title="拖动排序"
    >
      <EditorIcon name="grip-vertical" />
    </span>
  );
}

let rowIdCounter = 0;

function nextRowId(): string {
  rowIdCounter += 1;

  return `sortable-row-${rowIdCounter}`;
}

/**
 * Reorder rows from a sortable drag. Drives off the row ids (the sortable item
 * ids) and permutes the rows into the same order, so the two can never drift.
 * `null` for a no-op (cancelled, or dropped in place), which the caller uses to
 * skip an empty commit.
 */
export function reorderRows<T>(
  rows: readonly T[],
  ids: string[],
  event: DragEndEvent
): { rows: T[]; ids: string[] } | null {
  const nextIds = moveDragItem(ids, event);

  if (nextIds === ids) {
    return null;
  }

  return {
    rows: nextIds.flatMap(id => rows.slice(ids.indexOf(id), ids.indexOf(id) + 1)),
    ids: nextIds
  };
}

export interface SortableRows<T> {
  /**
   * One id per row, in row order.
   */
  ids: readonly string[];
  append: (added: readonly T[]) => void;
  remove: (index: number) => void;
  replaceAll: (next: T[]) => void;
  update: (index: number, next: T) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

/**
 * Edits a positional list whose rows carry no persistent id, keying them by
 * ephemeral ids kept in lockstep with every change made here — so removing or
 * moving a row keeps each surviving editor (and its focus) on its own row. Ids
 * are minted anew when the list changes length from elsewhere.
 */
export function useSortableRows<T>(rows: readonly T[], onChange: (next: T[]) => void): SortableRows<T> {
  const idsRef = useRef<string[]>([]);

  if (idsRef.current.length !== rows.length) {
    idsRef.current = rows.map(() => nextRowId());
  }

  const commit = (ids: string[], next: T[]): void => {
    idsRef.current = ids;
    onChange(next);
  };

  return {
    ids: idsRef.current,
    append: added => commit([...idsRef.current, ...added.map(() => nextRowId())], [...rows, ...added]),
    remove: index => commit(idsRef.current.toSpliced(index, 1), rows.toSpliced(index, 1)),
    replaceAll: next => commit(next.map(() => nextRowId()), next),
    update: (index, next) => onChange(rows.with(index, next)),
    handleDragEnd: event => {
      const result = reorderRows(rows, idsRef.current, event);

      if (result !== null) {
        commit(result.ids, result.rows);
      }
    }
  };
}
