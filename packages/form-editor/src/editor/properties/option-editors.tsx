import type { DragEndEvent } from "@vef-framework-react/core";
import type { ChangeEvent, ReactElement } from "react";

import type { FieldOption } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input } from "@vef-framework-react/components";
import { DragDropProvider, moveDragItem, RestrictToVerticalAxis, useSortable } from "@vef-framework-react/core";
import { useRef, useState } from "react";

import { findDuplicateOptionValues } from "../../engine/options";
import { EditorIcon } from "../../icons";

const emptyCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

const optionRowCss = css({
  display: "flex",
  alignItems: "center",
  gap: 8
});

const reorderCss = css({
  width: 24,
  height: 24,
  padding: 0,
  flexShrink: 0
});

// The drag grip that reorders a row. Quiet by default, brightening on
// hover/focus; focusable so dnd-kit's KeyboardSensor can pick the row up with
// Enter and move it with the arrow keys.
const dragHandleCss = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
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

// The row lifts to a solid, shadowed surface while dragging so it reads as
// picked-up above its neighbours.
const optionRowDraggingCss = css({
  borderRadius: globalCssVars.borderRadius,
  background: globalCssVars.colorBgElevated,
  boxShadow: globalCssVars.shadowLg
});

const duplicateWarningCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorWarningText,
  lineHeight: 1.5
});

const footerActionsCss = css({
  display: "flex",
  gap: 8
});

const bulkPanelCss = css({
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  borderRadius: globalCssVars.borderRadius,
  border: `1px solid ${globalCssVars.colorBorderSecondary}`,
  background: globalCssVars.colorFillQuaternary
});

const bulkHintCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary,
  lineHeight: 1.4
});

const bulkActionsCss = css({
  display: "flex",
  justifyContent: "flex-end",
  gap: 8
});

export interface OptionListEditorProps {
  options: FieldOption[];
  onChange: (next: FieldOption[]) => void;
  /**
   * Offer a "批量粘贴" inline mode (one item per line, auto-generating unique
   * `item_N` values) for long lists such as fixed-row checklist items.
   */
  allowBulkPaste?: boolean;
}

/**
 * Parse newline-separated lines into `{ label, value }` options, trimming each
 * line and skipping blank lines. Values are minted sequentially as `item_1`,
 * `item_2`, … skipping any value already present in `existingValues`.
 */
export function parseBulkOptionLines(text: string, existingValues: ReadonlySet<string> = new Set()): FieldOption[] {
  const used = new Set(existingValues);
  const parsed: FieldOption[] = [];
  let seq = 1;

  for (const rawLine of text.split(/\r?\n/)) {
    const label = rawLine.trim();

    if (label.length === 0) {
      continue;
    }

    while (used.has(`item_${seq}`)) {
      seq += 1;
    }

    const value = `item_${seq}`;

    used.add(value);
    seq += 1;
    parsed.push({ label, value });
  }

  return parsed;
}

let optionRowIdCounter = 0;

/**
 * Mint an ephemeral row id. UI-only — keys editor rows while the list is being
 * edited and is never persisted into the schema.
 */
function nextOptionRowId(): string {
  optionRowIdCounter += 1;

  return `option-row-${optionRowIdCounter}`;
}

/**
 * Reorder an option list from a sortable drag. Drives off the UI-only row-id
 * array (the sortable item ids) so `moveDragItem` stays type-safe, then permutes
 * the options into the same order — the two lockstep arrays can never drift.
 * Returns `null` for a no-op (cancel / dropped in place), which the caller uses
 * to skip an empty commit. Exported so the reorder can be unit-tested with a
 * fabricated drag event, the same way the canvas drag-end handler is.
 */
export function reorderOptionRows(
  options: FieldOption[],
  rowIds: string[],
  event: DragEndEvent
): { options: FieldOption[]; rowIds: string[] } | null {
  const nextIds = moveDragItem(rowIds, event);

  if (nextIds === rowIds) {
    return null;
  }

  const optionByRowId = new Map(rowIds.map((rowId, index) => [rowId, options[index]] as const));
  const nextOptions = nextIds
    .map(rowId => optionByRowId.get(rowId))
    .filter((option): option is FieldOption => option !== undefined);

  return { options: nextOptions, rowIds: nextIds };
}

interface OptionRowProps {
  id: string;
  index: number;
  option: FieldOption;
  duplicated: boolean;
  onLabelChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onRemove: () => void;
}

/**
 * One sortable option row: a drag grip, the label/value inputs, and a delete
 * button. `useSortable` keys off the UI-only row `id` (never persisted into the
 * `{ label, value }` schema) and its `index`, so a drop reorders without ever
 * threading an id through the option value. The grip is the only drag
 * activator, so the inputs stay editable.
 */
function OptionRow({
  duplicated,
  id,
  index,
  onLabelChange,
  onRemove,
  onValueChange,
  option
}: OptionRowProps): ReactElement {
  const {
    handleRef,
    isDragging,
    ref
  } = useSortable({ id, index });

  return (
    <div ref={ref} css={[optionRowCss, isDragging && optionRowDraggingCss]}>
      <span
        ref={handleRef}
        aria-label="拖动排序"
        css={dragHandleCss}
        role="button"
        tabIndex={0}
        title="拖动排序"
      >
        <EditorIcon name="grip-vertical" />
      </span>

      <Input
        placeholder="标签"
        value={option.label}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onLabelChange(event.target.value)}
      />

      <Input
        placeholder="值"
        status={duplicated ? "warning" : undefined}
        value={String(option.value)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onValueChange(event.target.value)}
      />

      <Button
        aria-label="删除选项"
        css={reorderCss}
        icon={<EditorIcon name="trash-2" />}
        size="small"
        type="text"
        onClick={onRemove}
      />
    </div>
  );
}

