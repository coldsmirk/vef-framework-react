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
import { Checkbox, DatePicker, globalCssVars, Input, InputNumber, Radio, Select, Switch, TreeSelect } from "@vef-framework-react/components";
import { DEFAULT_DATETIME_FORMAT, getDateGranularityFormat } from "@vef-framework-react/shared";
import { useMemo } from "react";

import { toTopLevelOptions } from "../../engine/options";
import { antdPickerForGranularity } from "../../engine/schema/date-granularity";
import { useFieldOptions } from "../../render/data-source-context";
import { toAntdTreeData } from "../../render/parts/option-content";
import { OptionsStatus } from "../../render/parts/options-status";
import { resolveDateRangePlaceholderPair, resolveFieldPlaceholder } from "../../render/parts/placeholder";

type SampleSelectionField
  = | SelectField
    | MultiSelectField
    | TreeSelectField
    | TreeMultiSelectField
    | RadioField
    | CheckboxGroupField;

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
    options: rawOptions
  } = useFieldOptions(field.dataSource);
  const flatOptions = useMemo(() => toTopLevelOptions(rawOptions), [rawOptions]);
  const treeData = useMemo(
    () => field.type === "tree-select" || field.type === "tree-multi-select"
      ? toAntdTreeData(rawOptions, { leafOnly: field.leafOnly === true, checkable: field.type === "tree-multi-select" })
      : [],
    [field, rawOptions]
  );

  switch (field.type) {
    case "select": {
      return (
        <Select
          disabled
          loading={loading}
          options={flatOptions}
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
          options={flatOptions}
          placeholder={resolveFieldPlaceholder(field)}
          style={fullWidthStyle}
        />
      );
    }

    case "tree-select": {
      return (
        <TreeSelect
          disabled
          loading={loading}
          placeholder={resolveFieldPlaceholder(field)}
          style={fullWidthStyle}
          treeData={treeData}
        />
      );
    }

    case "tree-multi-select": {
      return (
        <TreeSelect
          disabled
          treeCheckable
          treeCheckStrictly
          loading={loading}
          placeholder={resolveFieldPlaceholder(field)}
          style={fullWidthStyle}
          treeData={treeData}
        />
      );
    }

    case "radio": {
      return flatOptions.length > 0
        ? <Radio.Group disabled options={flatOptions} />
        : <OptionsStatus error={error} loading={loading} />;
    }

    case "checkbox-group": {
      return flatOptions.length > 0
        ? <Checkbox.Group disabled options={flatOptions} />
        : <OptionsStatus error={error} loading={loading} />;
    }
  }
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
      return <SampleSelectionCell field={field} />;
    }

    case "multi-select": {
      return <SampleSelectionCell field={field} />;
    }

    case "tree-select": {
      return <SampleSelectionCell field={field} />;
    }

    case "tree-multi-select": {
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
