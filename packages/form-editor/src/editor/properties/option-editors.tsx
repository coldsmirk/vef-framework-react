import type { ChangeEvent, ReactElement } from "react";

import type { FieldOption, RemoteDataSourceRequest, RemoteOptionMapping } from "../../types";

import { css } from "@emotion/react";
import { Button, globalCssVars, Input } from "@vef-framework-react/components";
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

  const moveRow = (index: number, offset: -1 | 1): void => {
    const target = index + offset;
    const sourceId = rowIds[index];
    const targetId = rowIds[target];
    const sourceOption = options[index];
    const targetOption = options[target];

    // Doubles as the bounds check (the edge rows' buttons are disabled).
    if (sourceId === undefined || targetId === undefined || sourceOption === undefined || targetOption === undefined) {
      return;
    }

    const nextIds = [...rowIds];
    const nextOptions = [...options];

    nextIds[index] = targetId;
    nextIds[target] = sourceId;
    nextOptions[index] = targetOption;
    nextOptions[target] = sourceOption;

    rowIdsRef.current = nextIds;
    onChange(nextOptions);
  };

  return (
    <>
      {options.length === 0 ? <span css={emptyCss}>暂无选项</span> : null}

      {options.map((option, index) => (
        <div key={rowIds[index]} css={optionRowCss}>
          <Input
            placeholder="标签"
            value={option.label}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setRow(index, { label: event.target.value })}
          />

          <Input
            placeholder="值"
            status={duplicated.includes(String(option.value)) ? "warning" : undefined}
            value={String(option.value)}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setRow(index, { value: event.target.value })}
          />

          <Button
            aria-label="上移选项"
            css={reorderCss}
            disabled={index === 0}
            icon={<EditorIcon name="chevron-up" />}
            size="small"
            type="text"
            onClick={() => moveRow(index, -1)}
          />

          <Button
            aria-label="下移选项"
            css={reorderCss}
            disabled={index === options.length - 1}
            icon={<EditorIcon name="chevron-down" />}
            size="small"
            type="text"
            onClick={() => moveRow(index, 1)}
          />

          <Button
            aria-label="删除选项"
            css={reorderCss}
            icon={<EditorIcon name="trash-2" />}
            size="small"
            type="text"
            onClick={() => removeRow(index)}
          />
        </div>
      ))}

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
