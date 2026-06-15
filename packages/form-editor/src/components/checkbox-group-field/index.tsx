import type { FC } from "react";

import type {
  CheckboxGroupField,
  FieldComponentProps,
  FieldDefinition,
  FieldOptionSource,
  PropertiesDescriptor
} from "../../types";

import { Checkbox, Spin } from "@vef-framework-react/components";

import { useFieldOptions } from "../../render/data-source-context";
import { FieldShell } from "../../render/parts/field-shell";
import { OptionsStatus } from "../../render/parts/options-status";
import { defineFieldDefinition, definePropertyEntry } from "../../types";
import { optionDirectionEntry, requiredEntry } from "../field-entries";

const CheckboxGroupInput: FC<FieldComponentProps<CheckboxGroupField, Array<string | number>>> = ({
  disabled,
  domId,
  errors,
  field,
  labelPosition,
  required,
  value,
  onChange
}) => {
  const {
    error,
    loading,
    options
  } = useFieldOptions(field.dataSource);

  return (
    <FieldShell
      domId={domId}
      errors={errors}
      helperText={field.helperText}
      label={field.label ?? "多选"}
      labelPosition={field.labelPosition ?? labelPosition}
      required={required ?? field.validate?.required}
    >
      {options.length > 0
        ? (
            <Spin spinning={loading}>
              {/* antd's generic Checkbox.Group infers `T = string | number` from the
                  typed `options` / `value`, so `next` arrives correctly typed. */}
              <Checkbox.Group
                disabled={disabled}
                options={options}
                value={Array.isArray(value) ? value : []}
                style={field.direction === "vertical"
                  ? {
                      display: "flex",
                      flexDirection: "column",
                      rowGap: 8
                    }
                  : undefined}
                onChange={next => onChange(next)}
              />
            </Spin>
          )
        : <OptionsStatus error={error} loading={loading} />}
    </FieldShell>
  );
};

const checkboxGroupProperties: PropertiesDescriptor = [
  {
    id: "general",
    label: "通用",
    tab: "props",
    entries: [
      definePropertyEntry<CheckboxGroupField, string | undefined>({
        id: "label",
        label: "标签",
        type: "text",
        read: field => field.label,
        write: (field, label) => { return { ...field, label }; }
      }),
      definePropertyEntry<CheckboxGroupField, string | undefined>({
        id: "helperText",
        label: "帮助文字",
        type: "text",
        read: field => field.helperText,
        write: (field, helperText) => { return { ...field, helperText }; }
      })
    ]
  },
  {
    id: "options",
    label: "选项",
    tab: "props",
    entries: [
      definePropertyEntry<CheckboxGroupField, FieldOptionSource | undefined>({
        id: "options",
        label: "可选项",
        type: "options-editor",
        read: field => field.dataSource,
        write: (field, dataSource) => { return { ...field, dataSource }; }
      }),
      optionDirectionEntry<CheckboxGroupField>()
    ]
  },
  {
    id: "validation",
    label: "基础",
    tab: "validation",
    entries: [requiredEntry<CheckboxGroupField>()]
  }
];

export const checkboxGroupFieldDefinition: FieldDefinition = defineFieldDefinition<CheckboxGroupField, Array<string | number>>({
  config: {
    type: "checkbox-group",
    name: "多选",
    group: "selection",
    keyed: true,
    icon: "list-checks",
    create: () => {
      return {
        type: "checkbox-group",
        label: "多选",
        dataSource: { kind: "static", options: [] }
      };
    }
  },
  Component: CheckboxGroupInput,
  properties: checkboxGroupProperties
});
