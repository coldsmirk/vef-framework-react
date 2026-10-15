import type { ReactElement } from "react";

import type { KeyedFormField } from "../../types";

import { css } from "@emotion/react";
import { Checkbox, DatePicker, globalCssVars, Input, InputNumber, Radio, Select, Switch } from "@vef-framework-react/components";
import { DEFAULT_DATE_FORMAT, DEFAULT_DATETIME_FORMAT } from "@vef-framework-react/shared";

import { useCodeSetState } from "../../render/code-set-context";
import { columnOptions } from "../../render/subform-columns";

const fullWidthStyle = { width: "100%" } as const;

const unsupportedCss = css({
  fontSize: globalCssVars.fontSizeSm,
  color: globalCssVars.colorTextTertiary
});

/**
 * A disabled, value-less control standing in for one table column's cell editor,
 * so the design canvas reads like the runtime `EditableTable` (header = the
 * field, body = the editor each row would show). Mirrors the per-type editor
 * mapping in `render/subform-columns.tsx`, but static — a canvas preview must
 * never bind real form state. A keyed leaf type with no table editor (e.g.
 * code-editor) falls back to a muted dash.
 */
export function SampleCell({ field }: { field: KeyedFormField }): ReactElement {
  // The options the runtime cell shows (`render/subform-columns.tsx`): a static
  // list or a data dictionary the canvas has loaded. A remote / `ref` source
  // shows none, exactly as the runtime table cell would until its data loads.
  const { options: codeSetOptions } = useCodeSetState();

  switch (field.type) {
    case "textfield": {
      return <Input disabled placeholder={field.placeholder} style={fullWidthStyle} />;
    }

    case "textarea": {
      return <Input.TextArea autoSize disabled placeholder={field.placeholder} />;
    }

    case "number": {
      return <InputNumber disabled placeholder={field.placeholder} style={fullWidthStyle} />;
    }

    case "select": {
      return <Select disabled options={columnOptions(field.dataSource, codeSetOptions)} placeholder={field.placeholder} style={fullWidthStyle} />;
    }

    case "radio": {
      return <Radio.Group disabled options={columnOptions(field.dataSource, codeSetOptions)} />;
    }

    case "checkbox-group": {
      return <Checkbox.Group disabled options={columnOptions(field.dataSource, codeSetOptions)} />;
    }

    case "switch": {
      return <Switch disabled />;
    }

    case "date": {
      return <DatePicker disabled format={DEFAULT_DATE_FORMAT} placeholder={field.placeholder} style={fullWidthStyle} />;
    }

    case "datetime": {
      return <DatePicker disabled showTime format={DEFAULT_DATETIME_FORMAT} placeholder={field.placeholder} style={fullWidthStyle} />;
    }

    case "daterange": {
      return <DatePicker.RangePicker disabled format={DEFAULT_DATE_FORMAT} style={fullWidthStyle} />;
    }

    default: {
      return <span css={unsupportedCss}>—</span>;
    }
  }
}
