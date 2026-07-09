import type { DragEndEvent } from "@vef-framework-react/core";
import type { ChangeEvent, ReactElement } from "react";

import type { FieldOption, RemoteDataSourceRequest, RemoteOptionMapping } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input } from "@vef-framework-react/components";
import { DragDropProvider, moveDragItem, RestrictToVerticalAxis, useSortable } from "@vef-framework-react/core";
import { useRef } from "react";

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

const gridCss = css({
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 8
});

export interface OptionListEditorProps {
  options: FieldOption[];
  onChange: (next: FieldOption[]) => void;
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

/**
 * The option VALUES that appear more than once in the list. Surfaced as an
 * inline warning (duplicates make selections ambiguous at runtime) — never
 * silently deduplicated, since the user may be mid-edit.
 */
function duplicateValues(options: FieldOption[]): string[] {
  const seen = new Set<string>();
  const duplicated = new Set<string>();

  for (const option of options) {
    const value = String(option.value);

    if (seen.has(value)) {
      duplicated.add(value);
    }

    seen.add(value);
  }

  return [...duplicated];
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
 * field option-source entry and the form-global data-source panel so the row
 * layout, empty hint, and value coercion live in exactly one place. The editor
 * authors STRING option values: a backend-sourced numeric value renders via
 * `String()` and is committed back as a string once edited.
 *
 * Options carry no persistent id, so rows are keyed by ephemeral local ids
 * kept in lockstep with every list mutation made here — removing a middle row
 * keeps each surviving editor (and its focus) pinned to its logical row. Ids are
 * re-minted only when the list LENGTH changes out from under the editor (an
 * add/remove elsewhere, a source switch); a same-length external edit (e.g. an
 * undo that swaps values without changing the count) keeps the existing ids, so
 * a focused cell may briefly pin to the wrong logical row.
 */
export function OptionListEditor({ onChange, options }: OptionListEditorProps): ReactElement {
  const rowIdsRef = useRef<string[]>([]);

  if (rowIdsRef.current.length !== options.length) {
    rowIdsRef.current = options.map(() => nextOptionRowId());
  }

  const rowIds = rowIdsRef.current;
  const duplicated = duplicateValues(options);

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

      <Button block icon={<EditorIcon name="plus" />} type="dashed" onClick={addRow}>
        添加选项
      </Button>
    </>
  );
}

export interface RemoteRequestFieldsProps {
  request: RemoteDataSourceRequest;
  mapping: RemoteOptionMapping | undefined;
  onChange: (request: RemoteDataSourceRequest, mapping: RemoteOptionMapping | undefined) => void;
}

/**
 * The resource / action / labelKey / valueKey editor for a remote option
 * request. Shared by the field option-source entry and the form-global
 * data-source panel; an all-empty mapping is normalized back to `undefined`.
 */
export function RemoteRequestFields({
  mapping,
  onChange,
  request
}: RemoteRequestFieldsProps): ReactElement {
  const patchRequest = (patch: Partial<RemoteDataSourceRequest>): void => {
    onChange({ ...request, ...patch }, mapping);
  };

  const patchMapping = (patch: Partial<RemoteOptionMapping>): void => {
    const next: RemoteOptionMapping = { ...mapping, ...patch };
    const hasMapping = Object.values(next).some(value => typeof value === "string" && value.length > 0);
    onChange(request, hasMapping ? next : undefined);
  };

  return (
    <>
      <div css={gridCss}>
        <Input placeholder="resource" value={request.resource} onChange={event => patchRequest({ resource: event.target.value })} />
        <Input placeholder="action" value={request.action} onChange={event => patchRequest({ action: event.target.value })} />
      </div>

      <div css={gridCss}>
        <Input placeholder="labelKey（默认 label）" value={mapping?.labelKey ?? ""} onChange={event => patchMapping({ labelKey: event.target.value })} />
        <Input placeholder="valueKey（默认 value）" value={mapping?.valueKey ?? ""} onChange={event => patchMapping({ valueKey: event.target.value })} />
      </div>
    </>
  );
}
