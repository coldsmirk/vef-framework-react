import type { ReactElement } from "react";

import type {
  CheckboxGroupField,
  KeyedFormField,
  MultiSelectField,
  RadioField,
  SelectField,
  TreeMultiSelectField,
  TreeSelectField
} from "../../types";

import { css } from "@emotion/react";
import { Checkbox, DatePicker, globalCssVars, Input, InputNumber, Radio, Select, Switch } from "@vef-framework-react/components";
import { DEFAULT_DATETIME_FORMAT, getDateGranularityFormat } from "@vef-framework-react/shared";

import { antdPickerForGranularity } from "../../engine/schema/date-granularity";
import { useFieldOptions, useTopLevelFieldOptions } from "../../render/data-source-context";
import { OptionTreeSelect } from "../../render/parts/option-tree-select";
import { OptionsStatus } from "../../render/parts/options-status";
import { resolveDateRangePlaceholderPair, resolveFieldPlaceholder } from "../../render/parts/placeholder";

type SampleFlatSelectionField = SelectField | MultiSelectField | RadioField | CheckboxGroupField;

type SampleTreeSelectionField = TreeSelectField | TreeMultiSelectField;

const fullWidthStyle = { width: "100%" } as const;

const unsupportedCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

/**
 * Sample cell for flat selection columns (`select` / `multi-select` / `radio` /
 * `checkbox-group`), reading top-level options through the shared
 * {@link useTopLevelFieldOptions} hook so `static`, `ref`, `codeSet`, and
 * `remote` sources all behave identically to top-level canvas fields.
 */
function SampleFlatSelectionCell({ field }: { field: SampleFlatSelectionField }): ReactElement {
  const {
    error,
    loading,
    options
  } = useTopLevelFieldOptions(field.dataSource);

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
 * Sample cell for hierarchical tree selection columns (`tree-select` /
 * `tree-multi-select`), reusing {@link OptionTreeSelect}.
 */
function SampleTreeSelectionCell({ field }: { field: SampleTreeSelectionField }): ReactElement {
  const { loading, options } = useFieldOptions(field.dataSource);

  return (
    <OptionTreeSelect
      disabled
      leafOnly={field.leafOnly === true}
      loading={loading}
      multiple={field.type === "tree-multi-select"}
      options={options}
      placeholder={resolveFieldPlaceholder(field)}
    />
  );
}

/**
 * A disabled, value-less control standing in for one table column's cell editor,
 * so the design canvas reads like the runtime inline-editable table (header =
 * the field, body = the editor each row shows). Static — a canvas preview must
 * never bind real form state. A keyed leaf type with no canvas preview falls
 * back to a muted dash.
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
      return <SampleFlatSelectionCell field={field} />;
    }

    case "multi-select": {
      return <SampleFlatSelectionCell field={field} />;
    }

    case "tree-select": {
      return <SampleTreeSelectionCell field={field} />;
    }

    case "tree-multi-select": {
      return <SampleTreeSelectionCell field={field} />;
    }

    case "radio": {
      return <SampleFlatSelectionCell field={field} />;
    }

    case "checkbox-group": {
      return <SampleFlatSelectionCell field={field} />;
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
