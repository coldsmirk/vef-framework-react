import type { EditableColumn } from "@vef-framework-react/components";
import type { ReactElement, ReactNode } from "react";

import type { RuntimeFormValues } from "../runtime/types";
import type {
  Block,
  CheckboxGroupField,
  FixedSubformRows,
  KeyedFormField,
  MultiSelectField,
  RadioField,
  SelectField,
  SubformNode
} from "../types";
import type { DataSourceParamScope } from "./data-source-param-scope";
import type { FormRendererProps } from "./form-renderer";

import { css } from "@emotion/react";
import {
  Checkbox,
  createEditableColumn,
  filterOptionByLabel,
  Flex,
  globalCssVars,
  Radio,
  Select,
  Spin,
  Text,
  useFormContext,
  useFormStore
} from "@vef-framework-react/components";
import { useDisabled } from "@vef-framework-react/core";
import { DEFAULT_DATETIME_FORMAT, getDateGranularityFormat } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { isKeyedField, isValidatableField } from "../engine/keys";
import { antdPickerForGranularity } from "../engine/schema/date-granularity";
import { fixedRowHeaderTitle } from "../engine/schema/subform";
import { isContainerNode } from "../engine/schema/walk";
import { isRecord } from "../engine/validation";
import { useFieldOptions } from "./data-source-context";
import { DataSourceParamScopeProvider, useDataSourceParamScope } from "./data-source-param-scope";
import { orderByOptions } from "./parts/option-order";
import { OptionsStatus } from "./parts/options-status";
import { resolveDateRangePlaceholderPair, resolveFieldPlaceholder } from "./parts/placeholder";
import { validateKeyedFieldValue } from "./submit";

/**
 * Per-row synthetic identity injected into `EditableTable`'s view value and
 * stripped before writing back to form state or exposing a row's record to
 * bound data-source parameter expressions.
 */
export const SUBFORM_ROW_ID = "__rid";

/**
 * A subform row is a flat record keyed by the template fields' `key`s. The
 * `table` variant edits it through the components `EditableTable`, one column
 * per template leaf field — mapping each field type to a cell editor bound to
 * the row's draft TanStack Form.
 */
type Row = Record<string, unknown>;

type TableSelectionField = SelectField | MultiSelectField | RadioField | CheckboxGroupField;

const fullWidthStyle = { width: "100%" } as const;
const EMPTY_MULTI_VALUE: Array<string | number> = [];

const columnHeaderCss = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 4
});

const requiredMarkCss = css({
  flexShrink: 0,
  color: globalCssVars.colorErrorText,
  fontWeight: 600
});

/**
 * Strip the synthetic `EditableTable` row key before handing a row record to
 * bound data-source parameter expressions, so `$form` inside a table column
 * matches the clean per-row record the stack variant publishes.
 */
function stripRowId(row: Row): RuntimeFormValues {
  if (!Object.hasOwn(row, SUBFORM_ROW_ID)) {
    return row;
  }

  const clean: RuntimeFormValues = { ...row };
  delete clean[SUBFORM_ROW_ID];

  return clean;
}

/**
 * Publishes the currently-editing row's live draft values as the bound-param
 * scope for selection cell editors, inheriting host context and evaluators
 * from the enclosing form scope. Bails with zero store subscriptions when the
 * schema binds no data-source parameter at all (`parentScope === undefined`).
 */
function RowDraftParamScope({ children }: { children: ReactNode }): ReactElement {
  const parentScope = useDataSourceParamScope();

  if (!parentScope) {
    return <>{children}</>;
  }

  return <RowDraftParamScopeActive parentScope={parentScope}>{children}</RowDraftParamScopeActive>;
}

