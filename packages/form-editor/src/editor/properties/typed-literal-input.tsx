import type { Dayjs } from "@vef-framework-react/shared";
import type { ReactElement } from "react";

import type { FieldOption, FieldOptionSource, FormDataSource, FormField } from "../../types";

import { css } from "@emotion/react";
import { DatePicker, Input, InputNumber, Segmented, Select } from "@vef-framework-react/components";
import {
  DEFAULT_DATETIME_FORMAT,
  formatDateByGranularity,
  getDateGranularityFormat,
  tryParseDate,
  tryParseDateByGranularity
} from "@vef-framework-react/shared";

import {
  indexOptionsByValue,
  toTopLevelOptions
} from "../../engine/options";
import { antdPickerForGranularity } from "../../engine/schema/date-granularity";
import {
  filterOptionByLabelOrDescription,
  renderSelectOption
} from "../../render/parts/option-content";
import { OptionTreeSelect } from "../../render/parts/option-tree-select";
import { coerceToString } from "./entries/coerce";

const fullWidth = { width: "100%" } as const;

const segmentedCss = css({
  alignSelf: "flex-start"
});

const EMPTY_RANGE: string[] = [];

/**
 * Resolve statically known options for a selection field: inline static lists
 * or a `ref` pointing at a static form-global data source. Remote and code-set
 * sources cannot be enumerated synchronously at design time and degrade to
 * free entry.
 */
function resolveStaticFieldOptions(
  source: FieldOptionSource | undefined,
  dataSources: readonly FormDataSource[] | undefined
): readonly FieldOption[] | undefined {
  if (source === undefined) {
    return undefined;
  }

  if (source.kind === "static") {
    return source.options.length > 0 ? source.options : undefined;
  }

  if (source.kind === "ref") {
    const referenced = dataSources?.find(candidate => candidate.id === source.dataSourceId);

    if (referenced?.kind === "static" && referenced.options.length > 0) {
      return referenced.options;
    }
  }

  return undefined;
}

/**
 * Initial empty literal value matched to a target field's native shape when
 * seeding a brand-new assignment for that field.
 */
export function defaultLiteralValueForField(field: FormField | undefined): unknown {
  if (field === undefined) {
    return "";
  }

  if (field.type === "switch") {
    return false;
  }

  if (
    field.type === "multi-select"
    || field.type === "tree-multi-select"
    || field.type === "checkbox-group"
    || field.type === "daterange"
  ) {
    return [];
  }

  return "";
}

function parseNumberLiteral(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      return null;
    }

    const parsed = Number(trimmed);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseRangeLiteral(value: unknown, granularity: "year" | "quarter" | "month" | "day"): [Dayjs, Dayjs] | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const start = tryParseDateByGranularity(String(value[0]), granularity);
  const end = tryParseDateByGranularity(String(value[1]), granularity);

  return start && end ? [start, end] : null;
}