/**
 * Inline editor for a positional `{ label, value }` option list. Shared by the
 * field option-source entry, the fixed-row subform source editor, and the
 * form-global data-source panel so the row layout, empty hint, and value
 * coercion live in exactly one place. The editor authors STRING option values:
 * a backend-sourced numeric value renders via `String()` and is committed back
 * as a string once edited.
 *
 * Options carry no persistent id, so rows are keyed by ephemeral local ids
 * kept in lockstep with every list mutation made here — removing a middle row
 * keeps each surviving editor (and its focus) pinned to its logical row. Ids are
 * re-minted only when the list LENGTH changes out from under the editor (an
 * add/remove elsewhere, a source switch); a same-length external edit (e.g. an
 * undo that swaps values without changing the count) keeps the existing ids, so
 * a focused cell may briefly pin to the wrong logical row.
 */
export function OptionListEditor({
  allowBulkPaste = false,
  onChange,
  options
}: OptionListEditorProps): ReactElement {
  const rowIdsRef = useRef<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  if (rowIdsRef.current.length !== options.length) {
    rowIdsRef.current = options.map(() => nextOptionRowId());
  }

  const rowIds = rowIdsRef.current;
  const duplicated = findDuplicateOptionValues(options);

  const setRow = (index: number, patch: Partial<FieldOption>): void => {
    onChange(options.map((option, current) => current === index ? { ...option, ...patch } : option));
  };

  const removeRow = (index: number): void => {
    rowIdsRef.current = rowIds.filter((_id, current) => current !== index);
    onChange(options.filter((_option, current) => current !== index));
  };

  const addRow = (): void => {
    rowIdsRef.current = [...rowIds, nextOptionRowId()];
    onChange([...options, { label: "", value: "" }]);
  };

  const applyBulkPaste = (mode: "append" | "replace"): void => {
    const existingValues = mode === "append" ? new Set(options.map(option => String(option.value))) : new Set<string>();
    const parsed = parseBulkOptionLines(bulkText, existingValues);

    if (parsed.length === 0) {
      setBulkOpen(false);
      setBulkText("");
      return;
    }

    const next = mode === "append" ? [...options, ...parsed] : parsed;

    rowIdsRef.current = next.map(() => nextOptionRowId());
    onChange(next);
    setBulkOpen(false);
    setBulkText("");
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    // History coalesces per property entry, so the reorder is one undoable step.
    const result = reorderOptionRows(options, rowIds, event);

    if (result === null) {
      return;
    }

    rowIdsRef.current = result.rowIds;
    onChange(result.options);
  };

  return (
    <>
      {options.length === 0 ? <span css={emptyCss}>暂无选项</span> : null}

      {/* Scoped to its own DragDropProvider so an option-row drag never routes
          into the editor canvas's drag context (the properties panel renders
          inside the canvas provider). Restricted to the vertical axis, as a
          plain reorderable list. */}
      <DragDropProvider modifiers={[RestrictToVerticalAxis]} onDragEnd={handleDragEnd}>
        {options.map((option, index) => {
          const id = rowIds[index];

          // rowIds is kept in lockstep with options (synced at the top of the
          // component), so an id is always present here — the guard just
          // satisfies the index access under `noUncheckedIndexedAccess`.
          if (id === undefined) {
            return null;
          }

          return (
            <OptionRow
              key={id}
              duplicated={duplicated.includes(String(option.value))}
              id={id}
              index={index}
              option={option}
              onLabelChange={label => setRow(index, { label })}
              onRemove={() => removeRow(index)}
              onValueChange={value => setRow(index, { value })}
            />
          );
        })}
      </DragDropProvider>

      {duplicated.length > 0
        ? <span css={duplicateWarningCss}>{`选项值重复：${duplicated.join("、")}`}</span>
        : null}

      {bulkOpen
        ? (
            <div css={bulkPanelCss}>
              <span css={bulkHintCss}>每行一项，空行自动忽略；系统将自动生成唯一值</span>

              <Input.TextArea
                aria-label="批量粘贴行项目"
                autoSize={{ minRows: 4, maxRows: 10 }}
                placeholder={"例如：\n第一项\n第二项\n第三项"}
                value={bulkText}
                onChange={event => setBulkText(event.target.value)}
              />

              <div css={bulkActionsCss}>
                <Button
                  size="small"
                  onClick={() => {
                    setBulkOpen(false);
                    setBulkText("");
                  }}
                >
                  取消
                </Button>

                {options.length > 0
                  ? (
                      <Button size="small" onClick={() => applyBulkPaste("append")}>
                        追加
                      </Button>
                    )
                  : null}

                <Button size="small" type="primary" onClick={() => applyBulkPaste("replace")}>
                  {options.length > 0 ? "替换全部" : "导入"}
                </Button>
              </div>
            </div>
          )
        : (
            <div css={footerActionsCss}>
              <Button block icon={<EditorIcon name="plus" />} type="dashed" onClick={addRow}>
                添加选项
              </Button>

              {allowBulkPaste
                ? (
                    <Button block icon={<EditorIcon name="clipboard-list" />} onClick={() => setBulkOpen(true)}>
                      批量粘贴
                    </Button>
                  )
                : null}
            </div>
          )}
    </>
  );
}