function RowDraftParamScopeActive({
  children,
  parentScope
}: {
  children: ReactNode;
  parentScope: DataSourceParamScope;
}): ReactElement {
  const form = useFormContext<Row>();
  const draftValues = useFormStore(form.store, state => state.values);
  const rowValues = useMemo(() => stripRowId(draftValues), [draftValues]);

  return (
    <DataSourceParamScopeProvider
      context={parentScope.context}
      evaluators={parentScope.evaluators}
      values={rowValues}
    >
      {children}
    </DataSourceParamScopeProvider>
  );
}

/**
 * Publishes a committed row's values as the bound-param scope for read-mode
 * option label resolution, mirroring {@link RowDraftParamScope} without
 * subscribing to the editing draft form.
 */
function RowReadParamScope({
  children,
  row
}: {
  children: ReactNode;
  row: Row;
}): ReactElement {
  const parentScope = useDataSourceParamScope();
  const rowValues = useMemo(() => parentScope ? stripRowId(row) : undefined, [parentScope, row]);

  if (!parentScope) {
    return <>{children}</>;
  }

  return (
    <DataSourceParamScopeProvider
      context={parentScope.context}
      evaluators={parentScope.evaluators}
      values={rowValues}
    >
      {children}
    </DataSourceParamScopeProvider>
  );
}

function normalizeSingleSelectionValue(value: unknown): string | number | undefined {
  return value === "" || value === null || value === undefined ? undefined : value as string | number;
}

/**
 * Whether the editing row's draft value for `key` currently fails its column
 * validators. The `f.*` editors of the other columns get this outline from
 * `withFormItem`'s validate status; the selection editors bind the draft form
 * directly, so they read the same field meta to show the same feedback.
 */
function useDraftFieldInvalid(key: string): boolean {
  const form = useFormContext<Row>();

  return useFormStore(form.store, state => (state.fieldMeta[key]?.errors.length ?? 0) > 0);
}

function SelectCellEditor({ field }: { field: SelectField }): ReactElement {
  const form = useFormContext<Row>();
  const value = useFormStore(form.store, state => state.values[field.key]);
  const invalid = useDraftFieldInvalid(field.key);
  const disabled = useDisabled();
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);

  return (
    <Select
      allowClear={field.allowClear}
      disabled={disabled}
      filterOption={filterOptionByLabel}
      loading={loading}
      notFoundContent={error && options.length === 0 ? "选项加载失败" : undefined}
      options={options}
      placeholder={resolveFieldPlaceholder(field)}
      popupMatchSelectWidth={false}
      showSearch={field.showSearch}
      status={error || invalid ? "error" : undefined}
      style={fullWidthStyle}
      value={normalizeSingleSelectionValue(value)}
      onChange={(next: string | number | undefined) => form.setFieldValue(field.key, next ?? "")}
    />
  );
}

function MultiSelectCellEditor({ field }: { field: MultiSelectField }): ReactElement {
  const form = useFormContext<Row>();
  const value = useFormStore(form.store, state => state.values[field.key]);
  const invalid = useDraftFieldInvalid(field.key);
  const disabled = useDisabled();
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);
  const maxCount = field.maxCount !== undefined && field.maxCount > 0 ? field.maxCount : undefined;

  return (
    <Select
      allowClear={field.allowClear}
      disabled={disabled}
      filterOption={filterOptionByLabel}
      loading={loading}
      maxCount={maxCount}
      mode="multiple"
      notFoundContent={error && options.length === 0 ? "选项加载失败" : undefined}
      options={options}
      placeholder={resolveFieldPlaceholder(field)}
      popupMatchSelectWidth={false}
      showSearch={field.showSearch === true}
      status={error || invalid ? "error" : undefined}
      style={fullWidthStyle}
      value={Array.isArray(value) ? value as Array<string | number> : EMPTY_MULTI_VALUE}
      onChange={(next: Array<string | number> | undefined) => form.setFieldValue(field.key, next ?? [])}
    />
  );
}

