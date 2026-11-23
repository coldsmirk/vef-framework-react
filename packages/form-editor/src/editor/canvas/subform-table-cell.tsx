import type { ReactElement } from "react";

import type {
  CheckboxGroupField,
  KeyedFormField,
  MultiSelectField,
  RadioField,
  SelectField
} from "../../types";

import { css } from "@emotion/react";
import { Checkbox, DatePicker, globalCssVars, Input, InputNumber, Radio, Select, Switch } from "@vef-framework-react/components";
import { DEFAULT_DATETIME_FORMAT, getDateGranularityFormat } from "@vef-framework-react/shared";

import { antdPickerForGranularity } from "../../engine/schema/date-granularity";
import { useFieldOptions } from "../../render/data-source-context";
import { OptionsStatus } from "../../render/parts/options-status";
import { resolveDateRangePlaceholderPair, resolveFieldPlaceholder } from "../../render/parts/placeholder";

type SampleSelectionField = SelectField | MultiSelectField | RadioField | CheckboxGroupField;

const fullWidthStyle = { width: "100%" } as const;

const unsupportedCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

/**
 * Sample cell for selection columns (`select` / `multi-select` / `radio` /
 * `checkbox-group`), reading options through the shared `useFieldOptions` hook
 * so `static`, `ref`, `codeSet`, and `remote` sources all behave identically
 * to top-level canvas fields without coercing option values to strings.
 */
function SampleSelectionCell({ field }: { field: SampleSelectionField }): ReactElement {
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);

  switch (field.type) {
    case "select": {
      return (
        <Select
          disabled
          loading={loading}
          options={options}
          placeholder={resolveFieldPlaceholder(field)}
          style={fullWidthStyle}
        />
      );
    }

    case "multi-select": {
      return (
        <Select
          disabled
          loading={loading}
          mode="multiple"
          options={options}
          placeholder={resolveFieldPlaceholder(field)}
          style={fullWidthStyle}
        />
      );
    }

    case "radio": {
      return options.length > 0
        ? <Radio.Group disabled options={options} />
        : <OptionsStatus error={error} loading={loading} />;
    }

    case "checkbox-group": {
      return options.length > 0
        ? <Checkbox.Group disabled options={options} />
        : <OptionsStatus error={error} loading={loading} />;
    }
  }
}

/**
 * A disabled, value-less control standing in for one table column's cell editor,
 * so the design canvas reads like the runtime `EditableTable` (header = the
 * field, body = the editor each row would show). Mirrors the per-type editor
 * mapping in `render/subform-columns.tsx`, but static — a canvas preview must
 * never bind real form state. A keyed leaf type with no table editor (e.g.
 * code-editor) falls back to a muted dash.
 */
export function SampleCell({ field }: { field: KeyedFormField }): ReactElement {
  switch (field.type) {
    case "textfield": {
      return <Input disabled placeholder={resolveFieldPlaceholder(field)} style={fullWidthStyle} />;
    }

    case "textarea": {
      return <Input.TextArea autoSize disabled placeholder={resolveFieldPlaceholder(field)} />;
    }

    case "number": {
      return <InputNumber disabled placeholder={resolveFieldPlaceholder(field)} style={fullWidthStyle} />;
    }

    case "select": {
      return <SampleSelectionCell field={field} />;
    }

    case "multi-select": {
      return <SampleSelectionCell field={field} />;
    }

    case "radio": {
      return <SampleSelectionCell field={field} />;
    }

    case "checkbox-group": {
      return <SampleSelectionCell field={field} />;
    }

    case "switch": {
      return <Switch disabled />;
    }

    case "date": {
      return (
        <DatePicker
          disabled
          format={getDateGranularityFormat(field.granularity)}
          picker={antdPickerForGranularity(field.granularity)}
          placeholder={resolveFieldPlaceholder(field)}
          style={fullWidthStyle}
        />
      );
    }

    case "datetime": {
      return (
        <DatePicker
          disabled
          showTime
          format={DEFAULT_DATETIME_FORMAT}
          placeholder={resolveFieldPlaceholder(field)}
          style={fullWidthStyle}
        />
      );
    }

    case "daterange": {
      return (
        <DatePicker.RangePicker
          disabled
          format={getDateGranularityFormat(field.granularity)}
          picker={antdPickerForGranularity(field.granularity)}
          placeholder={resolveDateRangePlaceholderPair(field.granularity)}
          style={fullWidthStyle}
        />
      );
    }

    default: {
      return <span css={unsupportedCss}>—</span>;
    }
  }
}
