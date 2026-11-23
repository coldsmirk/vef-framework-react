import type { EditableColumn } from "@vef-framework-react/components";
import type { ReactNode } from "react";

import type { Block, FieldOption, FieldOptionSource, KeyedFormField, SubformNode } from "../types";
import type { FormRendererProps } from "./form-renderer";

import { createEditableColumn, filterOptionByLabel, Flex, Text } from "@vef-framework-react/components";
import { DEFAULT_DATETIME_FORMAT, getDateGranularityFormat } from "@vef-framework-react/shared";

import { isKeyedField, isValidatableField } from "../engine/keys";
import { antdPickerForGranularity } from "../engine/schema/date-granularity";
import { isContainerNode } from "../engine/schema/walk";
import { validateKeyedFieldValue } from "./submit";

/**
 * A subform row is a flat record keyed by the template fields' `key`s. The
 * `table` variant edits it through the components `EditableTable`, one column
 * per template leaf field — mapping each field type to the matching `EditableTable`
 * cell editor (`fieldComponents`). The two systems share a TanStack-Form
 * foundation, so the editors bind to the row's draft form directly.
 */
type Row = Record<string, unknown>;

/**
 * The loaded options of the form's data dictionaries, keyed by code set.
 */
export type CodeSetOptions = Readonly<Record<string, FieldOption[]>> | undefined;

/**
 * A column's options: an inline static list, or a data dictionary the form has
 * already loaded in its batched code-set call. A remote / `ref` data source
 * needs the async resolver and renders with no options for now (a documented
 * follow-up); the column still edits the value.
 */
export function columnOptions(source: FieldOptionSource | undefined, codeSets: CodeSetOptions): Array<{ label: string; value: string }> {
  let options: FieldOption[] = [];

  if (source?.kind === "static") {
    options = source.options;
  } else if (source?.kind === "codeSet") {
    options = codeSets?.[source.codeSet] ?? [];
  }

  // The components select / radio / checkbox fields take string-valued options;
  // coerce here (a numeric option value renders as its string form in a table
  // cell — v1, acceptable for the common string-keyed case).
  return options.map(option => {
    return { label: option.label, value: String(option.value) };
  });
}

/**
 * Whether the field carries a static `required` rule. A switch is keyed but not
 * `Validatable`, so the shared `isValidatableField` guard keeps the `validate`
 * access type-safe without a cast.
 */
function isRequired(field: KeyedFormField): boolean {
  return isValidatableField(field) && field.validate?.required === true;
}

/**
 * Map one keyed template field to its table column.
 *
 * The per-type editor switch below is mirrored (statically) by the canvas
 * preview's `SampleCell` (`editor/canvas/subform-table-cell.tsx`) — `field.type`
 * is host-extensible, so neither switch can be exhaustive; when adding a type
 * here, add its preview there too or the canvas degrades to a muted dash.
 */
