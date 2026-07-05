import type { EditableColumn } from "@vef-framework-react/components";

import type { Block, FieldOptionSource, KeyedFormField } from "../types";

import { createEditableColumn } from "@vef-framework-react/components";
import { DEFAULT_DATE_FORMAT, DEFAULT_DATETIME_FORMAT } from "@vef-framework-react/shared";

import { isKeyedField, isValidatableField } from "../engine/keys";
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
 * Inline static option list — the only source resolved synchronously here. A
 * remote / `ref` data source needs the async resolver and renders with no
 * options for now (a documented follow-up); the column still edits the value.
 */
function staticOptions(source: FieldOptionSource | undefined): Array<{ label: string; value: string }> {
  // The components select / radio / checkbox fields take string-valued options;
  // coerce here (a numeric option value renders as its string form in a table
  // cell — v1, acceptable for the common string-keyed case).
  return source?.kind === "static"
    ? source.options.map(option => { return { label: option.label, value: String(option.value) }; })
    : [];
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
 * Map one template field to an `EditableTable` column, or `null` when it cannot
 * be a column (a non-keyed presentation / action field — the `table` variant's
 * validation rejects these, but the renderer skips them defensively too).
 *
 * The per-type editor switch below is mirrored (statically) by the canvas
 * preview's `SampleCell` (`editor/canvas/subform-table-cell.tsx`) — `field.type`
 * is host-extensible, so neither switch can be exhaustive; when adding a type
 * here, add its preview there too or the canvas degrades to a muted dash.
 */
function columnFor(field: Block): EditableColumn<Row> | null {
  if (isContainerNode(field) || !isKeyedField(field)) {
    return null;
  }

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
            options={staticOptions(field.dataSource)}
            placeholder={field.placeholder}
            showSearch={field.showSearch}
          />
        )
      });
    }

    case "radio": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.Radio noWrapper options={staticOptions(field.dataSource)} />
      });
    }

    case "checkbox-group": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.CheckboxGroup noWrapper options={staticOptions(field.dataSource)} />
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
        renderEditor: f => <f.DatePicker noWrapper format={DEFAULT_DATE_FORMAT} placeholder={field.placeholder} />
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
        renderEditor: f => <f.DateRangePicker noWrapper format={DEFAULT_DATE_FORMAT} />
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
export function buildSubformColumns(template: Block[]): Array<EditableColumn<Row>> {
  return template.map(block => columnFor(block)).filter((column): column is EditableColumn<Row> => column !== null);
}