export interface TypedLiteralInputProps {
  field?: FormField;
  dataSources?: readonly FormDataSource[];
  placeholder?: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

/**
 * Target-aware literal value editor used by `set_fields` and `assign`: renders
 * the native input matching the target control (number, switch, date / datetime
 * / daterange respecting granularity, single / multi static option select)
 * instead of a bare textbox for every field type.
 */
export function TypedLiteralInput({
  dataSources,
  field,
  onChange,
  placeholder = "写入的值",
  value
}: TypedLiteralInputProps): ReactElement {
  if (field === undefined) {
    return (
      <Input
        placeholder={placeholder}
        style={fullWidth}
        value={coerceToString(value)}
        onChange={event => onChange(event.target.value)}
      />
    );
  }

  switch (field.type) {
    case "number": {
      return (
        <InputNumber
          max={field.max}
          min={field.min}
          placeholder={placeholder}
          precision={field.precision}
          step={field.step}
          style={fullWidth}
          value={parseNumberLiteral(value)}
          onChange={next => onChange(typeof next === "number" && Number.isFinite(next) ? next : "")}
        />
      );
    }

    case "switch": {
      const checked = value === true || value === "true" || value === 1 || value === "1";

      return (
        <Segmented
          css={segmentedCss}
          value={checked ? "true" : "false"}
          options={[
            { value: "true", label: field.onText?.trim() || "开启" },
            { value: "false", label: field.offText?.trim() || "关闭" }
          ]}
          onChange={next => onChange(next === "true")}
        />
      );
    }

    case "date": {
      const granularity = field.granularity ?? "day";
      const format = getDateGranularityFormat(granularity);
      const parsed = typeof value === "string" && value.length > 0
        ? tryParseDateByGranularity(value, granularity)
        : null;

      return (
        <DatePicker
          allowClear
          format={format}
          picker={antdPickerForGranularity(granularity)}
          placeholder="选择日期"
          style={fullWidth}
          value={parsed}
          onChange={date => onChange(date ? formatDateByGranularity(date, granularity) : "")}
        />
      );
    }

    case "datetime": {
      const parsed = typeof value === "string" && value.length > 0 ? tryParseDate(value) : null;

      return (
        <DatePicker
          allowClear
          showTime
          format={DEFAULT_DATETIME_FORMAT}
          placeholder="选择日期时间"
          style={fullWidth}
          value={parsed}
          onChange={(_date, dateString) => onChange(typeof dateString === "string" ? dateString : "")}
        />
      );
    }

    case "daterange": {
      const granularity = field.granularity ?? "day";
      const format = getDateGranularityFormat(granularity);

      return (
        <DatePicker.RangePicker
          allowClear
          format={format}
          picker={antdPickerForGranularity(granularity)}
          style={fullWidth}
          value={parseRangeLiteral(value, granularity)}
          onChange={dates => onChange(
            dates?.[0] && dates[1]
              ? [formatDateByGranularity(dates[0], granularity), formatDateByGranularity(dates[1], granularity)]
              : EMPTY_RANGE
          )}
        />
      );
    }

    case "select": {
      return renderSingleOptionLiteral(field.dataSource, dataSources, value, onChange);
    }

    case "radio": {
      return renderSingleOptionLiteral(field.dataSource, dataSources, value, onChange);
    }

    case "multi-select": {
      return renderMultiOptionLiteral(field.dataSource, dataSources, value, onChange);
    }

    case "tree-select": {
      return renderSingleTreeLiteral(field.dataSource, dataSources, field.leafOnly === true, value, onChange);
    }

    case "tree-multi-select": {
      return renderMultiTreeLiteral(field.dataSource, dataSources, field.leafOnly === true, value, onChange);
    }

    case "checkbox-group": {
      return renderMultiOptionLiteral(field.dataSource, dataSources, value, onChange);
    }

    default: {
      return (
        <Input
          placeholder={placeholder}
          style={fullWidth}
          value={coerceToString(value)}
          onChange={event => onChange(event.target.value)}
        />
      );
    }
  }
}

function renderSingleOptionLiteral(
  source: FieldOptionSource | undefined,
  dataSources: readonly FormDataSource[] | undefined,
  value: unknown,
  onChange: (next: unknown) => void
): ReactElement {
  const rawStaticOptions = resolveStaticFieldOptions(source, dataSources);
  const staticOptions = rawStaticOptions === undefined ? undefined : toTopLevelOptions(rawStaticOptions);

  if (staticOptions !== undefined) {
    const hasCurrent = (typeof value === "string" && value.length > 0) || typeof value === "number";
    const matched = hasCurrent
      ? staticOptions.find(option => String(option.value) === String(value))
      : undefined;
    const selectOptions = hasCurrent && matched === undefined
      ? [...staticOptions, { label: `${String(value)}（非静态选项）`, value }]
      : staticOptions;

    return (
      <Select
        allowClear
        showSearch
        filterOption={filterOptionByLabelOrDescription}
        optionRender={renderSelectOption}
        options={selectOptions}
        placeholder="选择选项值"
        style={fullWidth}
        value={hasCurrent ? (matched?.value ?? value) : undefined}
        onChange={next => onChange(next ?? "")}
      />
    );
  }

  return (
    <Input
      placeholder="输入选项值"
      style={fullWidth}
      value={coerceToString(value)}
      onChange={event => onChange(event.target.value)}
    />
  );
}

function renderMultiOptionLiteral(
  source: FieldOptionSource | undefined,
  dataSources: readonly FormDataSource[] | undefined,
  value: unknown,
  onChange: (next: unknown) => void
): ReactElement {
  const rawStaticOptions = resolveStaticFieldOptions(source, dataSources);
  const staticOptions = rawStaticOptions === undefined ? undefined : toTopLevelOptions(rawStaticOptions);
  const arrayValue = Array.isArray(value)
    ? value.filter((item): item is string | number => typeof item === "string" || typeof item === "number")
    : [];

  if (staticOptions !== undefined) {
    return (
      <Select
        allowClear
        showSearch
        filterOption={filterOptionByLabelOrDescription}
        mode="multiple"
        optionRender={renderSelectOption}
        options={staticOptions}
        placeholder="选择选项值"
        style={fullWidth}
        value={arrayValue}
        onChange={next => onChange(Array.isArray(next) ? next : [])}
      />
    );
  }

  return (
    <Select
      allowClear
      mode="tags"
      placeholder="输入选项值并回车"
      style={fullWidth}
      value={arrayValue.map(String)}
      onChange={next => onChange(Array.isArray(next) ? next : [])}
    />
  );
}

function renderSingleTreeLiteral(
  source: FieldOptionSource | undefined,
  dataSources: readonly FormDataSource[] | undefined,
  leafOnly: boolean,
  value: unknown,
  onChange: (next: unknown) => void
): ReactElement {
  const staticOptions = resolveStaticFieldOptions(source, dataSources);

  if (staticOptions !== undefined) {
    const hasCurrent = (typeof value === "string" && value.length > 0) || typeof value === "number";
    const matchedValue = hasCurrent
      ? indexOptionsByValue(staticOptions).keys().find(key => String(key) === String(value))
      : undefined;

    return (
      <OptionTreeSelect
        allowClear
        showSearch
        leafOnly={leafOnly}
        options={staticOptions}
        placeholder="选择选项值"
        value={hasCurrent ? (matchedValue ?? value) : undefined}
        onChange={next => onChange(next ?? "")}
      />
    );
  }

  return (
    <Input
      placeholder="输入选项值"
      style={fullWidth}
      value={coerceToString(value)}
      onChange={event => onChange(event.target.value)}
    />
  );
}

function renderMultiTreeLiteral(
  source: FieldOptionSource | undefined,
  dataSources: readonly FormDataSource[] | undefined,
  leafOnly: boolean,
  value: unknown,
  onChange: (next: unknown) => void
): ReactElement {
  const staticOptions = resolveStaticFieldOptions(source, dataSources);
  const arrayValue = Array.isArray(value)
    ? value.filter((item): item is string | number => typeof item === "string" || typeof item === "number")
    : [];

  if (staticOptions !== undefined) {
    return (
      <OptionTreeSelect
        allowClear
        multiple
        showSearch
        leafOnly={leafOnly}
        options={staticOptions}
        placeholder="选择选项值"
        value={arrayValue}
        onChange={onChange}
      />
    );
  }

  return (
    <Select
      allowClear
      mode="tags"
      placeholder="输入选项值并回车"
      style={fullWidth}
      value={arrayValue.map(String)}
      onChange={next => onChange(Array.isArray(next) ? next : [])}
    />
  );
}