function columnFor(field: KeyedFormField, codeSets: CodeSetOptions): EditableColumn<Row> {
  const title = field.label ?? field.key;
  // Fixed pixel width when the author set one; `undefined` lets the column
  // auto-distribute the table's remaining width (the `EditableTable` default).
  const width = field.columnWidth;
  const validators = {
    onChange: ({ value }: { value: unknown }): string | undefined => validateKeyedFieldValue(field, isRequired(field), value)
  };

  switch (field.type) {
    case "textfield": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.Input noWrapper maxLength={field.maxLength} placeholder={field.placeholder} />
      });
    }

    case "textarea": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.TextArea noWrapper maxLength={field.maxLength} placeholder={field.placeholder} />
      });
    }

    case "number": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => (
          <f.InputNumber
            noWrapper
            max={field.max}
            min={field.min}
            placeholder={field.placeholder}
            precision={field.precision}
            step={field.step}
          />
        )
      });
    }

    case "select": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => (
          <f.Select
            noWrapper
            allowClear={field.allowClear}
            filterOption={filterOptionByLabel}
            options={columnOptions(field.dataSource, codeSets)}
            placeholder={field.placeholder}
            showSearch={field.showSearch}
          />
        )
      });
    }

    case "multi-select": {
      const maxCount = field.maxCount !== undefined && field.maxCount > 0 ? field.maxCount : undefined;

      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => (
          <f.Select
            noWrapper
            allowClear={field.allowClear}
            filterOption={filterOptionByLabel}
            maxCount={maxCount}
            mode="multiple"
            options={columnOptions(field.dataSource, codeSets)}
            placeholder={field.placeholder}
            showSearch={field.showSearch === true}
          />
        )
      });
    }

    case "radio": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.Radio noWrapper options={columnOptions(field.dataSource, codeSets)} />
      });
    }

    case "checkbox-group": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.CheckboxGroup noWrapper options={columnOptions(field.dataSource, codeSets)} />
      });
    }

    case "switch": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.Bool noWrapper />
      });
    }

    case "date": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => (
          <f.DatePicker
            noWrapper
            format={getDateGranularityFormat(field.granularity)}
            picker={antdPickerForGranularity(field.granularity)}
            placeholder={field.placeholder}
          />
        )
      });
    }

    case "datetime": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.DatePicker noWrapper showTime format={DEFAULT_DATETIME_FORMAT} placeholder={field.placeholder} />
      });
    }

    case "daterange": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => (
          <f.DateRangePicker
            noWrapper
            format={getDateGranularityFormat(field.granularity)}
            picker={antdPickerForGranularity(field.granularity)}
          />
        )
      });
    }

    default: {
      // code-editor (and any future keyed leaf without a table editor): show the
      // stored value read-only rather than crash. The table-variant validation
      // steers authors away from these as columns.
      return createEditableColumn<Row>(field.key, { title, width });
    }
  }
}

/**
 * Build the `EditableTable` columns for a subform template, one per keyed leaf
 * field in document order. Non-keyed blocks are dropped.
 */
export function buildSubformColumns(
  template: Block[],
  codeSets?: CodeSetOptions,
  extras?: { subform: SubformNode; render: NonNullable<FormRendererProps["renderFieldExtra"]> }
): Array<EditableColumn<Row>> {
  const columns: Array<EditableColumn<Row>> = [];

  for (const field of template) {
    if (isContainerNode(field) || !isKeyedField(field)) {
      continue;
    }

    const column = columnFor(field, codeSets);

    if (!extras) {
      columns.push(column);
      continue;
    }

    const { subform, render } = extras;
    const leading = columns.length === 0;
    const location = {
      key: subform.key,
      column: field.key,
      type: field.type,
      label: field.label
    };
    const header = render(location);
    const editor = column.renderEditor;

    function cell(value: ReactNode, row: number) {
      const heading = leading && subformRowHeading(subform, row, render);
      const extra = render({ ...location, row });

      if (!heading && (extra === null || extra === undefined)) {
        return value;
      }

      return (
        <>
          {heading}
          {value}
          {extra}
        </>
      );
    }

    columns.push({
      ...column,
      title: header === null || header === undefined
        ? column.title
        : (
            <span>
              {field.label ?? field.key}
              {header}
            </span>
          ),
      renderView: (value, record, index) => cell(column.renderView ? column.renderView(value, record, index) : value as ReactNode, index),
      renderEditor: editor && ((bound, context) => cell(editor(bound, context), context.index))
    });
  }

  return columns;
}

export function subformRowHeading(subform: SubformNode, row: number, render?: FormRendererProps["renderFieldExtra"]) {
  const extra = render?.({
    key: subform.key,
    type: subform.type,
    label: subform.label,
    row
  });
  return (extra === null || extra === undefined)
    ? null
    : (
        <Flex align="center" gap={4} wrap="wrap">
          <Text strong>{`第 ${row + 1} 行`}</Text>
          {extra}
        </Flex>
      );
}