function RadioCellEditor({ field }: { field: RadioField }): ReactElement {
  const form = useFormContext<Row>();
  const value = useFormStore(form.store, state => state.values[field.key]);
  const disabled = useDisabled();
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);

  if (options.length === 0) {
    return <OptionsStatus error={error} loading={loading} />;
  }

  return (
    <Spin spinning={loading}>
      <Radio.Group
        disabled={disabled}
        options={options}
        value={normalizeSingleSelectionValue(value)}
        onChange={event => form.setFieldValue(field.key, event.target.value)}
      />
    </Spin>
  );
}

function CheckboxGroupCellEditor({ field }: { field: CheckboxGroupField }): ReactElement {
  const form = useFormContext<Row>();
  const value = useFormStore(form.store, state => state.values[field.key]);
  const disabled = useDisabled();
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);

  if (options.length === 0) {
    return <OptionsStatus error={error} loading={loading} />;
  }

  return (
    <Spin spinning={loading}>
      <Checkbox.Group
        disabled={disabled}
        options={options}
        value={Array.isArray(value) ? value as Array<string | number> : EMPTY_MULTI_VALUE}
        onChange={next => form.setFieldValue(field.key, orderByOptions(next, options))}
      />
    </Spin>
  );
}

function isEmptySelectionValue(multiple: boolean, value: unknown): boolean {
  if (multiple) {
    return !Array.isArray(value) || value.length === 0;
  }

  return value === undefined || value === null || value === "";
}

/**
 * Read-mode display for a selection column (`select` / `multi-select` /
 * `radio` / `checkbox-group`): translates stored scalar or array values to
 * their resolved option labels (falling back to the raw value while loading or
 * when an option is missing). Skips option resolution on empty cells so
 * unfilled table rows trigger no remote requests until edited or populated.
 */
function SelectionCellView({
  field,
  row,
  value
}: {
  field: TableSelectionField;
  row: Row;
  value: unknown;
}): ReactElement | null {
  const multiple = field.type === "multi-select" || field.type === "checkbox-group";

  if (isEmptySelectionValue(multiple, value)) {
    return null;
  }

  return (
    <RowReadParamScope row={row}>
      <SelectionCellViewResolved field={field} multiple={multiple} value={value} />
    </RowReadParamScope>
  );
}

function SelectionCellViewResolved({
  field,
  multiple,
  value
}: {
  field: TableSelectionField;
  multiple: boolean;
  value: unknown;
}): ReactElement {
  const { options } = useFieldOptions(field.dataSource);

  if (multiple) {
    const items = value as Array<string | number>;
    const labels = new Map(options.map(option => [option.value, option.label]));

    return <span>{items.map(item => labels.get(item) ?? String(item)).join("、")}</span>;
  }

  const matched = options.find(option => option.value === value);

  return <span>{matched ? matched.label : String(value)}</span>;
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
 * Column header title with the red required marker (matching `Label` and the
 * canvas `SubformColumn`) and any optional `renderFieldExtra` content. Returns
 * the bare string when neither applies.
 */
function renderColumnTitle(title: string, required: boolean, extra?: ReactNode): ReactNode {
  const hasExtra = extra !== null && extra !== undefined;

  if (!required && !hasExtra) {
    return title;
  }

  return (
    <span css={columnHeaderCss}>
      <span>{title}</span>
      {required ? <span aria-hidden="true" css={requiredMarkCss}>*</span> : null}
      {hasExtra ? extra : null}
    </span>
  );
}

/**
 * Map one keyed template field to its table column.
 *
 * The per-type editor switch below is mirrored (statically) by the canvas
 * preview's `SampleCell` (`editor/canvas/subform-table-cell.tsx`) — `field.type`
 * is host-extensible, so neither switch can be exhaustive; when adding a type
 * here, add its preview there too or the canvas degrades to a muted dash.
 */
function columnFor(field: KeyedFormField): EditableColumn<Row> {
  const required = isRequired(field);
  const title = renderColumnTitle(field.label ?? field.key, required);
  // Fixed pixel width when the author set one; `undefined` lets the column
  // auto-distribute the table's remaining width (the `EditableTable` default).
  const width = field.columnWidth;
  const validators = {
    onChange: ({ value }: { value: unknown }): string | undefined => validateKeyedFieldValue(field, required, value)
  };

  switch (field.type) {
    case "textfield": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.Input noWrapper maxLength={field.maxLength} placeholder={resolveFieldPlaceholder(field)} />
      });
    }

    case "textarea": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => <f.TextArea noWrapper maxLength={field.maxLength} placeholder={resolveFieldPlaceholder(field)} />
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
            placeholder={resolveFieldPlaceholder(field)}
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
        renderView: (value, record) => <SelectionCellView field={field} row={record} value={value} />,
        renderEditor: () => (
          <RowDraftParamScope>
            <SelectCellEditor field={field} />
          </RowDraftParamScope>
        )
      });
    }

    case "multi-select": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderView: (value, record) => <SelectionCellView field={field} row={record} value={value} />,
        renderEditor: () => (
          <RowDraftParamScope>
            <MultiSelectCellEditor field={field} />
          </RowDraftParamScope>
        )
      });
    }

    case "radio": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderView: (value, record) => <SelectionCellView field={field} row={record} value={value} />,
        renderEditor: () => (
          <RowDraftParamScope>
            <RadioCellEditor field={field} />
          </RowDraftParamScope>
        )
      });
    }

    case "checkbox-group": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderView: (value, record) => <SelectionCellView field={field} row={record} value={value} />,
        renderEditor: () => (
          <RowDraftParamScope>
            <CheckboxGroupCellEditor field={field} />
          </RowDraftParamScope>
        )
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
            placeholder={resolveFieldPlaceholder(field)}
          />
        )
      });
    }

    case "datetime": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderEditor: f => (
          <f.DatePicker
            noWrapper
            showTime
            format={DEFAULT_DATETIME_FORMAT}
            placeholder={resolveFieldPlaceholder(field)}
          />
        )
      });
    }

    case "daterange": {
      return createEditableColumn<Row>(field.key, {
        title,
        width,
        validators,
        renderView: value => Array.isArray(value) && value.length === 2 ? `${String(value[0])} 至 ${String(value[1])}` : null,
        renderEditor: f => (
          <f.DateRangePicker
            noWrapper
            format={getDateGranularityFormat(field.granularity)}
            picker={antdPickerForGranularity(field.granularity)}
            placeholder={resolveDateRangePlaceholderPair(field.granularity)}
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

export interface BuildSubformColumnsOptions {
  extras?: { subform: SubformNode; render: NonNullable<FormRendererProps["renderFieldExtra"]> };
  fixedRows?: FixedSubformRows;
}

/**
 * Build the `EditableTable` columns for a subform template, one per keyed leaf
 * field in document order. Non-keyed blocks are dropped. For a fixed-row
 * subform, a read-only row-header column for `itemKey` is prepended first.
 */
export function buildSubformColumns(
  template: Block[],
  options: BuildSubformColumnsOptions = {}
): Array<EditableColumn<Row>> {
  const { extras, fixedRows } = options;
  const columns: Array<EditableColumn<Row>> = [];

  if (fixedRows) {
    columns.push(createEditableColumn<Row>(fixedRows.itemKey, {
      title: fixedRowHeaderTitle(fixedRows),
      width: fixedRows.headerWidth,
      editable: false,
      renderView: (value, _record, index) => {
        const label = isRecord(value) && typeof value.label === "string" ? value.label : "";
        const heading = extras && subformRowHeading(extras.subform, index, extras.render);

        return heading
          ? (
              <>
                {heading}
                <span>{label}</span>
              </>
            )
          : <span>{label}</span>;
      }
    }));
  }

  for (const field of template) {
    if (isContainerNode(field) || !isKeyedField(field)) {
      continue;
    }

    const column = columnFor(field);

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
      title: renderColumnTitle(field.label ?? field.key, isRequired(field), header),
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
